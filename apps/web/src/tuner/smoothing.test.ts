// Unit tests for the pure Tuner smoothing/hysteresis layer (S18 ph3, epic #90).
//
// The smoother is a deterministic state machine over a sequence of detector
// frames, so every test crafts a frame sequence and asserts on the emitted
// readouts — no audio, no DOM, no timers. Frequencies are derived from ph1's
// `frequencyOfMidi` so the fixtures stay anchored to the same equal-temperament
// math the smoother resolves against (A4 = 440 ⇒ A4 = MIDI 69 = 440 Hz, the
// octave A5 = MIDI 81 = 880 Hz, etc.), rather than hand-typed magic Hz values.

import { frequencyOfMidi, A4_DEFAULT } from '@violin-tools/theory';
import { describe, it, expect } from 'vitest';

import {
  createTunerSmoother,
  IN_TUNE_CENTS,
  DEFAULT_MEDIAN_WINDOW,
  DEFAULT_LABEL_PERSIST_FRAMES,
  type Frame,
  type Readout,
} from './smoothing.ts';

/** MIDI numbers used across the fixtures. */
const A4_MIDI = 69; // A4 = 440 Hz at A4_DEFAULT
const A5_MIDI = 81; // A5 = 880 Hz — one octave above A4 (the classic octave-error)
const ASHARP4_MIDI = 70; // A♯4 — the chromatic neighbour above A4

/** Hz of a MIDI note (possibly fractional) at the default A4. */
const hzOf = (midi: number): number => frequencyOfMidi(midi, A4_DEFAULT);

/** A clean, confident frame at a given MIDI note (clarity well above the 0.7 gate). */
const frameAt = (midi: number, clarity = 0.95): Frame => ({ hz: hzOf(midi), clarity });

/** Hz a given number of cents sharp/flat of a MIDI note. */
const hzCentsFrom = (midi: number, cents: number): number => frequencyOfMidi(midi + cents / 100, A4_DEFAULT);

/** Feed a whole sequence into a fresh smoother and collect the readouts (null = frozen). */
function run(frames: readonly Frame[], options?: Parameters<typeof createTunerSmoother>[0]): (Readout | null)[] {
  const smoother = createTunerSmoother(options);
  return frames.map((f) => smoother.push(f));
}

describe('createTunerSmoother — gate (stage 1)', () => {
  it('returns null for a frame below the clarity threshold (frozen, not smoothed)', () => {
    const smoother = createTunerSmoother();
    expect(smoother.push({ hz: hzOf(A4_MIDI), clarity: 0.3 })).toBeNull();
  });

  it('returns null for the ph2 hz<=0 sentinel', () => {
    const smoother = createTunerSmoother();
    expect(smoother.push({ hz: -1, clarity: 0 })).toBeNull();
    expect(smoother.push({ hz: 0, clarity: 0.99 })).toBeNull();
  });

  it('a gated frame does not disturb the running readout of surrounding good frames', () => {
    // Steady A4, one gated frame in the middle, then A4 again. The gated frame is
    // a null (freeze); the good frames either side still read A4 in-tune.
    const frames: Frame[] = [
      frameAt(A4_MIDI),
      frameAt(A4_MIDI),
      { hz: -1, clarity: 0 }, // gated
      frameAt(A4_MIDI),
      frameAt(A4_MIDI),
    ];
    const out = run(frames);
    expect(out[2]).toBeNull();
    for (const i of [0, 1, 3, 4]) {
      expect(out[i]).not.toBeNull();
      expect(out[i]?.note).toBe('A');
      expect(out[i]?.octave).toBe(4);
    }
  });
});

describe('createTunerSmoother — median rejects a single octave outlier (AC1)', () => {
  it('one bad A5 frame inside a steady A4 sequence never flips the emitted note/octave', () => {
    // A long steady A4 run with a single octave-up (A5) impulse partway through.
    // The median window discards the lone 1200¢ spike, so no readout ever shows A5.
    const frames: Frame[] = [];
    for (let i = 0; i < 6; i++) frames.push(frameAt(A4_MIDI));
    frames.push(frameAt(A5_MIDI)); // the single bad octave frame
    for (let i = 0; i < 6; i++) frames.push(frameAt(A4_MIDI));

    const out = run(frames);
    for (const r of out) {
      expect(r).not.toBeNull();
      expect(r?.note).toBe('A');
      expect(r?.octave).toBe(4); // never 5 — the octave outlier is rejected
    }
  });
});

describe('createTunerSmoother — label hysteresis dead-band/persistence (AC2)', () => {
  it('does not switch label for a brief wander just past the 50¢ midpoint that returns', () => {
    // Hold A4, wander to ~+60¢ (just into A♯4 territory) for ONE frame — below the
    // persistence threshold and the EMA keeps it short of the dead-band — then
    // return to A4. The label must stay A the whole time.
    const wanderHz = hzCentsFrom(A4_MIDI, 60); // ~60¢ sharp of A4 = ~40¢ flat of A♯4
    const frames: Frame[] = [
      frameAt(A4_MIDI),
      frameAt(A4_MIDI),
      frameAt(A4_MIDI),
      { hz: wanderHz, clarity: 0.95 }, // a single brief excursion past the midpoint
      frameAt(A4_MIDI),
      frameAt(A4_MIDI),
      frameAt(A4_MIDI),
    ];
    const out = run(frames);
    for (const r of out) {
      expect(r).not.toBeNull();
      expect(r?.note).toBe('A');
      expect(r?.octave).toBe(4);
    }
  });

  it('does switch label once a new note persists past the persistence threshold', () => {
    // Establish A4, then sustain A♯4 long enough to clear both the median lag and
    // the persistence count — the label must move to A♯.
    const frames: Frame[] = [];
    for (let i = 0; i < DEFAULT_MEDIAN_WINDOW; i++) frames.push(frameAt(A4_MIDI));
    for (let i = 0; i < DEFAULT_MEDIAN_WINDOW + DEFAULT_LABEL_PERSIST_FRAMES + 2; i++) {
      frames.push(frameAt(ASHARP4_MIDI));
    }
    const out = run(frames);
    const last = out.at(-1);
    expect(last).not.toBeNull();
    expect(last?.note).toBe('A♯');
    expect(last?.octave).toBe(4);
    // And the very first readout was A (it didn't switch instantly on frame 1 of A♯).
    expect(out[0]?.note).toBe('A');
  });
});

describe('createTunerSmoother — held-note jitter stays in tune (AC3, AC4)', () => {
  it('A4 ± small noise stays inTune with bounded |cents| throughout', () => {
    // A seeded, deterministic small-noise sequence around A4 (±3¢). After the
    // median+EMA settle, every emitted readout should be the A4 note, inTune, with
    // |cents| within a small bound.
    const seededNoise = [2, -1, 3, -2, 1, -3, 2, 0, -1, 2, -2, 1, 3, -1, -2, 0];
    const frames: Frame[] = seededNoise.map((c) => ({ hz: hzCentsFrom(A4_MIDI, c), clarity: 0.95 }));

    const out = run(frames);
    // Allow the very first frame to seed; assert on the settled tail.
    const settled = out.slice(2);
    for (const r of settled) {
      expect(r).not.toBeNull();
      expect(r?.note).toBe('A');
      expect(r?.octave).toBe(4);
      expect(r?.inTune).toBe(true);
      expect(Math.abs(r?.cents ?? 99)).toBeLessThanOrEqual(IN_TUNE_CENTS);
    }
  });

  it('inTune is true iff |cents| <= IN_TUNE_CENTS', () => {
    // A steady pitch exactly +IN_TUNE_CENTS sharp is in tune (boundary inclusive);
    // a steady pitch well past it (+20¢) is not. Feed each as a long steady run so
    // the EMA fully converges to that offset.
    const atBoundary = Array.from({ length: 20 }, () => ({
      hz: hzCentsFrom(A4_MIDI, IN_TUNE_CENTS),
      clarity: 0.95,
    }));
    const wellSharp = Array.from({ length: 20 }, () => ({
      hz: hzCentsFrom(A4_MIDI, 20),
      clarity: 0.95,
    }));

    const atBoundaryOut = run(atBoundary).at(-1);
    expect(atBoundaryOut?.inTune).toBe(true);
    expect(Math.abs(atBoundaryOut?.cents ?? 0)).toBeLessThanOrEqual(IN_TUNE_CENTS + 1e-6);

    const wellSharpOut = run(wellSharp).at(-1);
    expect(wellSharpOut?.inTune).toBe(false);
    expect(wellSharpOut?.cents ?? 0).toBeGreaterThan(IN_TUNE_CENTS);
  });
});

describe('createTunerSmoother — purity & reset (AC5, AC6)', () => {
  it('is deterministic: the same sequence yields the same outputs', () => {
    const seq: Frame[] = [
      frameAt(A4_MIDI),
      frameAt(A5_MIDI),
      frameAt(A4_MIDI),
      { hz: -1, clarity: 0 },
      frameAt(ASHARP4_MIDI),
      frameAt(ASHARP4_MIDI),
    ];
    expect(run(seq)).toEqual(run(seq));
  });

  it('reset() clears state so a re-fed sequence reproduces the first run', () => {
    const seq: Frame[] = [frameAt(A4_MIDI), frameAt(A4_MIDI), frameAt(ASHARP4_MIDI)];
    const smoother = createTunerSmoother();
    const first = seq.map((f) => smoother.push(f));
    smoother.reset();
    const second = seq.map((f) => smoother.push(f));
    expect(second).toEqual(first);
  });

  it('reports the cents as a single signed field (negative = flat, positive = sharp)', () => {
    // A steady run flat of A4 reads a negative cents; a steady run sharp reads
    // positive — confirming the single signed `cents` contract (no separate
    // signedCents field), matching ph1's signed cents.
    const flat = run(Array.from({ length: 20 }, () => ({ hz: hzCentsFrom(A4_MIDI, -8), clarity: 0.95 }))).at(-1);
    const sharp = run(Array.from({ length: 20 }, () => ({ hz: hzCentsFrom(A4_MIDI, 8), clarity: 0.95 }))).at(-1);
    expect(flat?.cents).toBeLessThan(0);
    expect(sharp?.cents).toBeGreaterThan(0);
  });
});

describe('createTunerSmoother — nearestString passthrough', () => {
  it('reports A4 as the nearest open string when holding A4', () => {
    const out = run(Array.from({ length: 10 }, () => frameAt(A4_MIDI))).at(-1);
    expect(out?.nearestString).toBe('A4');
  });
});
