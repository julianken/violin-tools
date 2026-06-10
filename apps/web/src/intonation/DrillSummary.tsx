// DrillSummary — the end-of-run summary panel (Intonation epic C8, #138).
// DESIGN.md wins on any conflict (AGENTS.md). This component is PURELY
// PRESENTATIONAL: it takes a completed DrillRunState (results + plan) and
// renders the per-degree signed-cents breakdown, callout, tendency statement,
// and post-run actions.
//
// Data contract (verified against C3/#133 and C5/#135):
//   - props.results: readonly NoteResult[] — one entry per completed target in
//     sequence order. Length may be < plan.length for an incomplete run (absent
//     entries, never null-bearing — C3 emits a NoteResult only on advance).
//   - props.plan: readonly DrillTarget[] — the full drill plan; used to join
//     degreeLabel via result.targetIndex and to derive ascending/descending in
//     deriveTendency.
//
// No red anywhere (§2.6 / §17.7): {danger} / red-500 / #e5644e never appear.
// The ramp is mint→amber only (C4/#134); the no-red rule is tested in the
// component tests (AC4).
//
// Voice is §13 throughout — descriptive and factual, never judgmental
// (DESIGN.md §13). The tendency line is the one piece of prose this
// component generates.
//
// TODO: replace the local NoteResult / DrillTarget interfaces with the upstream
// exports from noteTracker (#133) and drillPlan (#131) once those are merged.

import './intonation.css';
import {
  deriveTendency,
  farthestResult,
  formatSignedCents,
  meanAbsCents,
} from './drillSummary.utils.ts';
import { type DrillTarget, type NoteResult } from './intonation.types.ts';

// TODO: replace with rampColor import from C4/#134 once merged.
// This stub is a transparent placeholder: it accepts the signed medianCents
// (rampColor owns Math.abs per the C4 spec), and maps |cents| linearly from
// mint-500 (#00d4a4) at 0¢ toward amber-400 (#caa45f) at ≥ 30¢. No red.
function rampColorStub(medianCents: number): string {
  const MINT_R = 0;
  const MINT_G = 212;
  const MINT_B = 164;
  const AMBER_R = 202;
  const AMBER_G = 164;
  const AMBER_B = 95;
  const CLAMP = 30;
  const t = Math.min(Math.abs(medianCents) / CLAMP, 1);
  const r = Math.round(MINT_R + t * (AMBER_R - MINT_R));
  const g = Math.round(MINT_G + t * (AMBER_G - MINT_G));
  const b = Math.round(MINT_B + t * (AMBER_B - MINT_B));
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

// Use the real rampColor when available (integration); fall back to the stub
// until C4 merges. The import will be replaced at integration time.
const rampColor: (medianCents: number) => string = rampColorStub;

export interface DrillSummaryProps {
  /**
   * Scored results — one entry per completed target degree in sequence order.
   * Length may be less than plan.length if the run ended before all targets
   * advanced. C3 emits a NoteResult only on advance, so absent targets are
   * absent from the array, not null-bearing entries.
   */
  results: readonly NoteResult[];
  /**
   * The full drill plan — used to join degreeLabel from DrillTarget via
   * result.targetIndex and to compute the ascending/descending split for the
   * tendency algorithm.
   */
  plan: readonly DrillTarget[];
  /**
   * The scale name + run descriptor for the summary header.
   * Canonical format from C9's RunHeader: "<scaleName> · 2 octaves · target <n>/<total>".
   */
  runLabel: string;
  /** Callback: restart the same drill immediately. */
  onRunAgain: () => void;
  /** Callback: return to scale-map view (C9 wires setView('scale-map')). */
  onNewScale: () => void;
}

/**
 * DrillSummary renders the post-run summary panel when
 * DrillRunState.phase === 'complete'. It is mounted/unmounted by the
 * view-assembly layer (C9) — this component does not own that lifecycle.
 */
export function DrillSummary({
  results,
  plan,
  runLabel,
  onRunAgain,
  onNewScale,
}: DrillSummaryProps) {
  const labelId = 'drill-summary-label';

  // Derived stats — pure one-pass computations over results.
  const avg = meanAbsCents(results);
  const farthest = farthestResult(results);
  const tendency = deriveTendency(results, plan);

  return (
    <section
      className="drill-summary"
      role="region"
      aria-labelledby={labelId}
    >
      {/* Run header — orients the player: which scale, how many octaves */}
      <h2 id={labelId} className="drill-summary-header">
        {runLabel}
      </h2>

      {/* Per-degree list */}
      {results.length > 0 ? (
        <ol className="drill-summary-list" aria-label="Per-degree results">
          {results.map((result) => {
            const target = plan[result.targetIndex];
            // target may be undefined if plan is shorter than expected at
            // integration; guard gracefully.
            const degreeLabel = target?.degreeLabel ?? `#${String(result.targetIndex)}`;
            const swatchColor = rampColor(result.medianCents);
            const centsFormatted = formatSignedCents(result.medianCents);

            return (
              <li key={result.targetIndex} className="drill-summary-row">
                <span
                  className="drill-summary-swatch"
                  style={{ backgroundColor: swatchColor }}
                  aria-hidden="true"
                />
                <span className="drill-summary-degree">{degreeLabel}</span>
                <span className="drill-summary-cents">{centsFormatted}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="drill-summary-empty">No targets completed.</p>
      )}

      {/* Average + farthest callout */}
      {results.length > 0 && (
        <div className="drill-summary-callout">
          <p className="drill-summary-callout-line">
            Average:{' '}
            <span className="drill-summary-callout-value">
              ±{avg.toFixed(1)} ¢
            </span>
          </p>
          {farthest !== null && (
            <p className="drill-summary-callout-line">
              Farthest:{' '}
              <span className="drill-summary-callout-value">
                {plan[farthest.targetIndex]?.degreeLabel ??
                  `#${String(farthest.targetIndex)}`}{' '}
                at {formatSignedCents(farthest.medianCents)}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Tendency line — §13 prose; omitted entirely (not an empty element)
          when deriveTendency returns null. */}
      {tendency !== null && (
        <p className="drill-summary-tendency" aria-label="Intonation tendency">
          {tendency}
        </p>
      )}

      {/* 12-TET caveat — subdued informational line. Include per the issue spec
          (open question 4: include unless the plan-review or owner declines;
          the plan-review approved inclusion). C9 can thread A4 Hz as a prop
          when a concrete value is needed. */}
      <p className="drill-summary-caveat">
        Targets are 12-TET relative to the chosen A4 reference.
      </p>

      {/* Post-run actions */}
      <div className="drill-summary-actions">
        <button
          type="button"
          className="drill-summary-action drill-summary-action--primary"
          onClick={onRunAgain}
          aria-label={`Run again — ${runLabel}`}
        >
          Run again
        </button>
        <button
          type="button"
          className="drill-summary-action drill-summary-action--secondary"
          onClick={onNewScale}
          aria-label="Choose a new scale"
        >
          New scale
        </button>
      </div>
    </section>
  );
}
