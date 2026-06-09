// Smoothing & hysteresis — the pure stabilization layer of the Tuner (S18 ph3,
// epic #90). It sits between the detector (ph2) and the UI (ph6) and turns a
// noisy, occasionally octave-jumping stream of per-frame `(hz, clarity)`
// estimates into a steady, musically honest readout that doesn't flicker between
// adjacent notes or octaves.
//
// This module is PURE: no React, no DOM, no Web Audio. A `TunerSmoother` is a
// small state machine (a closure over a median ring buffer, an EMA accumulator,
// and the current note-label) driven one frame at a time via `push`; the only
// state is what the smoothing recurrences inherently carry. Feeding the same
// frame sequence into a fresh smoother always yields the same output sequence
// (the reducers are deterministic), so the whole layer is unit-testable over
// crafted sequences (`smoothing.test.ts`) with no audio.
//
// Why cents/log space, never raw Hz (the central design decision, from the #90
// deep-dive): a fixed Hz step is many cents at G3 and few at E5, so smoothing in
// Hz is musically non-uniform — the same jitter would read as wildly different
// pitch error across the range. Every stage below operates on the SIGNED cents
// deviation of the detected pitch from its nearest equal-tempered note (ph1's
// `noteFromFrequency().cents`, ±50¢ by construction), plus a continuous "absolute
// cents" coordinate (`midi·100 + cents`) used internally so the median/EMA can
// cross note boundaries smoothly without a ±50¢ wrap discontinuity.
//
// Pipeline order is strict and load-bearing:
//   (1) GATE   — reject frames whose `clarity` is below the detector's threshold
//                or whose `hz <= 0` (ph2's `-1` sentinel). A rejected frame is
//                NOT smoothed or emitted: `push` returns `null` (a freeze), so the
//                UI holds the last good reading rather than showing garbage.
//   (2) MEDIAN — a 3–5 frame sliding median over the absolute-cents coordinate.
//                The median (unlike a mean) *rejects* a single impulsive octave
//                outlier outright, so it MUST run before averaging — an EMA would
//                only smear a 1200¢ spike across several frames instead of
//                discarding it.
//   (3) EMA    — an exponential moving average (α ≈ 0.2) over the median output
//                for perceptual smoothness (the meter glides rather than steps).
//   (4) LABEL HYSTERESIS — the smoothed pitch is resolved to a note/octave only
//                through a dead-band + persistence guard: the displayed label
//                holds until a different candidate either crosses the 50¢ midpoint
//                by a margin OR persists for a few frames, which also suppresses
//                single-frame octave flips that survived the median.
//
// 1-Euro filter (deferred drop-in, NOT built here): the EMA stage could be
// swapped for a 1-Euro filter — an adaptive low-pass that widens its cutoff with
// signal velocity, giving low lag on fast slides and heavy smoothing when held —
// behind this exact same `TunerSmoother` interface (same `push`/`reset`, same
// `Readout`). It's a fast-follow upgrade (epic #90 "Not doing (v1)"), so this
// file ships the simpler fixed-α EMA and leaves the seam documented.

import {
  noteFromFrequency,
  nearestOpenString,
  frequencyOfMidi,
  A4_DEFAULT,
  type OpenString,
} from '@violin-tools/theory';

/**
 * In-tune threshold in cents. `inTune` is true iff `|cents| ≤ IN_TUNE_CENTS`.
 * From the #90 deep-dive params (in-tune ±5¢) and consistent with the DESIGN.md
 * §2.6 "snap to {mint} at ≤±5¢" contract the meter renders against.
 */
export const IN_TUNE_CENTS = 5;

/**
 * Default median window (frame count). The deep-dive specifies 3–5; 5 rejects a
 * single-frame octave outlier with one frame of margin on either side while
 * keeping latency low (~5 frames ≈ 80 ms at 60 fps). Must be odd so the median
 * is a true middle element; constructed odd, but `TunerSmoother` also clamps it.
 */
export const DEFAULT_MEDIAN_WINDOW = 5;

/**
 * Default EMA smoothing factor α ∈ (0, 1]. From the deep-dive (α ≈ 0.2): each new
 * frame contributes 20% and the running average 80%, a perceptually smooth glide
 * without excessive lag. Higher α = snappier/noisier, lower α = smoother/laggier.
 */
export const DEFAULT_EMA_ALPHA = 0.2;

/**
 * Label-hysteresis persistence threshold (frame count). A candidate note/octave
 * different from the held label must persist for this many consecutive frames
 * before the label switches — this is the time-based half of the dead-band guard
 * and is what suppresses single-frame octave flips that survive the median.
 *
 * At an assumed ~60 fps (rAF, per the ph4 audio shell) a frame is ~16.7 ms, so 4
 * frames ≈ 67 ms — inside the deep-dive's ~50–100 ms persistence window. The
 * frame rate is an *assumption documented here*, not measured: the guard is a
 * frame count, so a slower frame rate lengthens the wall-clock hold proportionally
 * (harmless — it only makes the label steadier).
 */
export const DEFAULT_LABEL_PERSIST_FRAMES = 4;

/**
 * Label-hysteresis dead-band margin in cents. Even before the persistence count
 * is reached, a candidate that is clearly past the 50¢ midpoint between the held
 * note and its neighbour — by this margin — switches immediately, so a decisive
 * move to a new note isn't held back the full persistence window. A small margin
 * (a few cents past the midpoint) gives a ~46–54¢ dead-band around the boundary
 * that absorbs jitter without feeling sticky on a genuine note change.
 */
export const DEFAULT_LABEL_DEAD_BAND_CENTS = 4;

/** Cents per semitone — the absolute-cents coordinate is `midi · 100 + cents`. */
const CENTS_PER_SEMITONE = 100;

/** Half a semitone — the 50¢ midpoint where one note's territory meets the next. */
const SEMITONE_MIDPOINT_CENTS = 50;

/** A single per-frame estimate from the detector (ph2 `detectPitchDetailed`). */
export interface Frame {
  /** Fundamental frequency in Hz; `<= 0` (ph2's `-1`) marks a rejected frame. */
  hz: number;
  /** NSDF clarity at the chosen peak ∈ [0, 1]; below threshold ⇒ rejected. */
  clarity: number;
}

/**
 * A stabilized, display-ready reading emitted by `TunerSmoother.push`.
 *
 * NOTE on the cents field (resolving the #93 plan-review SUGGESTION): there is a
 * SINGLE signed `cents` field — negative = flat, positive = sharp — matching
 * ph1's `noteFromFrequency`, which already returns one signed `cents`. We do NOT
 * carry a second `signedCents` field; "the cents" is unambiguously this signed
 * deviation, and `inTune` / the meter both read it directly.
 */
export interface Readout {
  /** The smoothed fundamental in Hz (reconstructed from the smoothed cents). */
  hz: number;
  /** Fixed-sharp chromatic name of the held note (`C`, `C♯`, …; never `spell()`). */
  note: string;
  /** Scientific octave of the held note (MIDI 60 = C4). */
  octave: number;
  /** Signed deviation from the held note in cents (negative = flat, + = sharp). */
  cents: number;
  /** True iff `|cents| ≤ IN_TUNE_CENTS`. */
  inTune: boolean;
  /** The open string nearest the smoothed pitch by log distance, or `null`. */
  nearestString: OpenString | null;
  /** Clarity of the frame that produced this readout (passes through the gate). */
  clarity: number;
}

/** Tunable smoother parameters; each defaults to the exported `DEFAULT_*` const. */
export interface SmootherOptions {
  /** Median window in frames (clamped to an odd value ≥ 1). */
  medianWindow?: number;
  /** EMA smoothing factor α ∈ (0, 1]. */
  emaAlpha?: number;
  /** Clarity gate threshold; a frame below this is rejected. */
  clarityThreshold?: number;
  /** A4 calibration reference (Hz) passed through to ph1's note resolution. */
  a4?: number;
  /** Frames a differing label must persist before the displayed label switches. */
  labelPersistFrames?: number;
  /** Cents past the 50¢ midpoint that force an immediate (pre-persistence) switch. */
  labelDeadBandCents?: number;
}

/**
 * The pure stabilization state machine. Construct one per live tuning session,
 * feed it detector frames via `push`, and `reset()` it on stop/restart. All four
 * pipeline stages live inside; nothing here touches audio or the DOM.
 */
export interface TunerSmoother {
  /**
   * Push one detector frame through gate → median → EMA → label hysteresis.
   * Returns a stabilized `Readout`, or `null` when the frame is gated out
   * (low clarity or `hz <= 0`) — a `null` means "freeze": the UI keeps its last
   * good readout rather than showing a stale or garbage value.
   */
  push(frame: Frame): Readout | null;
  /** Clear all smoothing state (median buffer, EMA, held label) for a fresh start. */
  reset(): void;
}

/** Default clarity gate — mirrors ph2's `CLARITY_THRESHOLD` (0.5) without re-importing it. */
const DEFAULT_CLARITY_THRESHOLD = 0.5;

/** Force `window` to the nearest odd integer ≥ 1 so the median has a true middle. */
function toOddWindow(window: number): number {
  const w = Math.max(1, Math.floor(window));
  return w % 2 === 0 ? w + 1 : w;
}

/** Median of a numeric array (ascending sort, middle element). Caller guarantees length ≥ 1. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // sorted is non-empty (caller guarantees ≥ 1), so the middle index always exists.
  return sorted[mid] ?? 0;
}

/**
 * The held note-label state, carried between frames for hysteresis. `null` until
 * the first accepted frame establishes a label. `absoluteCents` is `midi·100`
 * (the exact-pitch coordinate of the held note's centre) so a candidate's signed
 * distance from the held note is `candidateAbsoluteCents − held.absoluteCents`.
 */
interface HeldLabel {
  /** Nearest-note MIDI number of the held label. */
  midi: number;
  /** The held note's centre on the absolute-cents axis (`midi · 100`). */
  absoluteCents: number;
}

/**
 * Create a pure `TunerSmoother`. Options default to the exported `DEFAULT_*`
 * constants; pass overrides to tune the median window, EMA α, clarity gate, A4
 * reference, or the label-hysteresis thresholds.
 */
export function createTunerSmoother(options: SmootherOptions = {}): TunerSmoother {
  const medianWindow = toOddWindow(options.medianWindow ?? DEFAULT_MEDIAN_WINDOW);
  const emaAlpha = options.emaAlpha ?? DEFAULT_EMA_ALPHA;
  const clarityThreshold = options.clarityThreshold ?? DEFAULT_CLARITY_THRESHOLD;
  const a4 = options.a4; // undefined ⇒ ph1 uses A4_DEFAULT
  const persistFrames = Math.max(1, Math.floor(options.labelPersistFrames ?? DEFAULT_LABEL_PERSIST_FRAMES));
  const deadBandCents = options.labelDeadBandCents ?? DEFAULT_LABEL_DEAD_BAND_CENTS;

  // ── Per-session smoothing state ────────────────────────────────────────────
  let medianBuffer: number[] = []; // ring of recent absolute-cents values
  let emaState: number | null = null; // running EMA of the median output (absolute cents)
  let held: HeldLabel | null = null; // current displayed note/octave
  let candidateMidi: number | null = null; // a different label awaiting persistence
  let candidateRunLength = 0; // consecutive frames the candidate has persisted

  function reset(): void {
    medianBuffer = [];
    emaState = null;
    held = null;
    candidateMidi = null;
    candidateRunLength = 0;
  }

  function push(frame: Frame): Readout | null {
    // ── (1) GATE ───────────────────────────────────────────────────────────
    // A frame the detector didn't trust (low clarity) or didn't resolve
    // (hz ≤ 0, ph2's −1 sentinel) is frozen, never smoothed: we return null and
    // leave all smoothing state untouched so a future good frame resumes cleanly.
    if (frame.hz <= 0 || frame.clarity < clarityThreshold) {
      return null;
    }

    // Resolve the raw frame to its nearest note + signed cents (ph1). A positive
    // hz that ph1 still can't read (shouldn't happen past the gate) is treated as
    // a gate rejection for safety.
    const reading = noteFromFrequency(frame.hz, a4);
    if (reading === null) {
      return null;
    }

    // The absolute-cents coordinate places every pitch on one continuous axis
    // (midi·100 + signed cents-from-nearest), so the median/EMA never hit the
    // ±50¢ wrap at a note boundary.
    const rawAbsoluteCents = reading.midi * CENTS_PER_SEMITONE + reading.cents;

    // ── (2) MEDIAN ───────────────────────────────────────────────────────────
    // Slide the window and take the median — this discards a lone octave/partial
    // outlier (a ~±1200¢ spike) outright instead of letting it pollute the EMA.
    medianBuffer.push(rawAbsoluteCents);
    if (medianBuffer.length > medianWindow) {
      medianBuffer.shift();
    }
    const medianAbsoluteCents = median(medianBuffer);

    // ── (3) EMA ────────────────────────────────────────────────────────────
    // Exponential moving average over the median output for a smooth glide. The
    // first accepted frame seeds the state (no lag on attack); thereafter
    // s ← α·x + (1−α)·s.
    emaState =
      emaState === null ? medianAbsoluteCents : emaAlpha * medianAbsoluteCents + (1 - emaAlpha) * emaState;
    const smoothedAbsoluteCents = emaState;

    // ── (4) LABEL HYSTERESIS ──────────────────────────────────────────────
    // Resolve the smoothed pitch to a candidate note, then decide whether to
    // adopt it as the displayed label. The candidate is the nearest note to the
    // smoothed absolute-cents value.
    const candidateMidiNow = Math.round(smoothedAbsoluteCents / CENTS_PER_SEMITONE);

    if (held === null) {
      // First reading establishes the label immediately (nothing to hold against).
      held = { midi: candidateMidiNow, absoluteCents: candidateMidiNow * CENTS_PER_SEMITONE };
      candidateMidi = null;
      candidateRunLength = 0;
    } else if (candidateMidiNow === held.midi) {
      // Smoothed pitch is back inside the held note's territory — cancel any
      // pending switch; the dead-band absorbed the excursion.
      candidateMidi = null;
      candidateRunLength = 0;
    } else {
      // A different candidate. Two independent ways it can win:
      //   (a) DEAD-BAND: it is clearly past the 50¢ midpoint between the held
      //       note and this candidate — i.e. ≥ (50 + margin)¢ from the held
      //       note's centre — so it switches immediately (a decisive move).
      //   (b) PERSISTENCE: it has held for `persistFrames` consecutive frames,
      //       so even a marginal-but-sustained move eventually switches.
      const centsFromHeld = Math.abs(smoothedAbsoluteCents - held.absoluteCents);
      const pastDeadBand = centsFromHeld >= SEMITONE_MIDPOINT_CENTS + deadBandCents;

      if (candidateMidi === candidateMidiNow) {
        candidateRunLength += 1;
      } else {
        candidateMidi = candidateMidiNow;
        candidateRunLength = 1;
      }

      if (pastDeadBand || candidateRunLength >= persistFrames) {
        held = { midi: candidateMidiNow, absoluteCents: candidateMidiNow * CENTS_PER_SEMITONE };
        candidateMidi = null;
        candidateRunLength = 0;
      }
      // Otherwise: hold the current label this frame (suppresses the flip).
    }

    // ── Build the readout against the HELD label ─────────────────────────────
    // Cents are reported relative to the displayed note (held), not the raw
    // candidate, so a suppressed flip reads as "sharp/flat of the held note"
    // rather than snapping. Reconstruct hz from the smoothed absolute cents.
    const centsFromHeldNote = smoothedAbsoluteCents - held.absoluteCents;
    const heldReading = midiToReading(held.midi, a4);
    const smoothedHz = absoluteCentsToHz(smoothedAbsoluteCents, a4);

    return {
      hz: smoothedHz,
      note: heldReading.name,
      octave: heldReading.octave,
      cents: centsFromHeldNote,
      inTune: Math.abs(centsFromHeldNote) <= IN_TUNE_CENTS,
      nearestString: nearestOpenString(smoothedHz, a4),
      clarity: frame.clarity,
    };
  }

  return { push, reset };
}

/**
 * Resolve a MIDI note number to its fixed-sharp name + octave via ph1. We round
 * the held MIDI to its exact-frequency Hz and read it back through
 * `noteFromFrequency` so the chromatic naming (§13-exempt fixed sharps) and
 * octave come from the single source of truth, not a re-implemented table here.
 */
function midiToReading(midi: number, a4: number | undefined): { name: string; octave: number } {
  const hz = midiToHz(midi, a4);
  const reading = noteFromFrequency(hz, a4);
  // The held MIDI is integral and in range, so this read always resolves.
  return reading === null
    ? { name: '', octave: 0 }
    : { name: reading.name, octave: reading.octave };
}

/** Hz of an integral MIDI note under `a4` (the inverse used to read names back). */
function midiToHz(midi: number, a4: number | undefined): number {
  return frequencyOfMidi(midi, a4 ?? A4_DEFAULT);
}

/**
 * Hz of a point on the absolute-cents axis (`midi·100 + cents`) under `a4`. The
 * continuous MIDI coordinate is `absoluteCents / 100`; ph1's `frequencyOfMidi`
 * accepts a fractional note number, so the whole Hz↔cents reconstruction routes
 * through the single source of truth rather than re-deriving 2^((n−69)/12) here.
 */
function absoluteCentsToHz(absoluteCents: number, a4: number | undefined): number {
  return frequencyOfMidi(absoluteCents / CENTS_PER_SEMITONE, a4 ?? A4_DEFAULT);
}
