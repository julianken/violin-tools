// refOverlays — the pure §12.3 reference-overlay geometry + variant logic the
// <RefLayers> component (RefLayers.tsx) renders from. DESIGN.md §12.3 is the
// source of truth and wins on any conflict (AGENTS.md). This module has no
// React/DOM/token dependency — it is pure data + arithmetic over the column grid,
// keyed off the S5 `xOf(offset)` seam (CONSUMED in the component, never
// recomputed here). Splitting it from the component keeps the offset→x table and
// the "low 2" / "3-tape" variant rules unit-testable without React.

import { type RefsState } from '../state/controls';

// §12.3 — all three band rects share `y=60`, `height=152`, `rx=3` (they start
// just above the nut line at `y=62` and span the string field).
export const BAND_Y = 60;
export const BAND_HEIGHT = 152;
export const BAND_RX = 3;

// §12.3 — the tape number label sits above its band at `y=48`; the octave top
// label shares that baseline. The heel "heel ⌄" and octave "½ string" bottom
// labels sit at `y=226`; the heel dashed underline runs at `y=212` (= GUIDE_Y2).
export const LABEL_TOP_Y = 48;
export const LABEL_BOTTOM_Y = 226;
export const HEEL_DASH_Y = 212;
// §12.3 — position labels below the map at `y=252`.
export const POS_LABEL_Y = 252;

// §12.3 — tape bands are 26px wide and center on their column (`x = xOf − 13`).
export const TAPE_WIDTH = 26;
export const TAPE_HALF = TAPE_WIDTH / 2; // 13
// §12.3 — the heel band is 28px wide (`x = xOf(9) − 14`); its dashed underline
// runs the full band width (`xOf(9) − 14 → xOf(9) + 14`).
export const HEEL_WIDTH = 28;
export const HEEL_HALF = HEEL_WIDTH / 2; // 14
// §12.3 — the octave band is 30px wide (`x = xOf(12) − 15`).
export const OCTAVE_WIDTH = 30;
export const OCTAVE_HALF = OCTAVE_WIDTH / 2; // 15

// §12.3 — the heel/position landmark is the violet band at column offset 9 (5th
// position); the octave landmark is the teal band at column offset 12 (7th).
export const HEEL_OFFSET = 9;
export const OCTAVE_OFFSET = 12;

/**
 * §12.3 — one tape band's spec. `low2Offset` is the offset tape 2 moves to under
 * "low 2" (only tape 2 has the slide; the others are static). The "3-tape"
 * variant hides tape 2 (mounted-but-hidden), so its visibility is driven by a
 * flag in the component, not by removing it from this table.
 */
export interface TapeSpec {
  /** The tape number (1–4) shown in the label, e.g. `2`. */
  num: number;
  /** The default column offset, e.g. `+4` for tape 2. */
  defaultOffset: number;
  /** The "low 2" offset — only tape 2 carries one (it slides `+4`↔`+3`). */
  low2Offset?: number;
}

/** §12.3 — the four tape bands in display order (tape 1 +2, 2 +4, 3 +5, 4 +7). */
export const TAPE_SPECS: readonly TapeSpec[] = [
  { num: 1, defaultOffset: 2 },
  { num: 2, defaultOffset: 4, low2Offset: 3 },
  { num: 3, defaultOffset: 5 },
  { num: 4, defaultOffset: 7 },
];

/**
 * §12.3 — the four position labels, rendered inside the `.land` group (they
 * toggle with the Landmarks pill, not as always-on static text). `text` is the
 * displayed label; `offset` is its column.
 */
export const POSITION_LABELS: readonly { text: string; offset: number }[] = [
  { text: '3rd pos', offset: 5 },
  { text: '4th pos', offset: 7 },
  { text: '5th pos', offset: 9 },
  { text: '7th pos', offset: 12 },
];

/**
 * The current offset of a tape under a given refs state. Tape 2 moves to its
 * `low2Offset` when "low 2" is active; every other tape stays at its default.
 * Pure — the offset→x mapping the test pins keys off this.
 */
export function tapeOffset(spec: TapeSpec, refs: RefsState): number {
  if (spec.low2Offset !== undefined && refs.low2) return spec.low2Offset;
  return spec.defaultOffset;
}

/** The tape-number label text, e.g. `2 (+4)` (§12.3). */
export function tapeLabel(spec: TapeSpec, offset: number): string {
  return `${String(spec.num)} (+${String(offset)})`;
}
