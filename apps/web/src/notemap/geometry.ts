// Note-map geometry — the pure §12.1 coordinate system for the fingerboard SVG.
//
// DESIGN.md §12.1 is the source of truth and wins on any conflict (AGENTS.md).
// Every constant below is transcribed verbatim from §12.1 so a reviewer can diff
// each literal line-by-line. This module has no React/DOM/token dependency — it
// is pure arithmetic over the (string, column) grid. The renderer (NoteMap.tsx)
// and the later overlays (S7) consume `xOf` and the string/viewBox constants;
// `xOf(offset)` in particular is the stable seam S7's tape/landmark bands key off
// (each band centers on `xOf(offset)`), so its signature must not change.

import {
  NMAX,
  OPEN_STRING_PITCH_CLASS,
  type OpenString,
} from '@violin-tools/theory';

/**
 * §12.1 — the SVG canvas. `width:100%`, `height:auto`, `min-width:760px` are CSS
 * concerns (shell.css `.board`); the intrinsic coordinate space is this viewBox.
 */
export const VIEWBOX = '0 0 760 264';
export const VIEWBOX_WIDTH = 760;
export const VIEWBOX_HEIGHT = 264;

/** §12.1 — string lines run `x1:60 → x2:724`. */
export const STRING_X1 = 60;
export const STRING_X2 = 724;
export const STRING_STROKE_WIDTH = 1.5;

/** §12.1 — the nut: `rect x=58 y=62 width=5 height=150` (no radius). */
export const NUT = { x: 58, y: 62, width: 5, height: 150 } as const;

/** §12.1 — position guide lines run `y1:62 → y2:212`, one per stopped column. */
export const GUIDE_Y1 = 62;
export const GUIDE_Y2 = 212;
export const GUIDE_STROKE_WIDTH = 1;

/** §12.1 — open-column x; stopped-column base + step (`x = 96 + (o − 1) × 44`). */
export const OPEN_X = 42;
const STOPPED_BASE_X = 96;
const STOPPED_STEP_X = 44;

/** §12.1 — string-name label x and its +4px optical-center y offset. */
export const STRING_LABEL_X = 24;
export const LABEL_Y_OFFSET = 4;

/** §12.1 — the "open" label at `(42, 252)`. */
export const OPEN_LABEL = { x: OPEN_X, y: 252 } as const;

/**
 * §12.1 — the four open strings, top-to-bottom (E5, A4, D4, G3), each carrying
 * its `y` line position and its open-string pitch class (from S4's theory pkg,
 * not re-keyed here). Order is the on-screen top-to-bottom order, which is the
 * `stringIndex` the renderer uses for stable node identity.
 */
export const STRINGS: readonly { name: OpenString; y: number; pc: number }[] = [
  { name: 'E5', y: 68, pc: OPEN_STRING_PITCH_CLASS.E5 },
  { name: 'A4', y: 114, pc: OPEN_STRING_PITCH_CLASS.A4 },
  { name: 'D4', y: 160, pc: OPEN_STRING_PITCH_CLASS.D4 },
  { name: 'G3', y: 206, pc: OPEN_STRING_PITCH_CLASS.G3 },
];

/**
 * §12.1 — the column count per string: `NMAX = 15` (1 open + 14 stopped). The
 * column index `offset` runs `0 … NMAX − 1` (= `0 … 14`); re-exported from the
 * theory engine so the geometry and the classifier never disagree on the bound.
 */
export const COLUMN_COUNT = NMAX;

/** The `0 … NMAX − 1` column offsets, in order (`[0, 1, … 14]`). */
export const COLUMN_OFFSETS: readonly number[] = Array.from(
  { length: COLUMN_COUNT },
  (_unused, offset) => offset,
);

/** The stopped column offsets only (`[1, … 14]`) — one guide line per these. */
export const STOPPED_OFFSETS: readonly number[] = COLUMN_OFFSETS.filter(
  (offset) => offset > 0,
);

/**
 * §12.1 — the x of column `offset`.
 *
 *   offset === 0  → the open string at x = 42
 *   offset >= 1   → a stopped column at x = 96 + (offset − 1) × 44
 *
 * This is the geometric seam every later layer keys off: dots place at
 * `(xOf(columnOffset), S.y)`, and S7's tape/landmark band rects center on
 * `xOf(offset) − width/2` (§12.3). Keep the signature `xOf(offset: number)`
 * stable so S7 consumes it unchanged.
 */
export function xOf(offset: number): number {
  if (offset === 0) return OPEN_X;
  return STOPPED_BASE_X + (offset - 1) * STOPPED_STEP_X;
}
