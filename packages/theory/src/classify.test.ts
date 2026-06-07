import { describe, it, expect } from 'vitest';

import {
  classify,
  nodePitchClass,
  SCALE_INTERVALS,
  ROOT_PITCH_CLASS,
  OPEN_STRING_PITCH_CLASS,
  NMAX,
  MIN_COLUMN_INDEX,
  MAX_COLUMN_INDEX,
  type NodeState,
  type ScaleType,
  type Root,
  type OpenString,
} from './classify.ts';

// This suite pins the module to DESIGN.md §12.5 exhaustively: the model is a
// finite, enumerable function of (root, scale, nodePc), so the truth table can
// be asserted in full rather than sampled. Constants are checked literally so a
// reviewer can diff each against the §12.5 tables.

// An independent reference implementation of the §12.5(d) rule, used to cross-
// check the full truth table. Written from the spec text, deliberately NOT
// importing the production helper, so the table test catches a regression in
// the production code rather than tautologically agreeing with it.
function referenceClassify(
  rootPc: number,
  scaleSet: readonly number[],
  nodePc: number,
): NodeState {
  const degree = ((nodePc - rootPc) % 12 + 12) % 12;
  if (degree === 0) return 'root';
  if (scaleSet.includes(degree)) return 'in-scale';
  return 'off';
}

describe('§12.5(a) — scale interval sets transcribed exactly', () => {
  it('Major is {0,2,4,5,7,9,11}', () => {
    expect(SCALE_INTERVALS.major).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
  it('Natural Minor is {0,2,3,5,7,8,10}', () => {
    expect(SCALE_INTERVALS.naturalMinor).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });
  it('Harmonic Minor is {0,2,3,5,7,8,11}', () => {
    expect(SCALE_INTERVALS.harmonicMinor).toEqual([0, 2, 3, 5, 7, 8, 11]);
  });
  it('Melodic Minor (ascending) is {0,2,3,5,7,9,11}', () => {
    expect(SCALE_INTERVALS.melodicMinor).toEqual([0, 2, 3, 5, 7, 9, 11]);
  });
  it('Major Pentatonic is {0,2,4,7,9}', () => {
    expect(SCALE_INTERVALS.majorPentatonic).toEqual([0, 2, 4, 7, 9]);
  });
  it('Minor Pentatonic is {0,3,5,7,10}', () => {
    expect(SCALE_INTERVALS.minorPentatonic).toEqual([0, 3, 5, 7, 10]);
  });
  it('Chromatic is {0..11}', () => {
    expect(SCALE_INTERVALS.chromatic).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });
  it('exposes exactly the seven §9.1 scale types', () => {
    expect(Object.keys(SCALE_INTERVALS)).toEqual([
      'major',
      'naturalMinor',
      'harmonicMinor',
      'melodicMinor',
      'majorPentatonic',
      'minorPentatonic',
      'chromatic',
    ]);
  });
});

describe('§12.5(b) — root pitch classes are integers 0–11', () => {
  it('matches the §12.5(b) table (C=0 … B=11)', () => {
    expect(ROOT_PITCH_CLASS).toEqual({
      C: 0,
      Db: 1,
      D: 2,
      Eb: 3,
      E: 4,
      F: 5,
      'F#': 6,
      G: 7,
      Ab: 8,
      A: 9,
      Bb: 10,
      B: 11,
    });
  });
  it('covers all twelve pitch classes exactly once', () => {
    const pcs = Object.values(ROOT_PITCH_CLASS).sort((a, b) => a - b);
    expect(pcs).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

describe('§12.1 / §12.5(c) — open-string pitch classes', () => {
  it('are E5=4, A4=9, D4=2, G3=7', () => {
    expect(OPEN_STRING_PITCH_CLASS).toEqual({ E5: 4, A4: 9, D4: 2, G3: 7 });
  });
});

describe('§12.1 / §12.5(c) — nodePc = (openStringPc + columnIndex) mod 12', () => {
  it('exposes the column-index range 0 … 14 (NMAX = 15)', () => {
    expect(NMAX).toBe(15);
    expect(MIN_COLUMN_INDEX).toBe(0);
    expect(MAX_COLUMN_INDEX).toBe(14);
  });

  it('treats columnIndex 0 (open string) as the open-string pitch class', () => {
    expect(nodePitchClass(OPEN_STRING_PITCH_CLASS.E5, 0)).toBe(4);
    expect(nodePitchClass(OPEN_STRING_PITCH_CLASS.A4, 0)).toBe(9);
    expect(nodePitchClass(OPEN_STRING_PITCH_CLASS.D4, 0)).toBe(2);
    expect(nodePitchClass(OPEN_STRING_PITCH_CLASS.G3, 0)).toBe(7);
  });

  it('adds one semitone per column and wraps mod 12 across 0 … 14', () => {
    // G3 (pc 7): walking up 15 columns wraps past B(11)→C(0).
    const expected = [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let o = MIN_COLUMN_INDEX; o <= MAX_COLUMN_INDEX; o++) {
      expect(nodePitchClass(OPEN_STRING_PITCH_CLASS.G3, o)).toBe(expected[o]);
    }
  });

  it('yields a pitch class in 0 … 11 for every string × column of the 60-node grid', () => {
    const strings = Object.values(OPEN_STRING_PITCH_CLASS);
    let count = 0;
    for (const openPc of strings) {
      for (let o = MIN_COLUMN_INDEX; o <= MAX_COLUMN_INDEX; o++) {
        const pc = nodePitchClass(openPc, o);
        expect(pc).toBeGreaterThanOrEqual(0);
        expect(pc).toBeLessThanOrEqual(11);
        count++;
      }
    }
    // 4 strings × 15 columns = 60 persistent nodes (§12.1).
    expect(count).toBe(60);
  });
});

describe('§12.5(d) — the three-branch classification rule', () => {
  it('returns "root" when nodePc === rootPc', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(classify(pc, SCALE_INTERVALS.major, pc)).toBe('root');
    }
  });

  it('returns "in-scale" when the degree is in the set and the node is not the root', () => {
    // C Major, node E (pc 4): degree 4 ∈ Major set.
    expect(classify(0, SCALE_INTERVALS.major, 4)).toBe('in-scale');
  });

  it('returns "off" otherwise', () => {
    // C Major, node C# (pc 1): degree 1 ∉ Major set.
    expect(classify(0, SCALE_INTERVALS.major, 1)).toBe('off');
  });
});

describe('§12.5(d) — non-negative remainder for nodes below the root', () => {
  // MUST-APPLY: a raw `%` gives (4 − 9) % 12 = −5, which is not in the Major
  // set and would misclassify this node as "off". The non-negative remainder
  // gives degree 7 ∈ Major set → "in-scale".
  it('classifies nodePc=4, rootPc=9 (A Major) as in-scale, not off', () => {
    expect(classify(9, SCALE_INTERVALS.major, 4)).toBe('in-scale');
  });

  it('uses the correct degree (7) for a node five semitones below the root', () => {
    expect(((4 - 9) % 12 + 12) % 12).toBe(7);
  });

  it('never returns a result that a raw negative `%` would produce, across all below-root nodes', () => {
    // For every root and every scale, a node strictly below the root must agree
    // with the non-negative-remainder reference — exercising the wrap.
    for (const scaleSet of Object.values(SCALE_INTERVALS)) {
      for (let rootPc = 1; rootPc < 12; rootPc++) {
        for (let nodePc = 0; nodePc < rootPc; nodePc++) {
          expect(classify(rootPc, scaleSet, nodePc)).toBe(
            referenceClassify(rootPc, scaleSet, nodePc),
          );
        }
      }
    }
  });
});

describe('§12.5 worked example — A Major, rootPc = 9', () => {
  const A_MAJOR = SCALE_INTERVALS.major;
  const rootPc = ROOT_PITCH_CLASS.A;

  it('open A4 (pc 9) → root', () => {
    expect(classify(rootPc, A_MAJOR, OPEN_STRING_PITCH_CLASS.A4)).toBe('root');
  });
  it('open E5 (pc 4, degree 7) → in-scale', () => {
    expect(classify(rootPc, A_MAJOR, OPEN_STRING_PITCH_CLASS.E5)).toBe('in-scale');
  });
  it('open D4 (pc 2, degree 5) → in-scale', () => {
    expect(classify(rootPc, A_MAJOR, OPEN_STRING_PITCH_CLASS.D4)).toBe('in-scale');
  });
  it('open G3 (pc 7, degree 10) → off', () => {
    expect(classify(rootPc, A_MAJOR, OPEN_STRING_PITCH_CLASS.G3)).toBe('off');
  });
  it('reads the in-scale pitch classes back as A B C# D E F# G#', () => {
    // The A Major scale pitch classes (degrees applied to root 9, mod 12):
    // A=9, B=11, C#=1, D=2, E=4, F#=6, G#=8.
    const scalePcs = A_MAJOR.map((deg) => (rootPc + deg) % 12).sort((a, b) => a - b);
    expect(scalePcs).toEqual([1, 2, 4, 6, 8, 9, 11]);
  });
});

describe('exhaustive truth table — all 7 scales × all 12 roots × all 12 node pcs', () => {
  it('matches the independent §12.5(d) reference for every (root, scale, nodePc)', () => {
    const scaleTypes = Object.keys(SCALE_INTERVALS) as ScaleType[];
    let cases = 0;
    for (const scaleType of scaleTypes) {
      const scaleSet = SCALE_INTERVALS[scaleType];
      for (let rootPc = 0; rootPc < 12; rootPc++) {
        for (let nodePc = 0; nodePc < 12; nodePc++) {
          expect(classify(rootPc, scaleSet, nodePc)).toBe(
            referenceClassify(rootPc, scaleSet, nodePc),
          );
          cases++;
        }
      }
    }
    // 7 scales × 12 roots × 12 node pitch classes.
    expect(cases).toBe(7 * 12 * 12);
  });

  it('produces exactly one root per (root, scale) and the right in-scale count', () => {
    // For a 7-note scale (Major et al.) over the 12 pitch classes: 1 root,
    // 6 other in-scale, 5 off. This pins the counts, not just per-node verdicts.
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      const verdicts = Array.from({ length: 12 }, (_, nodePc) =>
        classify(rootPc, SCALE_INTERVALS.major, nodePc),
      );
      expect(verdicts.filter((v) => v === 'root')).toHaveLength(1);
      expect(verdicts.filter((v) => v === 'in-scale')).toHaveLength(6);
      expect(verdicts.filter((v) => v === 'off')).toHaveLength(5);
    }
  });
});

describe('§12.5(a) — Chromatic invariant: no node is ever off', () => {
  it('classifies every non-root node as in-scale, for every root', () => {
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      for (let nodePc = 0; nodePc < 12; nodePc++) {
        const state = classify(rootPc, SCALE_INTERVALS.chromatic, nodePc);
        const expected = nodePc === rootPc ? 'root' : 'in-scale';
        expect(state).toBe(expected);
        expect(state).not.toBe('off');
      }
    }
  });
});

describe('end-to-end — node pitch class feeds classification with no special-casing', () => {
  it('classifies the full 60-node grid for A Major via nodePitchClass + classify', () => {
    const rootPc = ROOT_PITCH_CLASS.A;
    const scaleSet = SCALE_INTERVALS.major;
    const openStrings: OpenString[] = ['E5', 'A4', 'D4', 'G3'];
    let off = 0;
    let inScale = 0;
    let root = 0;
    for (const s of openStrings) {
      for (let o = MIN_COLUMN_INDEX; o <= MAX_COLUMN_INDEX; o++) {
        const pc = nodePitchClass(OPEN_STRING_PITCH_CLASS[s], o);
        const state = classify(rootPc, scaleSet, pc);
        if (state === 'off') off++;
        else if (state === 'in-scale') inScale++;
        else root++;
      }
    }
    // Every node is classified; the grid is exactly 60 dots.
    expect(off + inScale + root).toBe(60);
    // A Major is a 7-note scale: 7 of the 12 pitch classes (incl. the root) are
    // sounded; the open A4 dot is a root, so at least one root appears.
    expect(root).toBeGreaterThanOrEqual(1);
    // The open G3 dot is off (worked example), so off > 0.
    expect(off).toBeGreaterThan(0);
  });

  const _roots: Root[] = Object.keys(ROOT_PITCH_CLASS) as Root[];
  it('exposes all twelve roots as a typed list', () => {
    expect(_roots).toHaveLength(12);
  });
});
