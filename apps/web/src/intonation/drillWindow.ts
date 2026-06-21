// drillWindow.ts — discrete fingerboard-window re-frame logic for C6.
//
// Pure: no React, no DOM, no audio. The DrillMap uses this module to decide
// which column slice of the neck is visible at any moment during a drill run.
//
// DESIGN (§18.2): the visible neck slice is a contiguous window of COLUMN_OFFSETS
// anchored at the OPEN END. The window stays anchored to the open string (the nut
// and the open-string identifiers stay visible) for the whole of first position,
// and only advances up the neck once the active target climbs beyond it — a
// discrete re-frame, not a continuous scroll. Because notes are assigned to the
// highest open string at or below their pitch (drillDots.ts), a 2-octave scale's
// targets distribute across the four strings and almost always stay inside first
// position, so the window seldom advances at all — but a scale whose second octave
// climbs high on the E string (e.g. an E- or F-rooted 2-octave run reaching E6)
// does cross into the upper neck, and then the window re-frames once.
//
// First-position window (violin convention):
//   The open string (col 0) through the 4th-finger reach. The 4th finger reaches a
//   perfect 4th above the open string normally (col 5) and a 5th when extended
//   (col 7); a 9-column window (open + cols 1–8) holds that span with headroom, so
//   the nut and the active target are BOTH visible for every first-position target.
//
// The window advances only when the active target reaches col ≥ 9 (a major 6th or
// higher on a single string — the player has shifted out of first position). The
// re-frame fires one §7 transition on the .drill-window translate (§18.8), instant
// under prefers-reduced-motion (drillmap.css §7.4 guard).
//
// Derivation is direct: DrillMap computes windowStart = windowStartFor(activeOffset)
// each render. The auto-follow drill advances the active target monotonically up to
// the peak and back down (§18.6), so it crosses the single col-9 boundary at most
// twice and never oscillates — no hysteresis state machine is needed to stay
// jitter-free.

/**
 * The number of columns in the open-anchored first-position window
 * (open + cols 1–8 = the 4th-finger reach with headroom).
 */
export const DRILL_WINDOW_SIZE = 9;

/**
 * Window-start anchors, as the MINIMUM active column offset that selects each.
 *
 *   0 → first position, anchored at the open end (windowStart 0 → cols 0–8)
 *   9 → upper neck (the active target has climbed out of first position)
 *
 * `windowStartFor` snaps to the highest anchor at or below the active offset, then
 * clamps so the window fits the 15-column neck (the col-9 anchor clamps to a
 * windowStart of 6 → cols 6–14, the only other discrete window position).
 */
export const POSITION_BOUNDARIES: readonly number[] = [0, 9];

/** Total column count per string (NMAX = 15, offsets 0–14). */
const TOTAL_COLUMNS = 15;

/**
 * Return the `windowStart` offset for a given active column offset.
 *
 * The window is the contiguous slice `[windowStart, windowStart + DRILL_WINDOW_SIZE)`.
 * It is always clamped so `windowStart + DRILL_WINDOW_SIZE - 1 <= TOTAL_COLUMNS - 1`.
 *
 * Logic: find the highest position anchor that does not exceed `activeOffset`, then
 * set `windowStart` to that anchor (clamped to the neck). This is a pure function —
 * it derives the window from the active column, with no memory of prior state — so
 * the window stays anchored at the open end (windowStart 0) for every target in
 * first position (offsets 0–8) and only advances when the active target reaches the
 * upper neck (offset ≥ 9).
 *
 * @param activeOffset - The column offset of the current active drill target.
 * @returns The window start offset (0-indexed, ≥ 0).
 */
export function windowStartFor(activeOffset: number): number {
  // Find the highest anchor ≤ activeOffset.
  let anchor = 0;
  for (const b of POSITION_BOUNDARIES) {
    if (b <= activeOffset) anchor = b;
    else break;
  }
  // Clamp so the window fits within the neck.
  const maxStart = TOTAL_COLUMNS - DRILL_WINDOW_SIZE;
  return Math.min(anchor, maxStart);
}

/**
 * Check whether a given column offset is visible in the current window.
 *
 * @param columnOffset  - The column offset to test (0–14).
 * @param windowStart   - The current window start offset.
 * @returns `true` if `columnOffset` falls within `[windowStart, windowStart + DRILL_WINDOW_SIZE)`.
 */
export function isColumnVisible(columnOffset: number, windowStart: number): boolean {
  return columnOffset >= windowStart && columnOffset < windowStart + DRILL_WINDOW_SIZE;
}

/**
 * Return the column offsets visible in a given window — a contiguous slice of
 * COLUMN_OFFSETS starting at `windowStart` with length `DRILL_WINDOW_SIZE`.
 * Used by tests and by consumers that need to enumerate visible columns.
 *
 * @param windowStart - The window start offset (0–TOTAL_COLUMNS−DRILL_WINDOW_SIZE).
 * @returns The array of column offsets in the window.
 */
export function visibleOffsets(windowStart: number): readonly number[] {
  const result: number[] = [];
  for (let o = windowStart; o < windowStart + DRILL_WINDOW_SIZE && o < TOTAL_COLUMNS; o++) {
    result.push(o);
  }
  return result;
}
