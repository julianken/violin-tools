import { describe, it, expect } from 'vitest';

import {
  A4_MIN,
  A4_MAX,
  A4_DEFAULT,
  clampA4,
  frequencyOfMidi,
  frequencyOfNote,
  centsBetween,
  noteFromFrequency,
  OPEN_STRINGS,
  openStringFrequencies,
  nearestOpenString,
} from './tuning.ts';

// This suite pins the tuning math to #91's acceptance criteria. Where a value is
// independently derivable, an inline reference (computed from the equal-temperament
// formula, NOT the production helper) cross-checks the result, so a regression in
// the production code is caught rather than tautologically confirmed.

/** Reference: f = a4 · 2^((n − 69) / 12). Independent of the production code. */
function refFreqOfMidi(n: number, a4: number): number {
  return a4 * 2 ** ((n - 69) / 12);
}

describe('A4 calibration constants & clamp', () => {
  it('exposes the §90/#91 range 415–446, default 440', () => {
    expect(A4_MIN).toBe(415);
    expect(A4_MAX).toBe(446);
    expect(A4_DEFAULT).toBe(440);
  });

  it('clampA4 passes through in-range, clamps out-of-range', () => {
    expect(clampA4(440)).toBe(440);
    expect(clampA4(415)).toBe(415);
    expect(clampA4(446)).toBe(446);
    expect(clampA4(400)).toBe(A4_MIN);
    expect(clampA4(500)).toBe(A4_MAX);
  });

  it('out-of-range a4 is clamped before the math, not passed through', () => {
    // A4 at a4=500 must clamp to 446, not return 500.
    expect(frequencyOfMidi(69, 500)).toBeCloseTo(446, 10);
    expect(frequencyOfMidi(69, 400)).toBeCloseTo(415, 10);
  });
});

describe('frequencyOfMidi / frequencyOfNote', () => {
  it('A4 (MIDI 69) at 440 is exactly 440', () => {
    expect(frequencyOfMidi(69, 440)).toBeCloseTo(440, 10);
    expect(frequencyOfNote(9, 4, 440)).toBeCloseTo(440, 10);
  });

  it('one octave up doubles the frequency', () => {
    expect(frequencyOfMidi(81, 440)).toBeCloseTo(880, 10);
  });

  it('agrees with an independent reference across the violin range', () => {
    for (let n = 55; n <= 100; n++) {
      expect(frequencyOfMidi(n, 440)).toBeCloseTo(refFreqOfMidi(n, 440), 9);
    }
  });

  // AC #3 — open-string Hz fixtures at A4=440, within 0.01 Hz, via frequencyOfNote.
  it('open-string fixtures at A4=440 (within 0.01 Hz)', () => {
    expect(frequencyOfNote(7, 3, 440)).toBeCloseTo(196.0, 2); // G3
    expect(frequencyOfNote(2, 4, 440)).toBeCloseTo(293.66, 2); // D4
    expect(frequencyOfNote(9, 4, 440)).toBeCloseTo(440, 2); // A4
    expect(frequencyOfNote(4, 5, 440)).toBeCloseTo(659.26, 2); // E5
  });

  // AC #4 — non-440 reference re-derives correctly.
  it('A4 at a4=442 is 442; open-string targets scale proportionally', () => {
    expect(frequencyOfNote(9, 4, 442)).toBeCloseTo(442, 10);
    // G3 at 442 = G3 at 440 × (442/440).
    expect(frequencyOfMidi(55, 442)).toBeCloseTo(frequencyOfMidi(55, 440) * (442 / 440), 9);
  });
});

describe('centsBetween', () => {
  it('equal frequencies are 0 cents', () => {
    expect(centsBetween(440, 440)).toBe(0);
  });

  it('one octave up is +1200, one octave down is −1200', () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 9);
    expect(centsBetween(220, 440)).toBeCloseTo(-1200, 9);
  });

  it('a semitone up is ≈ +100 cents', () => {
    expect(centsBetween(frequencyOfMidi(70, 440), 440)).toBeCloseTo(100, 9);
  });

  it('non-positive operands return null without NaN', () => {
    expect(centsBetween(0, 440)).toBeNull();
    expect(centsBetween(-10, 440)).toBeNull();
    expect(centsBetween(440, 0)).toBeNull();
    expect(centsBetween(440, -1)).toBeNull();
  });
});

describe('noteFromFrequency', () => {
  // AC #1 — 440 at A4=440 → A4, 0 cents.
  it('440 at A4=440 → name A, octave 4, ≈ 0 cents', () => {
    const r = noteFromFrequency(440, 440);
    expect(r).not.toBeNull();
    expect(r?.name).toBe('A');
    expect(r?.octave).toBe(4);
    expect(r?.pc).toBe(9);
    expect(r?.midi).toBe(69);
    expect(Math.abs(r?.cents ?? Infinity)).toBeLessThan(0.01);
  });

  // AC #2 — signed cents: sharp input positive, flat input negative.
  it('442 at A4=440 → A4 ≈ +7.85 cents', () => {
    const r = noteFromFrequency(442, 440);
    expect(r?.name).toBe('A');
    expect(r?.octave).toBe(4);
    expect(r?.cents).toBeCloseTo(7.85, 2);
  });

  it('a flat input returns negative cents (signed)', () => {
    const r = noteFromFrequency(438, 440);
    expect(r?.name).toBe('A');
    expect(r?.octave).toBe(4);
    expect(r?.cents).toBeLessThan(0);
    expect(r?.cents).toBeCloseTo(-7.89, 2);
  });

  it('uses fixed-sharp naming, never flats (no key context)', () => {
    // The note a semitone above A4 is A♯4 here — never B♭4 (that is spell()'s job).
    const r = noteFromFrequency(frequencyOfMidi(70, 440), 440);
    expect(r?.name).toBe('A♯');
    expect(r?.pc).toBe(10);
    expect(r?.octave).toBe(4);
  });

  it('resolves each open string to the right note/octave at A4=440', () => {
    expect(noteFromFrequency(frequencyOfMidi(55, 440), 440)?.name).toBe('G');
    expect(noteFromFrequency(frequencyOfMidi(55, 440), 440)?.octave).toBe(3);
    expect(noteFromFrequency(frequencyOfMidi(76, 440), 440)?.name).toBe('E');
    expect(noteFromFrequency(frequencyOfMidi(76, 440), 440)?.octave).toBe(5);
  });

  it('middle C (MIDI 60) names C octave 4', () => {
    const r = noteFromFrequency(frequencyOfMidi(60, 440), 440);
    expect(r?.name).toBe('C');
    expect(r?.octave).toBe(4);
    expect(r?.midi).toBe(60);
  });

  it('cents stay within ±50 by construction across a sweep', () => {
    for (let f = 180; f <= 700; f += 0.37) {
      const r = noteFromFrequency(f, 440);
      expect(r).not.toBeNull();
      expect(Math.abs(r?.cents ?? Infinity)).toBeLessThanOrEqual(50.0000001);
    }
  });

  it('reading round-trips: the named note re-derives ≈ the input within its cents', () => {
    const f = 455;
    const r = noteFromFrequency(f, 440);
    expect(r).not.toBeNull();
    const nominal = frequencyOfMidi(r?.midi ?? 0, 440);
    expect(centsBetween(f, nominal)).toBeCloseTo(r?.cents ?? Infinity, 6);
  });

  // AC #6 — f ≤ 0 returns the documented null sentinel, no throw / NaN.
  it('f ≤ 0 returns null without throwing or producing NaN', () => {
    expect(noteFromFrequency(0, 440)).toBeNull();
    expect(noteFromFrequency(-5, 440)).toBeNull();
    expect(() => noteFromFrequency(0, 440)).not.toThrow();
  });
});

describe('open strings', () => {
  it('OPEN_STRINGS carries the §12.1 MIDI numbers low-to-high', () => {
    expect(OPEN_STRINGS.map((s) => s.name)).toEqual(['G3', 'D4', 'A4', 'E5']);
    expect(OPEN_STRINGS.map((s) => s.midi)).toEqual([55, 62, 69, 76]);
  });

  // AC #3 — open-string frequency fixtures at A4=440 within 0.01 Hz.
  it('openStringFrequencies at A4=440 (within 0.01 Hz)', () => {
    const t = openStringFrequencies(440);
    expect(t.G3).toBeCloseTo(196.0, 2);
    expect(t.D4).toBeCloseTo(293.66, 2);
    expect(t.A4).toBeCloseTo(440, 2);
    expect(t.E5).toBeCloseTo(659.26, 2);
  });

  // AC #4 — targets scale proportionally at a non-440 reference.
  it('openStringFrequencies scales proportionally at A4=442', () => {
    const t440 = openStringFrequencies(440);
    const t442 = openStringFrequencies(442);
    expect(t442.A4).toBeCloseTo(442, 10);
    for (const name of ['G3', 'D4', 'A4', 'E5'] as const) {
      expect(t442[name]).toBeCloseTo(t440[name] * (442 / 440), 9);
    }
  });
});

describe('nearestOpenString', () => {
  // AC #3 — each open string resolves to itself.
  it('each open-string frequency resolves to its own string', () => {
    const t = openStringFrequencies(440);
    expect(nearestOpenString(t.G3, 440)).toBe('G3');
    expect(nearestOpenString(t.D4, 440)).toBe('D4');
    expect(nearestOpenString(t.A4, 440)).toBe('A4');
    expect(nearestOpenString(t.E5, 440)).toBe('E5');
  });

  // AC #5 — picks by nearest LOG-frequency (a pitch a few cents off D4 → D4).
  it('a pitch a few cents from D4 picks D4', () => {
    const d4 = openStringFrequencies(440).D4;
    const fSharp = d4 * 2 ** (8 / 1200); // +8 cents
    const fFlat = d4 * 2 ** (-8 / 1200); // −8 cents
    expect(nearestOpenString(fSharp, 440)).toBe('D4');
    expect(nearestOpenString(fFlat, 440)).toBe('D4');
  });

  it('log distance (not linear Hz) is the measure — midpoint resolves by cents', () => {
    // The geometric mean of D4 and A4 is equidistant in cents from both; a pitch
    // just above it must pick A4, just below it must pick D4. A linear-Hz nearest
    // would mis-split this (the arithmetic midpoint sits sharp of the geometric one).
    const t = openStringFrequencies(440);
    const geoMid = Math.sqrt(t.D4 * t.A4);
    expect(nearestOpenString(geoMid * 2 ** (1 / 1200), 440)).toBe('A4');
    expect(nearestOpenString(geoMid * 2 ** (-1 / 1200), 440)).toBe('D4');
  });

  it('a low pitch near G3 and a high pitch near E5 resolve correctly', () => {
    expect(nearestOpenString(200, 440)).toBe('G3');
    expect(nearestOpenString(650, 440)).toBe('E5');
  });

  // AC #6 — f ≤ 0 returns null, no throw / NaN.
  it('f ≤ 0 returns null without throwing', () => {
    expect(nearestOpenString(0, 440)).toBeNull();
    expect(nearestOpenString(-100, 440)).toBeNull();
    expect(() => nearestOpenString(0, 440)).not.toThrow();
  });
});
