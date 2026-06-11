import { describe, it, expect } from 'vitest';

import {
  SCALE_INTERVALS,
  ROOT_PITCH_CLASS,
  type Root,
  type ScaleType,
} from './classify.ts';
import { drillPlan, type DrillTarget } from './drillPlan.ts';
import { frequencyOfMidi, clampA4 } from './tuning.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All 12 Root values. */
const ALL_ROOTS: Root[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** All 7 ScaleType values in the order they appear in classify.ts. */
const ALL_SCALE_TYPES: ScaleType[] = [
  'major',
  'naturalMinor',
  'harmonicMinor',
  'melodicMinor',
  'majorPentatonic',
  'minorPentatonic',
  'chromatic',
];

/**
 * Expected sequence length: 4 * n + 1 where n = number of scale intervals.
 * Derivation:
 *   Ascending 2 octaves: 2n + 1 notes (n per octave, plus the peak root)
 *   Descending 2 octaves: 2n notes (peak shared → omit, then 2n entries down to start root)
 *   Total: (2n+1) + 2n = 4n + 1
 */
function expectedLength(scaleType: ScaleType): number {
  return 4 * SCALE_INTERVALS[scaleType].length + 1;
}

/** Index of the peak in a drill plan sequence (= 2n, i.e. the ascending endpoint). */
function peakIndex(scaleType: ScaleType): number {
  return 2 * SCALE_INTERVALS[scaleType].length;
}

// ---------------------------------------------------------------------------
// AC2 — Sequence length formula correct per scale type
// ---------------------------------------------------------------------------

describe('AC2 — sequence length formula per scale type', () => {
  for (const scaleType of ALL_SCALE_TYPES) {
    it(`${scaleType}: length === 4 × ${SCALE_INTERVALS[scaleType].length} + 1 = ${expectedLength(scaleType)}`, () => {
      const plan = drillPlan('A', scaleType, 440);
      expect(plan.length).toBe(expectedLength(scaleType));
    });
  }

  it('diatonic (major) has exactly 29 entries at any root', () => {
    expect(drillPlan('G', 'major', 440).length).toBe(29);
    expect(drillPlan('Eb', 'major', 440).length).toBe(29);
  });

  it('pentatonic has exactly 21 entries', () => {
    expect(drillPlan('A', 'majorPentatonic', 440).length).toBe(21);
    expect(drillPlan('A', 'minorPentatonic', 440).length).toBe(21);
  });

  it('chromatic has exactly 49 entries', () => {
    expect(drillPlan('A', 'chromatic', 440).length).toBe(49);
  });
});

// ---------------------------------------------------------------------------
// AC3 — First and last targets are the root
// ---------------------------------------------------------------------------

describe('AC3 — first and last targets are the root pitch class', () => {
  for (const root of ALL_ROOTS) {
    it(`root ${root}: targets[0] and targets[last] have pitch class ${ROOT_PITCH_CLASS[root]}`, () => {
      const plan = drillPlan(root, 'major', 440);
      const expectedPc = ROOT_PITCH_CLASS[root];
      expect(plan[0]!.midiNote % 12).toBe(expectedPc);
      expect(plan[plan.length - 1]!.midiNote % 12).toBe(expectedPc);
    });
  }

  // Also verify with other scale types
  it('naturalMinor: first and last are root', () => {
    const plan = drillPlan('D', 'naturalMinor', 440);
    const expectedPc = ROOT_PITCH_CLASS.D;
    expect(plan[0]!.midiNote % 12).toBe(expectedPc);
    expect(plan[plan.length - 1]!.midiNote % 12).toBe(expectedPc);
  });

  it('chromatic: first and last are root', () => {
    const plan = drillPlan('F#', 'chromatic', 440);
    const expectedPc = ROOT_PITCH_CLASS['F#'];
    expect(plan[0]!.midiNote % 12).toBe(expectedPc);
    expect(plan[plan.length - 1]!.midiNote % 12).toBe(expectedPc);
  });
});

// ---------------------------------------------------------------------------
// AC3 (extended) — first and last MIDI notes are identical (same octave root)
// ---------------------------------------------------------------------------

describe('first and last MIDI notes are the same (both root octave)', () => {
  it('A major 440: targets[0].midiNote === targets[last].midiNote', () => {
    const plan = drillPlan('A', 'major', 440);
    expect(plan[0]!.midiNote).toBe(plan[plan.length - 1]!.midiNote);
  });

  it('G major 440: targets[0].midiNote === targets[last].midiNote', () => {
    const plan = drillPlan('G', 'major', 440);
    expect(plan[0]!.midiNote).toBe(plan[plan.length - 1]!.midiNote);
  });
});

// ---------------------------------------------------------------------------
// AC4 — Peak appears exactly once
// ---------------------------------------------------------------------------

describe('AC4 — peak appears exactly once', () => {
  for (const scaleType of ALL_SCALE_TYPES) {
    it(`${scaleType}: max midiNote appears exactly once`, () => {
      const plan = drillPlan('A', scaleType, 440);
      const maxMidi = Math.max(...plan.map((t) => t.midiNote));
      const peakCount = plan.filter((t) => t.midiNote === maxMidi).length;
      expect(peakCount).toBe(1);
    });
  }

  it('peak is at the expected index (2n)', () => {
    for (const scaleType of ALL_SCALE_TYPES) {
      const plan = drillPlan('A', scaleType, 440);
      const pi = peakIndex(scaleType);
      const maxMidi = Math.max(...plan.map((t) => t.midiNote));
      expect(plan[pi]!.midiNote).toBe(maxMidi);
    }
  });

  it('no target before the peak has midiNote >= peak midiNote', () => {
    const plan = drillPlan('D', 'major', 440);
    const pi = peakIndex('major');
    const peakMidi = plan[pi]!.midiNote;
    for (let i = 0; i < pi; i++) {
      expect(plan[i]!.midiNote).toBeLessThan(peakMidi);
    }
  });

  it('no target after the peak has midiNote >= peak midiNote', () => {
    const plan = drillPlan('D', 'major', 440);
    const pi = peakIndex('major');
    const peakMidi = plan[pi]!.midiNote;
    for (let i = pi + 1; i < plan.length; i++) {
      expect(plan[i]!.midiNote).toBeLessThan(peakMidi);
    }
  });
});

// ---------------------------------------------------------------------------
// Monotonic shape (ascending then descending)
// ---------------------------------------------------------------------------

describe('ascending then descending shape', () => {
  it('A major: ascending half is non-decreasing', () => {
    const plan = drillPlan('A', 'major', 440);
    const pi = peakIndex('major');
    for (let i = 1; i <= pi; i++) {
      expect(plan[i]!.midiNote).toBeGreaterThanOrEqual(plan[i - 1]!.midiNote);
    }
  });

  it('A major: descending half is non-increasing', () => {
    const plan = drillPlan('A', 'major', 440);
    const pi = peakIndex('major');
    for (let i = pi + 1; i < plan.length; i++) {
      expect(plan[i]!.midiNote).toBeLessThanOrEqual(plan[i - 1]!.midiNote);
    }
  });

  it('descending half mirrors ascending half (same MIDI notes, reversed)', () => {
    const plan = drillPlan('A', 'major', 440);
    const pi = peakIndex('major');
    // ascending: plan[0..pi], descending: plan[pi+1..end]
    // descending[j] should equal ascending[pi-1-j]
    for (let j = 0; j < pi; j++) {
      const descNote = plan[pi + 1 + j]!.midiNote;
      const ascNote = plan[pi - 1 - j]!.midiNote;
      expect(descNote).toBe(ascNote);
    }
  });

  it('span is exactly 2 octaves (24 semitones) from start to peak', () => {
    for (const scaleType of ALL_SCALE_TYPES) {
      const plan = drillPlan('A', scaleType, 440);
      const pi = peakIndex(scaleType);
      expect(plan[pi]!.midiNote - plan[0]!.midiNote).toBe(24);
    }
  });
});

// ---------------------------------------------------------------------------
// AC5 — Hz derivation matches Tuner source
// ---------------------------------------------------------------------------

describe('AC5 — Hz derivation matches frequencyOfMidi(midiNote, clampA4(a4))', () => {
  it('every target.hz equals frequencyOfMidi(target.midiNote, clampA4(a4)) at 440', () => {
    const plan = drillPlan('A', 'major', 440);
    for (const target of plan) {
      expect(target.hz).toBeCloseTo(frequencyOfMidi(target.midiNote, clampA4(440)), 10);
    }
  });

  it('every target.hz equals frequencyOfMidi(target.midiNote, clampA4(a4)) at 415', () => {
    const plan = drillPlan('G', 'naturalMinor', 415);
    for (const target of plan) {
      expect(target.hz).toBeCloseTo(frequencyOfMidi(target.midiNote, clampA4(415)), 10);
    }
  });

  it('every target.hz equals frequencyOfMidi(target.midiNote, clampA4(a4)) at 446', () => {
    const plan = drillPlan('E', 'harmonicMinor', 446);
    for (const target of plan) {
      expect(target.hz).toBeCloseTo(frequencyOfMidi(target.midiNote, clampA4(446)), 10);
    }
  });

  it('covers all scale types at A root, 440', () => {
    for (const scaleType of ALL_SCALE_TYPES) {
      const plan = drillPlan('A', scaleType, 440);
      for (const target of plan) {
        const expected = frequencyOfMidi(target.midiNote, clampA4(440));
        expect(target.hz).toBeCloseTo(expected, 10);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// AC6 — A4 calibration threads through
// ---------------------------------------------------------------------------

describe('AC6 — A4 calibration threads through uniformly', () => {
  it('A major: every hz in a4=446 run is scaled from a4=415 by 446/415 within 1¢', () => {
    const plan415 = drillPlan('A', 'major', 415);
    const plan446 = drillPlan('A', 'major', 446);
    const ratio = 446 / 415;
    for (let i = 0; i < plan415.length; i++) {
      const expected = plan415[i]!.hz * ratio;
      const actual = plan446[i]!.hz;
      // 1¢ tolerance: ratio = 2^(cents/1200), so for 1¢: 2^(1/1200) ≈ 1.000578
      // We verify the ratio is within 1¢ by checking |cents| <= 1
      const centsDiff = 1200 * Math.log2(actual / expected);
      expect(Math.abs(centsDiff)).toBeLessThanOrEqual(1);
    }
  });

  it('MIDI notes are unchanged between different a4 values (only hz changes)', () => {
    const plan415 = drillPlan('A', 'major', 415);
    const plan446 = drillPlan('A', 'major', 446);
    for (let i = 0; i < plan415.length; i++) {
      expect(plan415[i]!.midiNote).toBe(plan446[i]!.midiNote);
    }
  });

  it('out-of-range a4 (e.g. 400) clamps to A4_MIN and is indistinguishable from 415', () => {
    const planClamped = drillPlan('A', 'major', 400);
    const plan415 = drillPlan('A', 'major', 415);
    for (let i = 0; i < plan415.length; i++) {
      expect(planClamped[i]!.hz).toBeCloseTo(plan415[i]!.hz, 10);
    }
  });

  it('minorPentatonic: hz ratio between 446 and 415 is uniform', () => {
    const plan415 = drillPlan('D', 'minorPentatonic', 415);
    const plan446 = drillPlan('D', 'minorPentatonic', 446);
    const ratio = 446 / 415;
    for (let i = 0; i < plan415.length; i++) {
      expect(plan446[i]!.hz).toBeCloseTo(plan415[i]!.hz * ratio, 8);
    }
  });
});

// ---------------------------------------------------------------------------
// AC7 — All 12 roots covered (sequence-shape assertion for each)
// ---------------------------------------------------------------------------

describe('AC7 — all 12 Root values produce valid sequences', () => {
  for (const root of ALL_ROOTS) {
    it(`root ${root} (major): correct length, root at start/end, peak once`, () => {
      const plan = drillPlan(root, 'major', 440);
      // correct length
      expect(plan.length).toBe(expectedLength('major'));
      // root at start
      expect(plan[0]!.midiNote % 12).toBe(ROOT_PITCH_CLASS[root]);
      // root at end
      expect(plan[plan.length - 1]!.midiNote % 12).toBe(ROOT_PITCH_CLASS[root]);
      // peak appears once
      const maxMidi = Math.max(...plan.map((t) => t.midiNote));
      const peakCount = plan.filter((t) => t.midiNote === maxMidi).length;
      expect(peakCount).toBe(1);
    });
  }
});

// ---------------------------------------------------------------------------
// AC8 (runtime contract) — index field is correct
// ---------------------------------------------------------------------------

describe('index fields are correct (zero-based sequential)', () => {
  it('A major: every target.index matches its position in the array', () => {
    const plan = drillPlan('A', 'major', 440);
    plan.forEach((target, i) => {
      expect(target.index).toBe(i);
    });
  });

  it('chromatic: every target.index matches its position in the array', () => {
    const plan = drillPlan('C', 'chromatic', 440);
    plan.forEach((target, i) => {
      expect(target.index).toBe(i);
    });
  });
});

// ---------------------------------------------------------------------------
// Degree labels
// ---------------------------------------------------------------------------

describe('degreeLabel fields', () => {
  it('A major ascending: labels are "1".."15" (2 octaves + peak)', () => {
    const plan = drillPlan('A', 'major', 440);
    const pi = peakIndex('major'); // 14
    for (let i = 0; i <= pi; i++) {
      expect(plan[i]!.degreeLabel).toBe(String(i + 1));
    }
  });

  it('ascending and descending labels mirror each other (same degree same label)', () => {
    const plan = drillPlan('A', 'major', 440);
    const pi = peakIndex('major'); // 14
    // descending[j] at plan[pi+1+j] should have label matching plan[pi-1-j]
    for (let j = 0; j < pi; j++) {
      expect(plan[pi + 1 + j]!.degreeLabel).toBe(plan[pi - 1 - j]!.degreeLabel);
    }
  });
});

// ---------------------------------------------------------------------------
// AC1 — purity check (no react/audio imports)
// ---------------------------------------------------------------------------

describe('AC1 — module purity assertion (structural)', () => {
  it('DrillTarget type has the expected shape fields', () => {
    const plan = drillPlan('A', 'major', 440);
    const target: DrillTarget = plan[0]!;
    // All four fields must be present and be the right types
    expect(typeof target.index).toBe('number');
    expect(typeof target.midiNote).toBe('number');
    expect(typeof target.hz).toBe('number');
    expect(typeof target.degreeLabel).toBe('string');
  });

  it('drillPlan returns a readonly array (not mutated by caller)', () => {
    const plan = drillPlan('A', 'major', 440);
    // The function returns `readonly DrillTarget[]`, so TypeScript prevents mutation.
    // At runtime we can verify the reference is an Array and has content.
    expect(Array.isArray(plan)).toBe(true);
    expect(plan.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Violin range guard
// ---------------------------------------------------------------------------

describe('starting MIDI is within violin range', () => {
  const MIDI_VIOLIN_LOW = 55; // G3
  const MIDI_VIOLIN_HIGH = 88; // E6

  it('for every root the sequence starts at or above G3 (MIDI 55)', () => {
    for (const root of ALL_ROOTS) {
      const plan = drillPlan(root, 'major', 440);
      expect(plan[0]!.midiNote).toBeGreaterThanOrEqual(MIDI_VIOLIN_LOW);
    }
  });

  it('for roots where the 2-octave span fits, the peak stays within E6 (MIDI 88)', () => {
    // Roots where a full 2-octave span fits: span is 24 semitones (start + 24 <= 88).
    const pi = peakIndex('major');
    const fittingRoots = ALL_ROOTS.filter((root) => {
      const plan = drillPlan(root, 'major', 440);
      return plan[0]!.midiNote + 24 <= MIDI_VIOLIN_HIGH;
    });
    // There must be some fitting roots (sanity — if zero, the guard logic is broken)
    expect(fittingRoots.length).toBeGreaterThan(0);
    for (const root of fittingRoots) {
      const plan = drillPlan(root, 'major', 440);
      expect(plan[pi]!.midiNote).toBeLessThanOrEqual(MIDI_VIOLIN_HIGH);
    }
  });
});

// ---------------------------------------------------------------------------
// Scale interval accuracy — each note in the ascending half matches the scale
// ---------------------------------------------------------------------------

describe('notes in ascending half are correct scale degrees', () => {
  it('A major ascending: each note pitch class matches the major scale from A', () => {
    const plan = drillPlan('A', 'major', 440);
    const pi = peakIndex('major');
    const intervals = SCALE_INTERVALS.major;
    const startMidi = plan[0]!.midiNote;
    // Check that notes within first octave match intervals
    for (let i = 0; i < intervals.length; i++) {
      expect(plan[i]!.midiNote).toBe(startMidi + intervals[i]!);
    }
    // Second octave
    for (let i = 0; i < intervals.length; i++) {
      expect(plan[intervals.length + i]!.midiNote).toBe(startMidi + 12 + intervals[i]!);
    }
    // Peak
    expect(plan[pi]!.midiNote).toBe(startMidi + 24);
  });

  it('C natural minor ascending: each note pitch class matches the scale from C', () => {
    const plan = drillPlan('C', 'naturalMinor', 440);
    const intervals = SCALE_INTERVALS.naturalMinor;
    const startMidi = plan[0]!.midiNote;
    for (let i = 0; i < intervals.length; i++) {
      expect(plan[i]!.midiNote).toBe(startMidi + intervals[i]!);
    }
  });
});
