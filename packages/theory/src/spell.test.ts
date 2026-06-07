import { describe, it, expect } from 'vitest';

import {
  spell,
  SCALE_INTERVALS,
  ROOT_PITCH_CLASS,
  type Root,
  type ScaleType,
} from './index.ts';

// This suite pins `spell()` to DESIGN.md §13 across the whole finite surface:
// every root × scale. The expected spellings come from an INDEPENDENT reference
// implementation of the §13 convention (written from the spec text, not by
// calling the production `spell`), so the per-scale truth table catches a
// regression in the production code rather than tautologically agreeing with it.
// On top of the reference cross-check, explicit anchor assertions pin the exact
// load-bearing cases the spec calls out (Bb major, A major, A minor pentatonic,
// Bb chromatic-uses-flats).

const ROOTS = Object.keys(ROOT_PITCH_CLASS) as Root[];
const SCALES = Object.keys(SCALE_INTERVALS) as ScaleType[];

// ── independent §13 reference oracle ───────────────────────────────────────

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
type Letter = (typeof LETTERS)[number];
const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', [0]: '', [1]: '♯', [2]: '𝄪' };

const m12 = (n: number): number => ((n % 12) + 12) % 12;

function refLetterFor(pc: number, letter: Letter): string {
  const raw = m12(pc - LETTER_PC[letter]);
  const offset = raw > 6 ? raw - 12 : raw;
  return `${letter}${ACC[offset] ?? ''}`;
}

function refRootLetter(root: Root): Letter {
  return root[0] as Letter;
}
function refFlatSide(root: Root): boolean {
  return root.includes('b') || root === 'F';
}

/** Reference diatonic spelling: one letter per degree, walking from the root. */
function refDiatonic(root: Root, scale: ScaleType): Map<number, string> {
  const rootPc = ROOT_PITCH_CLASS[root];
  const intervals = SCALE_INTERVALS[scale];
  const startIndex = LETTERS.indexOf(refRootLetter(root));
  const out = new Map<number, string>();
  intervals.forEach((interval, degree) => {
    const letter = LETTERS[(startIndex + degree) % 7]!;
    out.set(m12(rootPc + interval), refLetterFor(m12(rootPc + interval), letter));
  });
  return out;
}

// Canonical accidental-side names (pc 0 = C ascending) — the §13 chromatic fill
// for the pcs NOT in the root's major scale, written independently from §13 text.
const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/** Reference chromatic spelling: root's major letters + accidental-side fill. */
function refChromatic(root: Root): Map<number, string> {
  const major = refDiatonic(root, 'major');
  const fill = refFlatSide(root) ? FLAT : SHARP;
  const out = new Map<number, string>();
  for (let pc = 0; pc < 12; pc++) {
    out.set(pc, major.get(pc) ?? fill[pc] ?? '');
  }
  return out;
}

/** The full reference spelling for (root, scale): pc → name, '' for off pcs. */
function refSpelling(root: Root, scale: ScaleType): (pc: number) => string {
  if (scale === 'chromatic') {
    const map = refChromatic(root);
    return (pc) => map.get(m12(pc)) ?? '';
  }
  if (scale === 'majorPentatonic' || scale === 'minorPentatonic') {
    const parent = scale === 'majorPentatonic' ? 'major' : 'naturalMinor';
    const map = refDiatonic(root, parent);
    const rootPc = ROOT_PITCH_CLASS[root];
    const pentPcs = new Set(SCALE_INTERVALS[scale].map((i) => m12(rootPc + i)));
    return (pc) => (pentPcs.has(m12(pc)) ? (map.get(m12(pc)) ?? '') : '');
  }
  const map = refDiatonic(root, scale);
  return (pc) => map.get(m12(pc)) ?? '';
}

/** The in-scale (incl. root) pitch classes of a (root, scale), in degree order. */
function scalePcs(root: Root, scale: ScaleType): number[] {
  const rootPc = ROOT_PITCH_CLASS[root];
  return SCALE_INTERVALS[scale].map((i) => m12(rootPc + i));
}

/** The spelled scale as an ordered array (degree order from the root). */
function spelledScale(root: Root, scale: ScaleType): string[] {
  return scalePcs(root, scale).map((pc) => spell(pc, root, scale));
}

// ── exhaustive truth table: every root × every scale ───────────────────────

describe('§13 spell() — per-scale spelling truth table (all 7 scales × 12 roots)', () => {
  it('matches the independent §13 reference for every in-scale pc of every (root, scale)', () => {
    let cases = 0;
    for (const scale of SCALES) {
      for (const root of ROOTS) {
        const ref = refSpelling(root, scale);
        for (const pc of scalePcs(root, scale)) {
          expect(spell(pc, root, scale)).toBe(ref(pc));
          cases++;
        }
      }
    }
    // 4 diatonic × 7 + 2 pentatonic × 5 + chromatic × 12 = 28+10+12 = 50, × 12 roots.
    expect(cases).toBe((4 * 7 + 2 * 5 + 12) * 12);
  });

  it('matches the independent §13 reference for ALL 12 pcs (incl. off pcs) of every (root, scale)', () => {
    for (const scale of SCALES) {
      for (const root of ROOTS) {
        const ref = refSpelling(root, scale);
        for (let pc = 0; pc < 12; pc++) {
          expect(spell(pc, root, scale)).toBe(ref(pc));
        }
      }
    }
  });
});

// ── diatonic: one letter per degree (the well-defined case) ────────────────

describe('§13 spell() — diatonic scales spell one letter per degree', () => {
  const DIATONIC: ScaleType[] = ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor'];

  it('uses 7 DISTINCT base letters across the 7 degrees, for every root × diatonic scale', () => {
    for (const scale of DIATONIC) {
      for (const root of ROOTS) {
        const letters = spelledScale(root, scale).map((name) => name[0]);
        expect(new Set(letters).size).toBe(7);
        expect(letters).toHaveLength(7);
      }
    }
  });
});

// ── explicit anchor assertions (the spec's load-bearing cases) ─────────────

describe('§13 spell() — explicit anchor spellings', () => {
  it('Bb major spells Bb C D Eb F G A (the root reads Bb, NOT A♯)', () => {
    expect(spelledScale('Bb', 'major')).toEqual(['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A']);
    // The root pc (10) spells Bb in Bb major — the original bug rendered it A♯.
    expect(spell(10, 'Bb', 'major')).toBe('B♭');
    expect(spell(10, 'Bb', 'major')).not.toBe('A♯');
  });

  it('A major spells A B C♯ D E F♯ G♯', () => {
    expect(spelledScale('A', 'major')).toEqual(['A', 'B', 'C♯', 'D', 'E', 'F♯', 'G♯']);
  });

  it('A minor pentatonic spells A C D E G (inherits Natural Minor letters)', () => {
    expect(spelledScale('A', 'minorPentatonic')).toEqual(['A', 'C', 'D', 'E', 'G']);
  });

  it('A major pentatonic spells A B C♯ E F♯ (inherits Major letters)', () => {
    expect(spelledScale('A', 'majorPentatonic')).toEqual(['A', 'B', 'C♯', 'E', 'F♯']);
  });
});

// ── chromatic: key-aware, the deliberate exception to letter-distinctness ───

describe('§13 spell() — chromatic is key-aware (NOT letter-distinct)', () => {
  it('Bb chromatic uses FLATS — no A♯ (no sharp accidental) appears anywhere', () => {
    const all = Array.from({ length: 12 }, (_, pc) => spell(pc, 'Bb', 'chromatic'));
    // No sharp glyph (and certainly no A♯) anywhere in a flat-key chromatic.
    expect(all.some((name) => name.includes('♯'))).toBe(false);
    expect(all).not.toContain('A♯');
    // The root pc (10) reads Bb, not A♯.
    expect(spell(10, 'Bb', 'chromatic')).toBe('B♭');
    // The full Bb chromatic spelling, in pc order C…B.
    expect(all).toEqual([
      'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B',
    ]);
  });

  it('A chromatic uses SHARPS for its non-diatonic pcs', () => {
    const all = Array.from({ length: 12 }, (_, pc) => spell(pc, 'A', 'chromatic'));
    expect(all.some((name) => name.includes('♭'))).toBe(false);
    expect(all).toEqual([
      'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B',
    ]);
  });

  it('does NOT assert 12 distinct base letters — chromatic deliberately repeats a base letter', () => {
    // Chromatic is the explicit §13 exception to one-letter-per-degree: a natural
    // and its sharp/flat neighbour share a base letter, so the 12 spellings use
    // only 7 base letters. This pins that the repetition is EXPECTED (anti-AC:
    // chromatic must NOT be checked for letter-distinctness the way diatonic is).
    const letters = Array.from({ length: 12 }, (_, pc) => spell(pc, 'A', 'chromatic')[0]);
    expect(new Set(letters).size).toBe(7);
  });
});

// ── purity / totality ──────────────────────────────────────────────────────

describe('§13 spell() — pure and total over all (pc, root, scale)', () => {
  it('returns a string for every (pc, root, scale), incl. out-of-range and negative pcs', () => {
    for (const scale of SCALES) {
      for (const root of ROOTS) {
        for (let pc = -13; pc <= 24; pc++) {
          expect(typeof spell(pc, root, scale)).toBe('string');
        }
      }
    }
  });

  it('is mod-12 stable: spell(pc) === spell(pc + 12) === spell(pc − 12)', () => {
    for (const scale of SCALES) {
      for (const root of ROOTS) {
        for (let pc = 0; pc < 12; pc++) {
          expect(spell(pc + 12, root, scale)).toBe(spell(pc, root, scale));
          expect(spell(pc - 12, root, scale)).toBe(spell(pc, root, scale));
        }
      }
    }
  });
});
