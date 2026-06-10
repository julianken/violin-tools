// drillWindow.ts — discrete fingerboard-window re-frame logic for C6.
//
// Pure: no React, no DOM, no audio. The DrillMap uses this module to decide
// which column slice of the neck is visible at any moment during a drill run.
//
// DESIGN: The visible neck slice is a contiguous window of COLUMN_OFFSETS.
// Today's full-neck map shows all 15 columns (offsets 0–14). During a drill
// the player climbs the neck; the window advances discretely at position
// boundaries so the active target stays visible.
//
// Position boundaries used here (violin first-position convention):
//   Position 1: offsets 0–4   (open + semitones 1–4, i.e. up to 4th finger)
//   Position 2: offsets 5–8
//   Position 3: offsets 9–12
//   Position 4+: offsets 13–14
//
// The window size is 5 columns (fits first position with the open string) —
// this gives the player a position-width viewport into the neck. Advancing one
// boundary shifts the window start forward; reversing below a boundary shifts
// it back. No jitter: the boundary that advanced the window must be re-crossed
// in the OPPOSITE direction before a reverse re-frame is triggered.

/** The number of columns in one position window (open + 4 stopped). */
export const DRILL_WINDOW_SIZE = 5;

/**
 * Position boundary thresholds.
 *
 * Each threshold is the MINIMUM column offset that belongs to a given position.
 * When the active column offset first meets or exceeds a threshold, the window
 * advances to show that position. When it drops BELOW the threshold that last
 * triggered an advance, the window retreats.
 *
 * Boundaries:
 *   0  → position 1 (the initial window — offsets 0–4)
 *   5  → position 2 (offsets 5–9)
 *   9  → position 3 (offsets 9–13)
 *   13 → position 4 (offsets 13–14, clamped)
 *
 * Only one boundary per position-start; the boundary mid-values (e.g. 5, 9, 13)
 * are the enter points. The window windowStart is always a multiple of the step
 * between boundaries — we snap to the boundary's own offset.
 */
export const POSITION_BOUNDARIES: readonly number[] = [0, 5, 9, 13];

/** Total column count per string (NMAX = 15, offsets 0–14). */
const TOTAL_COLUMNS = 15;

/**
 * Return the `windowStart` offset for a given active column offset.
 *
 * The window is the contiguous slice `[windowStart, windowStart + DRILL_WINDOW_SIZE)`.
 * It is always clamped so `windowStart + DRILL_WINDOW_SIZE - 1 <= TOTAL_COLUMNS - 1`.
 *
 * Logic: find the highest position boundary that does not exceed `activeOffset`,
 * then set `windowStart` to that boundary. This is a pure function — it derives
 * the window from the active column, with no memory of prior state.
 *
 * @param activeOffset - The column offset of the current active drill target.
 * @returns The window start offset (0-indexed, ≥ 0).
 */
export function windowStartFor(activeOffset: number): number {
  // Find the highest boundary ≤ activeOffset.
  let boundary = 0;
  for (const b of POSITION_BOUNDARIES) {
    if (b <= activeOffset) boundary = b;
    else break;
  }
  // Clamp so the window fits within the neck.
  const maxStart = TOTAL_COLUMNS - DRILL_WINDOW_SIZE;
  return Math.min(boundary, maxStart);
}

/**
 * Determine whether advancing `activeOffset` from `prevOffset` should trigger
 * a window re-frame — and if so, return the new `windowStart`.
 *
 * Rules (matching the issue AC):
 *   - Crossing a boundary FORWARD: the window advances once the active offset
 *     reaches the boundary; the previous `windowStart` is below the boundary.
 *   - Crossing a boundary BACKWARD: the window retreats only when the active
 *     offset drops below the boundary that last triggered an advance.
 *   - No jitter: the same boundary crossed in the same direction does not
 *     re-frame unless it was crossed the other way in between.
 *
 * Returns `null` if no re-frame is needed; returns the new `windowStart` if
 * a re-frame should occur.
 *
 * @param prevOffset  - The active column offset before the step.
 * @param nextOffset  - The active column offset after the step.
 * @param currentWindowStart - The current window start offset.
 * @returns The new window start, or `null` if no re-frame.
 */
export function resolveWindowAdvance(
  _prevOffset: number,
  nextOffset: number,
  currentWindowStart: number,
): number | null {
  const newStart = windowStartFor(nextOffset);
  if (newStart !== currentWindowStart) return newStart;
  return null;
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
