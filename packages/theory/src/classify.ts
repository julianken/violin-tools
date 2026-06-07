// Pitch classification — the pure arithmetic heart of the §12.5 note-map model.
//
// DESIGN.md §12.5 is the source of truth and wins on any conflict (AGENTS.md):
// the constants and the single three-branch rule below are transcribed verbatim
// from §12.5, deliberately so a reviewer can diff every literal against the spec
// line-by-line. This module has no React/DOM/SVG/token/timing dependency — it
// classifies a node as "off" | "in-scale" | "root"; the visual mapping (§12.2),
// motion (§7.1), reference overlays (§12.3), and note-name spelling (§13) live
// elsewhere. Classification uses the integer pitch class only.

/** The three states a fingerboard node renders in (§12.2). */
export type NodeState = 'off' | 'in-scale' | 'root';

/** The seven scale types, in §9.1 / §12.5(a) order. */
export type ScaleType =
  | 'major'
  | 'naturalMinor'
  | 'harmonicMinor'
  | 'melodicMinor'
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'chromatic';

/**
 * §12.5(a) — Scale types → semitone-interval sets.
 *
 * Each scale is a set of semitone offsets from its own root (root = 0). These
 * seven are the entire scale vocabulary (the §9.1 Scale row, in the same order),
 * transcribed verbatim from the §12.5(a) table.
 */
export const SCALE_INTERVALS: Readonly<Record<ScaleType, readonly number[]>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  // Melodic minor uses the ascending form (raised 6 and 7); v1 renders no
  // separate descending (= natural-minor) form (§12.5(a) note).
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  // Chromatic contains every pitch class, so under the rule below no node is
  // ever off in Chromatic — every non-root dot is in-scale (§12.5(a) note).
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
} as const;

/** The twelve root pills (§9.1), as pitch-class integers. */
export type Root =
  | 'C'
  | 'Db'
  | 'D'
  | 'Eb'
  | 'E'
  | 'F'
  | 'F#'
  | 'G'
  | 'Ab'
  | 'A'
  | 'Bb'
  | 'B';

/**
 * §12.5(b) — Roots → pitch-class integers.
 *
 * Pitch classes are integers 0–11, C = 0 ascending by semitone (§12.5 intro).
 * The *displayed* spelling (e.g. `Bb` vs `A#`) is §13's `spell()`; the integer
 * is what classifies. Transcribed verbatim from the §12.5(b) table.
 */
export const ROOT_PITCH_CLASS: Readonly<Record<Root, number>> = {
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
} as const;

/** The four open strings (§12.1 / §12.5(c)). */
export type OpenString = 'E5' | 'A4' | 'D4' | 'G3';

/**
 * §12.1 / §12.5(c) — The four open-string pitch classes, in perfect-fifth
 * tuning: E5 = 4, A4 = 9, D4 = 2, G3 = 7.
 */
export const OPEN_STRING_PITCH_CLASS: Readonly<Record<OpenString, number>> = {
  E5: 4,
  A4: 9,
  D4: 2,
  G3: 7,
} as const;

/**
 * §12.1 — The per-string column count: `NMAX = 15` (1 open + 14 stopped).
 * The column index `o` runs `0 … NMAX − 1`, i.e. `0 … 14`.
 */
export const NMAX = 15;

/** The valid column-index range `0 … 14` (§12.1, NMAX = 15). */
export const MIN_COLUMN_INDEX = 0;
export const MAX_COLUMN_INDEX = NMAX - 1;

/**
 * §12.5(c) — A node's own pitch class.
 *
 * `nodePc = (openStringPc + columnIndex) mod 12`. Each column adds one semitone;
 * `columnIndex` is the semitone count from the open string (`o = 0` open …
 * `o = 14` the 14th stopped semitone). The open string is just the node whose
 * `columnIndex = 0` — it participates in classification with no special-casing.
 */
export function nodePitchClass(openStringPc: number, columnIndex: number): number {
  return mod12(openStringPc + columnIndex);
}

/**
 * Non-negative remainder mod 12.
 *
 * §12.5(d) specifies `mod` as the non-negative remainder
 * `((x) % 12 + 12) % 12` for languages where `%` can go negative — JavaScript
 * is one of them, so a raw `%` would misclassify any node below the root
 * (e.g. `(4 − 9) % 12 = −5`). This guards both `nodePc` and the interval degree.
 */
function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}

/**
 * §12.5(d) — The whole classification rule.
 *
 * Given a node of pitch class `nodePc`, the selected root's pitch class
 * `rootPc`, and the selected scale's interval set `scaleSet`:
 *
 *   if   nodePc == rootPc                       → root
 *   elif ((nodePc − rootPc) mod 12) in scaleSet → in-scale
 *   else                                        → off
 *
 * The interval degree uses the non-negative remainder (see `mod12`), so a node
 * below the root classifies correctly rather than via a negative `%` result.
 */
export function classify(
  rootPc: number,
  scaleSet: readonly number[],
  nodePc: number,
): NodeState {
  const root = mod12(rootPc);
  const node = mod12(nodePc);
  if (node === root) return 'root';
  const degree = mod12(node - root);
  if (scaleSet.includes(degree)) return 'in-scale';
  return 'off';
}
