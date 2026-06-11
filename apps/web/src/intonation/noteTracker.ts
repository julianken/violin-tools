// noteTracker — pure FSM for the Intonation drill (C3, epic #141).
//
// Consumes raw pre-smoothing frames `{ timestampMs, hz, clarity }` from the
// C1 `onRawFrame` seam and the ordered `DrillTarget[]` sequence from C2's
// `drillPlan`, and produces a per-target `NoteResult` (median cents vs the
// intended degree) whenever a target is settled and the advance fires.
//
// PURE: no React, no DOM, no Web-audio API — entirely synchronous state-machine
// logic over an input array of frames. Thresholds are injected via
// `TrackerOptions` so tests can pin them and the C5 hook (`useIntonationDrill`)
// can wire in the live `CLARITY_THRESHOLD` from `detectPitch.ts`.
//
// FSM per active target:  seeking → settling → settled → advance
//
//   seeking → settling : frame is within `halfWidthCents` of the intended Hz AND
//                        passes `clarityThreshold` AND passes the octave guard.
//   settling → seeking : frame exits the band or drops below clarity
//                        (dwell buffer is cleared).
//   settling → settled : accumulated dwell time in settling state ≥ `dwellMs`.
//   settled → advance  : frame exits the band. `NoteResult` is emitted; the
//                        settling+settled buffer is cleared; `currentTargetIndex`
//                        is incremented. When all targets advance, `TrackerState`
//                        becomes `'complete'`.
//
// Scoring: median of the cents values for **settled frames only** (from the
// first settled frame through the last frame before advance-exit). Settling
// frames are buffered but discarded on advance — excluding attack onset is the
// primary purpose of the three-state model. `centsBetween` from
// `@violin-tools/theory` is used for the signed cents math (it guards `hz ≤ 0`
// via `safeLog2`, returning `null` instead of `NaN`/`-Infinity`). The octave
// guard uses `noteFromFrequency(...).midi` (same package) — it returns `null`
// for `hz ≤ 0`, making the guard inherently safe for silence frames.
//
// Advance is NEVER gated on accuracy — the FSM follows the player; it records
// how each note landed but does not block progress.
//
// Strict sequence, no skip-ahead (v1): the tracker always waits on the current
// target; frames pitched at a later degree do not register as advances.

import { centsBetween, noteFromFrequency, A4_DEFAULT } from '@violin-tools/theory';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * A single drill target — one note in the ordered sequence the tracker walks
 * through. Defined here for C3 purity; C2 (`drillPlan`, #131) owns the
 * canonical definition once merged and may supersede this with an import.
 */
export interface DrillTarget {
  /** 0-based position in the drill sequence. */
  readonly index: number;
  /** MIDI note number (0–127). Used for the octave guard. */
  readonly midiNote: number;
  /** Exact intended frequency (Hz). Used for cents scoring and the acceptance band. */
  readonly hz: number;
  /** Human-readable degree label (e.g. `"1"`, `"2"`, …). */
  readonly degreeLabel: string;
}

/**
 * A raw pre-smoothing pitch frame — matches the C1 `onRawFrame` seam contract
 * (`useTuner.ts`). Defined locally so the module is independently testable with
 * synthetic scripts; re-export or merge with C1's type when that issue lands.
 */
export interface RawFrame {
  readonly timestampMs: number;
  /** Estimated fundamental frequency, Hz. 0 / non-positive = silence. */
  readonly hz: number;
  /** McLeod NSDF clarity, nominally [0, 1]. Below `clarityThreshold` = noise. */
  readonly clarity: number;
}

/** Per-target scored result, emitted when a target advances. */
export interface NoteResult {
  /** 0-based index into the `DrillTarget[]` plan. */
  readonly targetIndex: number;
  /** The intended Hz for this target (from the `DrillTarget`). */
  readonly intendedHz: number;
  /**
   * Median signed cents deviation over the **settled** scoring band. Positive = sharp.
   * Computed via `centsBetween(frame.hz, intendedHz)`. Null if no valid settled
   * frames were accumulated before advance (degenerate but safe).
   */
  readonly medianCents: number | null;
  /** Count of settled frames included in the scoring band. */
  readonly frameCount: number;
}

/** Run lifecycle of the tracker. */
export type TrackerState = 'idle' | 'running' | 'complete';

/** Threshold parameters injected at construction time. */
export interface TrackerOptions {
  /**
   * Minimum McLeod clarity to accept a frame as a confident pitch.
   * Match `CLARITY_THRESHOLD` from `detectPitch.ts` in production wiring.
   */
  readonly clarityThreshold: number;
  /**
   * Minimum contiguous dwell time (ms) inside the Hz acceptance band required to
   * transition from `settling` to `settled`. Guards against transient blips.
   */
  readonly dwellMs: number;
  /**
   * Half-width of the acceptance band around the intended Hz, in cents.
   * A frame must be within `±halfWidthCents` of `intendedHz` to count.
   */
  readonly halfWidthCents: number;
  /**
   * A4 reference (Hz) used for the octave guard. Defaults to 440.
   * Pass the active calibration value from the tuner in production.
   */
  readonly a4?: number;
}

/** The public API returned by `createNoteTracker`. */
export interface NoteTrackerApi {
  /**
   * Hot-path frame processor. Returns a `NoteResult` when a target is
   * settled and advance fires; returns `null` otherwise.
   */
  pushFrame(frame: RawFrame): NoteResult | null;
  /** Snapshot accessor for the hook. */
  getState(): {
    readonly trackerState: TrackerState;
    readonly currentTargetIndex: number;
    readonly results: readonly NoteResult[];
  };
  /**
   * Clear all accumulated state. `currentTargetIndex` resets to 0;
   * `results` resets to `[]`; `trackerState` resets to `'running'`
   * (ready to re-enter the sequence from the first target).
   */
  reset(): void;
}

// ── Internal FSM states ───────────────────────────────────────────────────────

type TargetPhase = 'seeking' | 'settling' | 'settled';

// ── Median helper ─────────────────────────────────────────────────────────────

/**
 * Median of a non-empty array of numbers. Returns `null` for an empty array.
 * Uses a partial sort copy to avoid mutating the caller's buffer.
 */
function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null;
  }
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  return lo !== undefined && hi !== undefined ? (lo + hi) / 2 : null;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Construct a `NoteTrackerApi` for a given drill plan and option set.
 * A single call creates one drill run; call `reset()` to replay the same plan.
 *
 * @param plan  Ordered `DrillTarget[]` from C2's `drillPlan`. Must be non-empty.
 * @param options  Injected thresholds — see `TrackerOptions`.
 */
export function createNoteTracker(
  plan: readonly DrillTarget[],
  options: TrackerOptions,
): NoteTrackerApi {
  const { clarityThreshold, dwellMs, halfWidthCents } = options;
  const a4 = options.a4 ?? A4_DEFAULT;

  // ── Mutable state ──────────────────────────────────────────────────────────
  let trackerState: TrackerState = plan.length === 0 ? 'complete' : 'running';
  let currentTargetIndex = 0;
  let phase: TargetPhase = 'seeking';

  // Settling buffer: frames accumulated since the first settling frame.
  // Used to track dwell time. Cleared on settling→seeking reset.
  let settlingEntryMs: number | null = null; // timestamp of first settling frame

  // Settled buffer: cents values for scored frames (settled phase only).
  // Cleared on advance.
  const settledCents: number[] = [];

  // Accumulated results.
  const results: NoteResult[] = [];

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** True if `frame` is within the Hz acceptance band AND clarity AND octave guard. */
  function isInWindow(frame: RawFrame, target: DrillTarget): boolean {
    if (frame.clarity < clarityThreshold) return false;
    const cents = centsBetween(frame.hz, target.hz);
    if (cents === null) return false;
    if (Math.abs(cents) > halfWidthCents) return false;
    // Octave guard: the incoming pitch must round to the same MIDI note as the
    // target, not to a different octave of the same pitch class.
    const reading = noteFromFrequency(frame.hz, a4);
    if (reading === null) return false;
    if (reading.midi !== target.midiNote) return false;
    return true;
  }

  /** Emit a NoteResult for the current target and advance the index. */
  function advance(): NoteResult {
    // `advance()` is only reachable when `trackerState === 'running'` and
    // `currentTargetIndex < plan.length`, so this element is always present.
    // We guard via a runtime check rather than a non-null assertion.
    const target = plan[currentTargetIndex];
    if (target === undefined) {
      throw new Error(`noteTracker: advance() called with out-of-range index ${String(currentTargetIndex)}`);
    }
    const result: NoteResult = {
      targetIndex: currentTargetIndex,
      intendedHz: target.hz,
      medianCents: median(settledCents),
      frameCount: settledCents.length,
    };
    results.push(result);
    settledCents.length = 0;
    settlingEntryMs = null;
    phase = 'seeking';
    currentTargetIndex += 1;
    if (currentTargetIndex >= plan.length) {
      trackerState = 'complete';
    }
    return result;
  }

  /** Reset per-target transient state without touching results or index. */
  function clearTransient(): void {
    phase = 'seeking';
    settlingEntryMs = null;
    settledCents.length = 0;
  }

  // ── pushFrame ─────────────────────────────────────────────────────────────

  function pushFrame(frame: RawFrame): NoteResult | null {
    if (trackerState !== 'running') return null;

    const target = plan[currentTargetIndex];
    if (target === undefined) {
      // Shouldn't happen if state machine is correct, but guard defensively.
      trackerState = 'complete';
      return null;
    }

    const inWindow = isInWindow(frame, target);

    switch (phase) {
      case 'seeking': {
        if (inWindow) {
          phase = 'settling';
          settlingEntryMs = frame.timestampMs;
        }
        return null;
      }

      case 'settling': {
        if (!inWindow) {
          // Frame exited the band — reset dwell buffer, back to seeking.
          clearTransient();
          return null;
        }
        // Still in band — check if dwell threshold met.
        const elapsed = frame.timestampMs - (settlingEntryMs ?? frame.timestampMs);
        if (elapsed >= dwellMs) {
          // Dwell met: transition to settled. The settling frames are discarded
          // (attack-onset exclusion is the purpose of the three-state model).
          phase = 'settled';
          // Accumulate this frame's cents into the settled scoring band.
          const cents = centsBetween(frame.hz, target.hz);
          if (cents !== null) {
            settledCents.push(cents);
          }
        }
        // Still settling (dwell not yet met) — buffer not committed.
        return null;
      }

      case 'settled': {
        if (!inWindow) {
          // Frame exited: advance fires.
          return advance();
        }
        // Still in band: accumulate cents into settled scoring band.
        const cents = centsBetween(frame.hz, target.hz);
        if (cents !== null) {
          settledCents.push(cents);
        }
        return null;
      }
    }
  }

  // ── getState ──────────────────────────────────────────────────────────────

  function getState() {
    return {
      trackerState,
      currentTargetIndex,
      results: results as readonly NoteResult[],
    };
  }

  // ── reset ─────────────────────────────────────────────────────────────────

  function reset(): void {
    trackerState = plan.length === 0 ? 'complete' : 'running';
    currentTargetIndex = 0;
    results.length = 0;
    clearTransient();
  }

  return { pushFrame, getState, reset };
}
