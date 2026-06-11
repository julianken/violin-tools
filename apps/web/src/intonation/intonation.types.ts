/**
 * intonation.types.ts — shared types for the Intonation epic (C1–C10).
 *
 * These local interfaces mirror the shapes that upstream producers will export
 * once their issues are merged:
 *   - NoteResult — from C3/noteTracker (#133): { targetIndex; intendedHz;
 *     medianCents; frameCount }
 *   - DrillTarget — from C2/drillPlan (#131): { index; midiNote; hz; degreeLabel }
 *
 * TODO: replace with NoteResult from noteTracker (#133) and DrillTarget from
 * drillPlan (#131) once merged.
 *
 * DESIGN.md wins on any conflict (AGENTS.md).
 */

/**
 * One scored target result. Emitted by C3's noteTracker when a target advances;
 * a run of N completed targets yields an array of length N (not a full-length
 * array with null entries for unreached degrees).
 *
 * C3 (#133) definition:
 *   NoteResult = { targetIndex; intendedHz; medianCents; frameCount }
 */
export interface NoteResult {
  /** Zero-based index into the DrillTarget plan array. */
  targetIndex: number;
  /** The 12-TET Hz of the target pitch vs. the chosen A4. */
  intendedHz: number;
  /**
   * Median signed cents from the target (negative = flat, positive = sharp).
   * Non-nullable: C3 emits a NoteResult only when a target advances, so this
   * value is always present.
   */
  medianCents: number;
  /** Number of audio frames that contributed to the median. */
  frameCount: number;
}

/**
 * One step in the drill plan. C2 (#131) produces a symmetric 2-octave up-down
 * sequence; the peak index (the topmost note before the descent) is
 * Math.floor(plan.length / 2).
 *
 * C2 (#131) definition:
 *   DrillTarget = { index; midiNote; hz; degreeLabel }
 */
export interface DrillTarget {
  /** Zero-based position in the plan; matches NoteResult.targetIndex. */
  index: number;
  /** MIDI note number. */
  midiNote: number;
  /** 12-TET Hz vs. the chosen A4. */
  hz: number;
  /**
   * Human-readable degree label (e.g. "A₄", "B♭₄", "C♯₅").
   * Uses the §12.2 / §13 letter-convention spellings.
   */
  degreeLabel: string;
}
