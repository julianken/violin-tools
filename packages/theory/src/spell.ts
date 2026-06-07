// Note-name spelling — the pure §13 letter-correct naming of a pitch class
// within a (root, scale) key.
//
// DESIGN.md §13 is the source of truth and wins on any conflict (AGENTS.md).
// §12.5's `classify` answers off/in-scale/root from the integer pitch class
// alone; this module answers the *display name* (`Bb`, `C♯`, `G`) for a pitch
// class given the current key — the sharp-vs-flat and one-letter-per-degree
// decisions §12.5 deliberately leaves out. It has no React/DOM/SVG/token
// dependency; it is a pure, total function of `(nodePc, root, scale)`.
//
// §13 conventions, by scale family (the human-confirmed, plan-approved oracle):
//   • Diatonic (major + the three minors, 7 notes): one letter per scale degree.
//     Walk the scale's intervals from the root; each successive degree takes the
//     next letter name (A→B→…→G→A), with whatever accidental makes the pitch
//     class correct. The root's own letter + accidental come from the §13 root
//     spelling (flats for the flat-side roots and F, sharps otherwise).
//   • Pentatonics (5 notes): inherit the parent diatonic scale's spelling —
//     majorPentatonic from Major, minorPentatonic from Natural Minor. A
//     pentatonic note never uses a letter its parent scale wouldn't.
//   • Chromatic (12 notes, KEY-AWARE): the 7 pitch classes of the root's MAJOR
//     scale take their major-scale letters; the other 5 take the root's
//     accidental side — flats when the root carries a flat or is F, else sharps.
//     Chromatic is the deliberate exception to one-letter-per-degree (a base
//     letter recurs across two pitch classes), so it is spelled by accidental
//     side, never by letter-distinctness.

import { SCALE_INTERVALS, ROOT_PITCH_CLASS, type Root, type ScaleType } from './classify.ts';

/** The seven natural letter names (§13 spelling). */
type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** Each natural letter's own pitch class (no accidental), C = 0 (§12.5 intro). */
const LETTER_PITCH_CLASS: Readonly<Record<Letter, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
} as const;

/** Accidental glyphs for an offset in semitones from a natural letter. */
const ACCIDENTAL_BY_OFFSET: Readonly<Record<number, string>> = {
  [-2]: '𝄫', // double-flat
  [-1]: '♭', // flat
  [0]: '', //   natural
  [1]: '♯', //  sharp
  [2]: '𝄪', //  double-sharp
} as const;

/** Non-negative remainder mod 12 (the §12.5(d) convention; JS `%` can go negative). */
function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}

/**
 * The §13 root spelling, decomposed into its natural letter + accidental side.
 *
 * The 12 `Root` union members ARE the §13 chosen spellings (`Db`/`Eb`/`F#`/`Ab`/
 * `Bb` on the accidental pills; naturals otherwise). The first char is the
 * letter; a trailing `b` is a flat, a trailing `#` a sharp. This is the single
 * source of the §13 root rule (flat side for the flat-named roots and F).
 */
function rootSpelling(root: Root): { letter: Letter; flatSide: boolean } {
  const letter = root[0] as Letter;
  // A root name carrying a `b` (flat) — or `F`, per the §13 root rule — spells
  // the key on the flat side; everything else (naturals other than F, and `F#`)
  // spells on the sharp side.
  const flatSide = root.includes('b') || root === 'F';
  return { letter, flatSide };
}

/**
 * Spell a pitch class with an explicit required letter, choosing the accidental
 * that makes that letter name the target pitch class. The offset is taken as the
 * signed value in `[-2, 2]` (a diatonic/chromatic spelling never needs more than
 * a double accidental), so e.g. letter `B` for pc 10 → offset −1 → `B♭`.
 */
function spellWithLetter(targetPc: number, letter: Letter): string {
  const raw = mod12(targetPc - LETTER_PITCH_CLASS[letter]);
  // Map the 0…11 remainder onto the signed range −2…+2 (10→−2, 11→−1).
  const offset = raw > 6 ? raw - 12 : raw;
  const accidental = ACCIDENTAL_BY_OFFSET[offset] ?? '';
  return `${letter}${accidental}`;
}

/**
 * The next natural letter after `letter`, wrapping B→C (§13 letter cycle). A
 * total `Record<Letter, Letter>` so the lookup is typed (no indexed-access
 * `| undefined`, no cast, no non-null assertion — both are gated by lint).
 */
const NEXT_LETTER: Readonly<Record<Letter, Letter>> = {
  C: 'D',
  D: 'E',
  E: 'F',
  F: 'G',
  G: 'A',
  A: 'B',
  B: 'C',
} as const;

/**
 * The diatonic spelling map for a (root, diatonic-scale) key: each scale degree's
 * pitch class → its letter-correct name, one letter per degree. Used directly for
 * the four diatonic scales, and as the parent spelling pentatonics inherit.
 */
function diatonicSpelling(
  root: Root,
  scale: 'major' | 'naturalMinor' | 'harmonicMinor' | 'melodicMinor',
): Map<number, string> {
  const rootPc = ROOT_PITCH_CLASS[root];
  const intervals = SCALE_INTERVALS[scale];
  const { letter: rootLetter } = rootSpelling(root);

  const byPc = new Map<number, string>();
  let letter = rootLetter;
  for (const [degreeIndex, interval] of intervals.entries()) {
    // Degree 0 keeps the root letter; each later degree advances one letter, so
    // a 7-note scale walks A→B→C→…→G exactly once (one letter per degree, §13).
    if (degreeIndex > 0) letter = NEXT_LETTER[letter];
    const pc = mod12(rootPc + interval);
    byPc.set(pc, spellWithLetter(pc, letter));
  }
  return byPc;
}

/** The parent diatonic scale a pentatonic inherits its spelling from (§13). */
const PENTATONIC_PARENT: Readonly<
  Record<'majorPentatonic' | 'minorPentatonic', 'major' | 'naturalMinor'>
> = {
  majorPentatonic: 'major',
  minorPentatonic: 'naturalMinor',
} as const;

/**
 * Canonical accidental-side names for all 12 pitch classes, pc 0 = C ascending.
 * The 7 naturals are identical in both; the 5 accidental pcs differ by side.
 * These supply the §13 chromatic fill for the pitch classes NOT in the root's
 * major scale, matching the root pill's own accidental rule.
 */
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

/**
 * The chromatic spelling map for a root (KEY-AWARE, §13). The root's MAJOR scale
 * supplies the letters for its 7 pitch classes; the other 5 take the root's
 * accidental side — the canonical flat names for a flat/F root, else the sharp
 * names. A natural off-scale pc (e.g. C in A chromatic) stays a natural; only the
 * genuinely accidental pcs flip side. The repeated base letter that results
 * (a natural and its sharp/flat neighbour) is expected: chromatic is the explicit
 * exception to one-letter-per-degree.
 */
function chromaticSpelling(root: Root): Map<number, string> {
  const major = diatonicSpelling(root, 'major');
  const { flatSide } = rootSpelling(root);
  const fill = flatSide ? FLAT_NAMES : SHARP_NAMES;

  const byPc = new Map<number, string>();
  for (let pc = 0; pc < 12; pc++) {
    // A pc in the root's major scale keeps its major-scale letter; otherwise it
    // takes the canonical accidental-side name for that pc.
    byPc.set(pc, major.get(pc) ?? fill[pc] ?? '');
  }
  return byPc;
}

/**
 * §13 — the letter-correct display name of `nodePc` within the `(root, scale)`
 * key. Pure and total: it returns a name for every (pc, root, scale), spelled by
 * the §13 convention for that scale family. The integer pitch class still drives
 * classification (§12.5); this only names what classification already placed.
 */
export function spell(nodePc: number, root: Root, scale: ScaleType): string {
  const pc = mod12(nodePc);

  if (scale === 'chromatic') {
    // Chromatic names every pitch class (no node is ever off, §12.5(a)).
    return chromaticSpelling(root).get(pc) ?? '';
  }

  if (scale === 'majorPentatonic' || scale === 'minorPentatonic') {
    // Pentatonics inherit the parent diatonic spelling and select the pcs the
    // pentatonic actually contains; an off pc (not in the pentatonic) has no §13
    // name and renders no label (§12.2), so it falls through to ''.
    const parent = diatonicSpelling(root, PENTATONIC_PARENT[scale]);
    const rootPc = ROOT_PITCH_CLASS[root];
    const pentatonicPcs = new Set(SCALE_INTERVALS[scale].map((i) => mod12(rootPc + i)));
    return pentatonicPcs.has(pc) ? (parent.get(pc) ?? '') : '';
  }

  // The four diatonic scales: one letter per degree. An off pc (not in the
  // scale) has no §13 name and renders no label, so it falls through to ''.
  return diatonicSpelling(root, scale).get(pc) ?? '';
}
