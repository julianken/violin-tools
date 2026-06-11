// RunHeader — the dumb presentational run-header for the Intonation view (C9).
//
// Receives the current drill state as props and renders the run summary line:
//   "<scaleName> · 2 octaves · target <n>/<total>"
//
// Voice is §13 teacher-tone: musical facts only. "2 octaves" is fixed for v1
// (the epic's AC; per the intonation epic scope all runs are 2 octaves, up–down).
// The copy "target <n>/<total>" is the placeholder for C5/C8 real wiring; the
// exact final copy is confirmed at those plan-reviews (open question 4 in the
// epic spec). This component carries no logic — all drill lifecycle state lives
// in useIntonationDrill (C5). No motion, no library.

/** Props for the run header — all values come from useIntonationDrill (C5). */
export interface RunHeaderProps {
  /** The §13 spelled scale name (e.g. "B♭ Major"), from scaleName(controls.state). */
  scaleName: string;
  /** Zero-based index of the current drill target (0 = first target). */
  targetIndex: number;
  /** Total number of targets in this run (e.g. 29 for a two-octave scale). */
  targetCount: number;
}

/**
 * The run header bar. Renders a single descriptive line that states what scale is
 * being drilled, that it spans 2 octaves, and where the player is in the run.
 * The 1-based "target n/total" copy follows §13: it states a musical fact without
 * explaining to the player what they already know.
 */
export function RunHeader({ scaleName, targetIndex, targetCount }: RunHeaderProps) {
  // Display as 1-based ("target 1/29", not "target 0/29") so it reads naturally.
  // Clamp to targetCount so a terminal index (targetIndex === targetCount) can never
  // render an out-of-range ordinal — defense-in-depth for the same off-by-one #177
  // fixes in IntonationView's runLabel (this header renders only in the running
  // branch today, so the overflow is latent here, not live).
  const displayIndex = Math.min(targetIndex + 1, targetCount);

  return (
    <div className="run-header">
      <span className="run-header-scale">{scaleName}</span>
      <span className="run-header-sep" aria-hidden="true">
        {' · '}
      </span>
      <span className="run-header-octaves">2 octaves</span>
      <span className="run-header-sep" aria-hidden="true">
        {' · '}
      </span>
      <span className="run-header-progress">
        target {displayIndex}/{targetCount}
      </span>
    </div>
  );
}
