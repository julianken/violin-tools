import { describe, it, expect } from 'vitest';

import {
  detectPitch,
  detectPitchDetailed,
  CLARITY_THRESHOLD,
  RMS_FLOOR,
  MIN_PITCH_HZ,
  MAX_PITCH_HZ,
} from './detectPitch.ts';

// This suite pins the §92 acceptance criteria with SYNTHESIZED buffers, so the
// detector is exercised end-to-end (RMS gate → NSDF → k-rule peak-pick →
// parabolic interpolation → clarity gate) on signals whose true fundamental we
// control. Everything random uses a SEEDED PRNG (mulberry32) — never Math.random
// or Date — so the suite is bit-for-bit reproducible and cannot flake. The two
// reference sample rates (44100 and 48000) are both covered per AC#1.

// ── mulberry32: a tiny, fast, seeded PRNG (public-domain, by Tommy Ettinger) ──
// Deterministic uniform [0, 1) from a 32-bit seed. Used for the noise fixtures so
// "white noise" means the *same* white noise on every run.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FFT_SIZE = 2048; // the ph4 AnalyserNode window the detector is designed for.

/** A pure sine of `freq` Hz at `sampleRate`, `length` samples, amplitude 0.8. */
function sine(freq: number, sampleRate: number, length = FFT_SIZE): Float32Array {
  const buf = new Float32Array(length);
  const w = (2 * Math.PI * freq) / sampleRate;
  for (let i = 0; i < length; i++) buf[i] = 0.8 * Math.sin(w * i);
  return buf;
}

/**
 * A sum-of-harmonics tone at `fundamental` Hz with per-partial amplitudes `amps`
 * (amps[0] = fundamental, amps[1] = 2nd partial, …), normalized to peak ≈ 0.8.
 * A random per-partial phase (seeded) keeps the waveform from being a degenerate
 * special case. This is the fixture that exposes octave errors: when the
 * fundamental is weaker than its partials, raw autocorrelation reports an octave.
 */
function harmonicTone(
  fundamental: number,
  sampleRate: number,
  amps: readonly number[],
  seed: number,
  length = FFT_SIZE,
): Float32Array {
  const rand = mulberry32(seed);
  const phases = amps.map(() => rand() * 2 * Math.PI);
  const raw = new Float32Array(length);
  let peak = 0;
  for (let i = 0; i < length; i++) {
    let s = 0;
    for (let k = 0; k < amps.length; k++) {
      const amp = amps[k] ?? 0;
      const phase = phases[k] ?? 0;
      s += amp * Math.sin((2 * Math.PI * fundamental * (k + 1) * i) / sampleRate + phase);
    }
    raw[i] = s;
    const mag = Math.abs(s);
    if (mag > peak) peak = mag;
  }
  const scale = peak > 0 ? 0.8 / peak : 0;
  for (let i = 0; i < length; i++) raw[i] = (raw[i] ?? 0) * scale;
  return raw;
}

/** Add seeded white noise of amplitude `noiseAmp` to a copy of `buf`. */
function addNoise(buf: Float32Array, noiseAmp: number, seed: number): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = (buf[i] ?? 0) + noiseAmp * (rand() * 2 - 1);
  }
  return out;
}

/**
 * Signed cents between a detected frequency and its target. Guards the `-1`
 * sentinel BEFORE the log2 (AC#5: never feed `-1` into log2 → NaN); a rejected
 * frame returns Infinity so a tolerance assert fails loudly instead of passing
 * on a NaN comparison.
 */
function centsError(detectedHz: number, targetHz: number): number {
  if (detectedHz <= 0 || targetHz <= 0) return Infinity;
  return 1200 * Math.log2(detectedHz / targetHz);
}

// The four open strings (equal temperament, A4 = 440).
const G3 = 196.0;
const D4 = 293.66;
const A4 = 440.0;
const E5 = 659.26;

const RATES = [44100, 48000] as const;

describe('detectPitch — pure sine fixtures (AC#1: ±5¢ at 44.1k and 48k)', () => {
  const notes: readonly { name: string; hz: number }[] = [
    { name: 'G3', hz: G3 },
    { name: 'D4', hz: D4 },
    { name: 'A4', hz: A4 },
    { name: 'E5', hz: E5 },
  ];
  for (const rate of RATES) {
    for (const { name, hz } of notes) {
      it(`detects ${name} (${String(hz)} Hz) within ±5¢ @ ${String(rate)}`, () => {
        const detected = detectPitch(sine(hz, rate), rate);
        expect(Math.abs(centsError(detected, hz))).toBeLessThanOrEqual(5);
      });
    }
  }
});

describe('detectPitch — octave-error regression (AC#2)', () => {
  it('A4 with fundamental WEAKER than 2nd/3rd partials returns ≈440 (not 880), ±10¢', () => {
    // aₖ ≈ 1/k for the partials, but the fundamental is deliberately suppressed
    // BELOW the 2nd and 3rd partials — the classic case where autocorrelation /
    // FFT-peak methods lock onto a partial and report an octave (or twelfth) up.
    // MPM's NSDF + k=0.9 first-key-maximum rule must still pick the fundamental.
    const amps = [0.25, 1.0, 0.66, 0.4, 0.25, 0.15];
    for (const rate of RATES) {
      const detected = detectPitch(harmonicTone(A4, rate, amps, 0xa4a4), rate);
      expect(Math.abs(centsError(detected, A4))).toBeLessThanOrEqual(10);
      // Explicitly assert it did NOT lock an octave up (the failure mode).
      expect(Math.abs(centsError(detected, 2 * A4))).toBeGreaterThan(10);
    }
  });
});

describe('detectPitch — low-G3 harmonic-rich fixture (AC#3)', () => {
  it('harmonic-rich G3 (196 Hz) detects ≈196 within ±10¢, both rates', () => {
    // A bright low G: strong fundamental plus a full partial series. The window
    // (2048 samples) holds ≥2 periods of 196 Hz at both rates and the lag clamp
    // reaches G3 — verifies the range bound holds at the low end.
    const amps = [1.0, 0.8, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2];
    for (const rate of RATES) {
      const detected = detectPitch(harmonicTone(G3, rate, amps, 0x6303), rate);
      expect(Math.abs(centsError(detected, G3))).toBeLessThanOrEqual(10);
    }
  });
});

describe('detectPitch — tone + seeded noise (AC#4: moderate SNR within ±25¢)', () => {
  it('A4 harmonic tone + moderate white noise still detects within ±25¢', () => {
    for (const rate of RATES) {
      const tone = harmonicTone(A4, rate, [1.0, 0.5, 0.33, 0.25], 0x440f);
      // Noise amplitude 0.15 against a ~0.8-peak tone — audible but moderate SNR.
      const noisy = addNoise(tone, 0.15, 0x0015);
      const detected = detectPitch(noisy, rate);
      expect(Math.abs(centsError(detected, A4))).toBeLessThanOrEqual(25);
    }
  });
});

describe('detectPitch — gate rejects BOTH noise-floor AND silence (AC#4, #92 SUGGESTION)', () => {
  // AC#7 of the #92 review bundled two facts into one line; assert them
  // SEPARATELY so a regression in either gate is pinned independently.
  it('very-low-SNR / pure noise returns -1 (clarity gate)', () => {
    for (const rate of RATES) {
      // No tone at all — just seeded broadband noise above the RMS floor. Loud
      // enough to pass the silence gate, aperiodic enough that the clarity gate
      // must reject it.
      const rand = mulberry32(0x4015);
      const noise = new Float32Array(FFT_SIZE);
      for (let i = 0; i < FFT_SIZE; i++) noise[i] = 0.3 * (rand() * 2 - 1);
      expect(detectPitch(noise, rate)).toBe(-1);
    }
  });

  it('pure silence (all zeros) returns -1 (RMS silence gate)', () => {
    for (const rate of RATES) {
      const silence = new Float32Array(FFT_SIZE); // all zeros
      expect(detectPitch(silence, rate)).toBe(-1);
    }
  });

  it('near-silent buffer just below the RMS floor returns -1', () => {
    for (const rate of RATES) {
      // A real 440 Hz tone but scaled to an RMS just under RMS_FLOOR.
      const tone = sine(A4, rate);
      const targetRms = RMS_FLOOR * 0.5;
      // sine() has amplitude 0.8 ⇒ RMS 0.8/√2; scale to land below the floor.
      const scale = targetRms / (0.8 / Math.SQRT2);
      const quiet = new Float32Array(tone.length);
      for (let i = 0; i < tone.length; i++) quiet[i] = (tone[i] ?? 0) * scale;
      expect(detectPitch(quiet, rate)).toBe(-1);
    }
  });
});

describe('detectPitchDetailed — clarity metric & contract', () => {
  it('reports clarity ≥ CLARITY_THRESHOLD on a clean tone and 0 on rejection', () => {
    const clean = detectPitchDetailed(sine(A4, 44100), 44100);
    expect(clean.hz).toBeGreaterThan(0);
    expect(clean.clarity).toBeGreaterThanOrEqual(CLARITY_THRESHOLD);
    expect(clean.clarity).toBeLessThanOrEqual(1);

    const rejected = detectPitchDetailed(new Float32Array(FFT_SIZE), 44100);
    expect(rejected.hz).toBe(-1);
    expect(rejected.clarity).toBe(0);
  });

  it('AC#5: the cents helper guards the -1 sentinel before log2 (no NaN)', () => {
    // The sentinel must never reach log2. centsError returns Infinity for -1,
    // which is a finite-comparable value (NOT NaN) so an assert fails cleanly.
    expect(Number.isNaN(centsError(-1, A4))).toBe(false);
    expect(centsError(-1, A4)).toBe(Infinity);
  });
});

describe('detectPitch — determinism & purity (AC#6)', () => {
  it('same input → same output (deterministic)', () => {
    const buf = harmonicTone(D4, 48000, [1.0, 0.6, 0.4], 0xd4d4);
    expect(detectPitch(buf, 48000)).toBe(detectPitch(buf, 48000));
  });

  it('exposes the tunable range constants for the violin clamp', () => {
    expect(MIN_PITCH_HZ).toBe(196);
    expect(MAX_PITCH_HZ).toBe(2637);
  });
});
