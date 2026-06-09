// meter-geometry.ts — the pure coordinate math for the §17.2 dot-echo meter
// (S18 ph6). DESIGN.md §17 wins on any conflict (AGENTS.md). Split out of
// TunerMeter.tsx so that file exports ONLY its component (the Fast-Refresh
// constraint) and so the cents→x mapping is unit-testable without rendering.
//
// The meter's SVG coordinate system: a wide, short viewBox; the axis is horizontal
// and the dot rides it. The center (0¢) sits at CENTER_X; ±CLAMP_CENTS map to the
// edges of the dot's travel band. CSS scales the SVG to its container.

/** SVG viewBox width (user units). */
export const VIEW_W = 320;
/** SVG viewBox height (user units). */
export const VIEW_H = 120;
/** The axis center column (0¢) — half the width. */
export const CENTER_X = VIEW_W / 2;
/** The axis baseline y. */
export const AXIS_Y = 70;
/** The cents value that maps to the edge of the dot's travel (axis runs −50…+50). */
export const CLAMP_CENTS = 50;
/** Half-width of the dot's travel band in user units (inset so the dot never clips). */
export const TRAVEL_HALF = 130;
/** §12.2 in-scale dot radius (off / seeking). */
export const SEEKING_RADIUS = 14;
/** §12.2 root dot radius (in tune). */
export const IN_TUNE_RADIUS = 15;
/** §12.2 root-glow ring radius (r≈19). */
export const GLOW_RADIUS = 19;
/** Inter in-dot label baseline nudge (matches the note map's cy + 4, §12.2). */
export const LABEL_Y_OFFSET = 4;

/**
 * Map a signed cents deviation to the dot's x-coordinate on the axis. Clamped to
 * ±CLAMP_CENTS so a wild reading parks at the edge rather than flying off-meter;
 * the position is LINEAR in cents across the travel band (the axis is labelled
 * −50…0…+50, §17.2).
 */
export function centsToX(cents: number): number {
  const clamped = Math.max(-CLAMP_CENTS, Math.min(CLAMP_CENTS, cents));
  return CENTER_X + (clamped / CLAMP_CENTS) * TRAVEL_HALF;
}
