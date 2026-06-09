// Pitch detector — the pure DSP heart of the Tuner (S18 ph2, epic #90).
//
// Given a window of time-domain audio samples, estimate the fundamental
// frequency in Hz. This module is PURE: no React, no DOM, no Web Audio — it
// takes a Float32Array + sampleRate and returns a number, so the whole detector
// is unit-testable with synthesized buffers (the audio shell that feeds it real
// mic frames is ph4). Stateless and deterministic: same input → same output.
//
// Algorithm — the McLeod Pitch Method (MPM). It computes the Normalized Square
// Difference Function (NSDF) over a range of lags, then peak-picks the first
// "key maximum" that clears a fraction k of the highest maximum. NSDF + the
// k-rule is what gives MPM its octave-error resistance (raw autocorrelation
// happily locks onto a strong 2nd/3rd partial and reports an octave too high)
// and a free per-frame confidence (the NSDF value at the peak ∈ [−1, 1]). The
// sub-sample period is then refined by parabolic interpolation through the three
// samples around the chosen lag — integer-sample period quantization is ~9¢ at
// A4 and ~18¢ at E5 @48k, well past a tuner's budget, so this step is mandatory.
//
// Technique (copied, NOT a dependency — the deep-dive verified the npm options
// are unusable: `ml-pitch` is a 404 slopsquat, `pitchfinder` is GPL-3,
// `aubiojs` a license trap):
//   • McLeod & Wyvill, "A Smarter Way to Find Pitch" (ICMC 2005) — the NSDF,
//     the key-maximum definition, and the k·max peak-pick.
//   • MIT-licensed `cwilso/PitchDetect` (github.com/cwilso/PitchDetect) — the
//     three-point parabolic-interpolation refinement of the chosen lag.

/**
 * Clarity (NSDF peak value) at or above which a frame is accepted as a confident
 * pitch. NSDF peaks run [0, 1] for a periodic signal (1 = perfectly periodic);
 * noise/silence stay well below. Exported so ph3/tests reuse the exact threshold
 * rather than re-deriving it; the live smoother is wired to this constant
 * (`useTuner.ts`) so the two gates cannot drift.
 *
 * 0.5 (was 0.7, the §90 deep-dive's initial value). This is the BINDING gate —
 * not the energy floor. Because McLeod NSDF normalization makes clarity
 * amplitude-INVARIANT, it scores periodicity/SNR, not loudness, so a quiet
 * normally-bowed violin on a built-in mic (we keep `autoGainControl` OFF for
 * pitch accuracy → low capture level → moderate SNR) scored just under 0.7 and
 * was rejected — the reported "needs loud input to pick up" symptom (#105). The
 * looser 0.5 admits those frames; it is safe because (a) the chosen lag is still
 * octave-protected by the k=0.9 key-maximum rule, (b) the smoother's 5-frame
 * median + 4-frame label persistence absorb the occasional marginal frame the
 * looser gate admits, and (c) room noise is APERIODIC, so its NSDF peak sits far
 * below 0.5 (measured: pure-broadband-noise fixture yields no peak at all →
 * still rejected). Tunable; a future clarity-hysteresis follow-up may split it
 * into acquire/sustain thresholds.
 */
export const CLARITY_THRESHOLD = 0.5;

/**
 * Root-mean-square energy floor. Frames quieter than this are treated as silence
 * and rejected BEFORE the O(N²) NSDF runs (the cheap-frame requirement) — this is
 * the silence gate, distinct from the clarity gate that rejects loud-but-aperiodic
 * noise. −60 dBFS relative to a full-scale sine (RMS 1/√2 ≈ 0.707): 0.707·10^(−60/20)
 * ≈ 7.07e-4. Mic self-noise and room tone sit below this; a bowed string is orders
 * of magnitude above it. Tunable.
 */
export const RMS_FLOOR = 7.07e-4;

/**
 * Violin pitch range used to clamp candidate periods, so the detector cannot
 * lock onto a sub-harmonic (period too long → octave-down error) or a partial
 * (period too short → octave-up error). G3 (open G ≈ 196 Hz) is the lowest note
 * the instrument produces; E7 (≈ 2637 Hz) caps the playable top of the E string.
 * The search runs only over lags whose implied frequency lands in [196, 2637].
 */
export const MIN_PITCH_HZ = 196; // G3 — lowest open string
export const MAX_PITCH_HZ = 2637; // E7 — top of the violin range

/** The fraction of the highest NSDF maximum a key maximum must clear (MPM `k`). */
const PEAK_THRESHOLD_K = 0.9;

/** Sentinel returned when no confident pitch is found (silence, noise, or no peak). */
const NO_PITCH = -1;

/** A confident-pitch result; `hz` is `-1` when the frame is rejected. */
export interface PitchResult {
  /** Fundamental frequency in Hz, or `-1` (`NO_PITCH`) when no confident pitch. */
  hz: number;
  /** NSDF clarity at the chosen peak ∈ [0, 1]; `0` when the frame is rejected. */
  clarity: number;
}

/**
 * Estimate the fundamental of `buf` (time-domain samples) at `sampleRate` Hz.
 *
 * Returns the frequency in Hz, or `-1` when the frame is silent, too noisy, or
 * has no NSDF peak clearing the clarity gate. This is the thin convenience entry
 * point; `detectPitchDetailed` exposes the clarity alongside the Hz for ph3 and
 * the tests.
 */
export function detectPitch(buf: Float32Array, sampleRate: number): number {
  return detectPitchDetailed(buf, sampleRate).hz;
}

/**
 * Estimate the fundamental of `buf`, returning both the Hz and the NSDF clarity.
 *
 * The clarity is the NSDF value at the chosen peak (∈ [0, 1] for a real pitch);
 * ph3's smoothing keys its confidence weighting off it. On rejection `hz` is
 * `-1` and `clarity` is `0`.
 */
export function detectPitchDetailed(
  buf: Float32Array,
  sampleRate: number,
): PitchResult {
  const n = buf.length;

  // ── 1. RMS energy gate (silence early-out, before the O(N²) NSDF) ──────────
  // Sum the squared samples once; if the window's RMS is below the floor the
  // frame is silence and we skip the expensive NSDF entirely.
  let sumSquares = 0;
  for (let i = 0; i < n; i++) {
    const s = buf[i] ?? 0;
    sumSquares += s * s;
  }
  if (n === 0 || Math.sqrt(sumSquares / n) < RMS_FLOOR) {
    return { hz: NO_PITCH, clarity: 0 };
  }

  // ── 2. Lag range from the violin clamp ─────────────────────────────────────
  // period = sampleRate / frequency. A higher frequency ⇒ a shorter period, so
  // MAX_PITCH_HZ gives the shortest acceptable lag and MIN_PITCH_HZ the longest.
  // These bounds gate which key-maximum lags count as a *pitch candidate*; the
  // NSDF itself is still computed from lag 1 (below) so the run detector can see
  // the central lobe descend through zero before the first periodic peak. Clamp
  // the long lag to n−1 (need the lag inside the window) and the short lag to ≥1.
  const minLag = Math.max(1, Math.floor(sampleRate / MAX_PITCH_HZ));
  const maxLag = Math.min(n - 1, Math.ceil(sampleRate / MIN_PITCH_HZ));
  if (maxLag <= minLag) {
    // The window is too short to hold a full period of the lowest pitch.
    return { hz: NO_PITCH, clarity: 0 };
  }

  // ── 3. NSDF from lag 1 up to the clamp's long lag ──────────────────────────
  // For each lag τ: r(τ) = Σ x[i]·x[i+τ] is the autocorrelation, and
  // m(τ) = Σ (x[i]² + x[i+τ]²) is the summed squared magnitude over the same
  // window. NSDF n'(τ) = 2·r(τ) / m(τ) ∈ [−1, 1]; a value near 1 means the
  // signal at offset τ closely matches itself (a period of τ samples). We start
  // at lag 1 (NOT the clamp's short lag) so the broad central lobe around lag 0
  // — which is always near 1 and is NOT a pitch — descends through its first
  // negative-going zero crossing before any key maximum is collected (§4).
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let acf = 0;
    let mag = 0;
    const limit = n - lag;
    for (let i = 0; i < limit; i++) {
      const a = buf[i] ?? 0;
      const b = buf[i + lag] ?? 0;
      acf += a * b;
      mag += a * a + b * b;
    }
    nsdf[lag] = mag > 0 ? (2 * acf) / mag : 0;
  }

  // ── 4. Peak-pick: the first key maximum clearing k·(highest maximum) ───────
  // A "key maximum" is the largest NSDF value within a positively-sloped run that
  // ends at a negative-going zero crossing (McLeod §5). Collection begins only
  // AFTER the NSDF first drops below zero — McLeod's rule that skips the central
  // lobe (the un-pitched high plateau at small lags). We collect one candidate
  // per run, but a key-maximum lag OUTSIDE the violin clamp [minLag, maxLag] is
  // not a pitch candidate, so it is dropped. The chosen pitch is the FIRST kept
  // candidate whose NSDF clears k·(the global highest kept candidate) — the
  // k-rule that rejects the taller-but-shorter-lag partial peaks responsible for
  // octave-up errors.
  const peakLags: number[] = [];
  let highestPeak = -Infinity;
  let runMaxLag = -1;
  let runMaxValue = -Infinity;
  let inPositiveZone = false;
  let seenNegative = false; // gate: no peaks until the central lobe descends < 0

  const recordRun = (): void => {
    // A key maximum only counts as a candidate if its lag is in the clamp.
    if (runMaxLag >= minLag && runMaxLag <= maxLag) {
      peakLags.push(runMaxLag);
      if (runMaxValue > highestPeak) highestPeak = runMaxValue;
    }
  };

  for (let lag = 1; lag <= maxLag; lag++) {
    const value = nsdf[lag] ?? 0;
    if (value < 0) {
      seenNegative = true;
    }
    if (!seenNegative) {
      // Still inside the central lobe — not yet eligible for key maxima.
      continue;
    }
    if (!inPositiveZone) {
      // Wait for the NSDF to rise above zero (start of a positive run).
      if (value > 0) {
        inPositiveZone = true;
        runMaxLag = lag;
        runMaxValue = value;
      }
    } else if (value > 0) {
      // Inside a positive run — track its maximum.
      if (value > runMaxValue) {
        runMaxValue = value;
        runMaxLag = lag;
      }
    } else {
      // Negative-going zero crossing closes the run — record its key maximum.
      if (runMaxLag >= 0) recordRun();
      inPositiveZone = false;
      runMaxLag = -1;
      runMaxValue = -Infinity;
    }
  }
  // A run still open at the end of the range (no closing crossing) still counts.
  if (inPositiveZone && runMaxLag >= 0) recordRun();

  if (peakLags.length === 0 || highestPeak <= 0) {
    return { hz: NO_PITCH, clarity: 0 };
  }

  const threshold = PEAK_THRESHOLD_K * highestPeak;
  let chosenLag = -1;
  for (const lag of peakLags) {
    if ((nsdf[lag] ?? 0) >= threshold) {
      chosenLag = lag;
      break;
    }
  }
  if (chosenLag < 0) {
    return { hz: NO_PITCH, clarity: 0 };
  }

  // ── 5. Parabolic interpolation for the sub-sample period ───────────────────
  // Fit a parabola through (lag−1, lag, lag+1) NSDF values and take its vertex.
  // The refined lag is τ + ½·(α − γ)/(α − 2β + γ) for samples α, β, γ; the peak
  // value at the vertex is the interpolated clarity. Guard the window edges so
  // the neighbour reads stay in range (NSDF is filled lag 1 … maxLag).
  const beta = nsdf[chosenLag] ?? 0;
  let refinedLag = chosenLag;
  let clarity = beta;
  if (chosenLag > 1 && chosenLag < maxLag) {
    const alpha = nsdf[chosenLag - 1] ?? 0;
    const gamma = nsdf[chosenLag + 1] ?? 0;
    const denom = alpha - 2 * beta + gamma;
    if (denom !== 0) {
      const shift = (0.5 * (alpha - gamma)) / denom;
      // A valid vertex shift is within ±1 sample; ignore a degenerate fit.
      if (shift > -1 && shift < 1) {
        refinedLag = chosenLag + shift;
        clarity = beta - 0.25 * (alpha - gamma) * shift;
      }
    }
  }

  // ── 6. Clarity gate ────────────────────────────────────────────────────────
  // Reject loud-but-aperiodic frames (noise): the chosen peak must be a strong
  // match, not just the best of a bad lot. Clamp the reported clarity to [0, 1]
  // (interpolation can nudge it a hair past 1 on a near-perfect periodic frame).
  const reportedClarity = clarity > 1 ? 1 : clarity < 0 ? 0 : clarity;
  if (reportedClarity < CLARITY_THRESHOLD || refinedLag <= 0) {
    return { hz: NO_PITCH, clarity: 0 };
  }

  return { hz: sampleRate / refinedLag, clarity: reportedClarity };
}
