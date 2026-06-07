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

import type { Density, Handedness, Orientation } from './mapView';

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

/**
 * §12.5 string ordering along the CROSS axis (slot 0 = top in horizontal, left in
 * vertical), as STRINGS indices `[E5=0, A4=1, D4=2, G3=3]`.
 *
 *   horizontal + right → [0,1,2,3]  (E,A,D,G top→bottom — today's map)
 *   vertical   + right → [3,2,1,0]  (G,D,A,E left→right — player's-eye)
 *   horizontal + left  → [3,2,1,0]  (mirror of the rows)
 *   vertical   + left  → [0,1,2,3]  (E,A,D,G left→right)
 *
 * Set DELIBERATELY per the S16 spec — never derive vertical order by rotating the
 * E-top array (that trap puts E on the left for a right-handed player).
 */
export function crossOrder(
  orientation: Orientation,
  handedness: Handedness,
): readonly number[] {
  const ascending = (orientation === 'horizontal') === (handedness === 'right');
  return ascending ? [0, 1, 2, 3] : [3, 2, 1, 0];
}

/** A resolved view config (orientation already resolved — never 'auto'). */
export interface AxisConfig {
  orientation: Orientation;
  handedness: Handedness;
  density: Density;
}

/** The geometry the renderer needs for a given config (pure; no DOM). */
export interface MapLayout {
  viewBoxWidth: number;
  viewBoxHeight: number;
  viewBox: string;
  /** Center of the dot at (stringIndex 0..3, columnOffset 0..14), in viewBox px. */
  dotCenter(stringIndex: number, columnOffset: number): { cx: number; cy: number };
}

// Neck-axis (along the columns) position, density-dependent. `fit` reuses the
// §12.1 values verbatim (open 42, stopped 96 + (o−1)×44) so horizontal+fit dot
// centers are byte-identical to today; `comfort` spaces columns wider so the neck
// is longer than the viewport and scrolls.
const NECK_FIT = { open: OPEN_X, base: STOPPED_BASE_X, step: STOPPED_STEP_X };
const NECK_COMFORT = { open: 30, base: 86, step: 56 };
const NECK_MARGIN = 36;

// Cross-axis (across the strings). Horizontal reuses the §12.1 string y-values
// (base 68, step 46) so horizontal+fit reproduces the legacy 264 height exactly;
// vertical packs the 4 strings across a narrow phone.
// The y-values (68, 114) are transcribed verbatim from the STRINGS literal above —
// using array indexing would require non-null assertions under noUncheckedIndexedAccess.
const CROSS_H_BASE = 68; // STRINGS[0].y — E5
const CROSS_H_STEP = 46; // STRINGS[1].y − STRINGS[0].y — 114 − 68
const CROSS_H = { base: CROSS_H_BASE, step: CROSS_H_STEP };
const CROSS_V = { base: 56, step: 82 };
const CROSS_MARGIN_H = VIEWBOX_HEIGHT - (CROSS_H.base + 3 * CROSS_H.step); // = 58 → height 264
const CROSS_MARGIN_V = 50;

function neckPos(offset: number, density: Density): number {
  const n = density === 'fit' ? NECK_FIT : NECK_COMFORT;
  return offset === 0 ? n.open : n.base + (offset - 1) * n.step;
}

export function axisOf(config: AxisConfig): MapLayout {
  const { orientation, handedness, density } = config;
  const order = crossOrder(orientation, handedness);
  const cross = orientation === 'horizontal' ? CROSS_H : CROSS_V;
  const crossMargin = orientation === 'horizontal' ? CROSS_MARGIN_H : CROSS_MARGIN_V;

  const neckExtent = neckPos(COLUMN_COUNT - 1, density) + NECK_MARGIN;
  const crossExtent = cross.base + 3 * cross.step + crossMargin;

  const crossPos = (stringIndex: number): number =>
    cross.base + order.indexOf(stringIndex) * cross.step;

  const dotCenter = (stringIndex: number, columnOffset: number) => {
    const along = neckPos(columnOffset, density);
    const across = crossPos(stringIndex);
    return orientation === 'horizontal'
      ? { cx: along, cy: across }
      : { cx: across, cy: along };
  };

  const viewBoxWidth = orientation === 'horizontal' ? neckExtent : crossExtent;
  const viewBoxHeight = orientation === 'horizontal' ? crossExtent : neckExtent;
  return {
    viewBoxWidth,
    viewBoxHeight,
    viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
    dotCenter,
  };
}
