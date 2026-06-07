// Display note names for the note-map dot labels.
//
// §12.5 classifies on the integer pitch class only; the *letter-correct* spelling
// (e.g. A Major's G♯, not A♭) is §13's `spell()` — deliberately NOT built in S5
// (it is a later, scale-aware concern). So this module supplies only a minimal
// pitch-class → display-name map for the static render: the sharp-side spelling
// of each of the 12 pitch classes, using the ♯ glyph (not "#") so the label reads
// as music, not code. This is presentation text for the dot labels, NOT a second
// classifier — classification stays entirely in @violin-tools/theory (§12.5).
//
// When §13's `spell()` lands it replaces this map at the label call site; the
// classification path (off/in-scale/root) is untouched either way.

/**
 * Pitch class (0–11, C = 0 ascending by semitone, §12.5) → its sharp-side
 * display name. Indexed by `nodePc`; `NOTE_NAMES[pc]` is the label text.
 */
export const NOTE_NAMES: readonly string[] = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
];

/** The display name for a pitch class `0 … 11`. */
export function noteName(pitchClass: number): string {
  // pitchClass is always a valid 0–11 from nodePitchClass()'s mod-12; the `?? ''`
  // satisfies noUncheckedIndexedAccess without inventing an out-of-range branch.
  return NOTE_NAMES[pitchClass] ?? '';
}
