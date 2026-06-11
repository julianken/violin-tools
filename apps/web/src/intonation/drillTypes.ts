// drillTypes.ts — the C6 per-target display record and shared drill types.
//
// Pure types only — no React, no DOM, no audio. C5 (useIntonationDrill) and
// C6 (DrillMap) both import from here. C5 populates the DrillDot array; C6
// renders it onto the note map.

/**
 * The three states a drill dot can be in:
 *   - 'pending'  — not yet reached; rendered with the {in-scale-fill} token.
 *   - 'active'   — the player's current target; rendered with a pulse ring.
 *   - 'played'   — already scored; rendered with the C4 ramp fill color.
 */
export type DrillDotState = 'pending' | 'active' | 'played';

/**
 * C6 per-target display record — the unit of state DrillMap renders.
 * Populated by C5 (useIntonationDrill) from the drillPlan + NoteResult array.
 *
 * Invariants:
 *   - `rampColor` is only meaningful when `state === 'played'`; other states
 *     ignore it.
 *   - `letter` is the scale-degree label shown inside the dot (e.g. "D", "F♯").
 *   - `stringIndex` + `columnOffset` address the dot via `axisOf(...).dotCenter`.
 */
export interface DrillDot {
  /** String index 0–3 (E5=0, A4=1, D4=2, G3=3) — the §12.1 cross-order index. */
  stringIndex: number;
  /** Column offset 0–14 — semitones from the open string (§12.1). */
  columnOffset: number;
  /** The scale-degree letter shown inside the dot (e.g. "A", "B", "C♯"). */
  letter: string;
  /** The C4 ramp fill color — only applied when `state === 'played'`. */
  rampColor: string;
  /** Whether this target is pending, active (current), or played (scored). */
  state: DrillDotState;
}
