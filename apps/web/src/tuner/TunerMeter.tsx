// TunerMeter — the dot-echo meter, the Tuner's signature (DESIGN.md §17.2).
// DESIGN.md §17 wins on any conflict (AGENTS.md). This component is PURELY
// PRESENTATIONAL: it takes a stabilized reading (cents / inTune / note / octave)
// as PROPS and renders the SVG meter, with NO audio, no hook, no Web Audio — so it
// unit-tests against crafted props in jsdom (the off vs in-tune morph, the dot's
// x-position, the in-dot label appearing only in tune) exactly the way the pure
// math layers do (§17 testability seam).
//
// The signature is a deliberate REUSE of the note map (§17.2): the detected pitch
// IS a §12.2 dot riding a horizontal cents axis (−50 … 0 … +50). It does NOT invent
// a second visual language — the same in-scale-dot → root-dot morph the note map
// already specifies (§7.1) is what plays here on the discrete off→in-tune change:
//   • OFF / seeking (|cents| > 5): the §12.2 IN-SCALE dot — {mint} stroke, in-scale
//     fill, r≈14, NO label inside — sitting off-centre at the live cents.
//   • IN TUNE (|cents| ≤ 5): the §12.2 ROOT dot — solid {mint}, r=15, plus the
//     root-glow ring — with the note name INSIDE in Inter (the sole §3 "music =
//     mono" exception, §17.2; the readout outside the dot stays Geist Mono).
//
// Motion (§17.8, no motion library): the dot's X is written DIRECTLY each frame
// from `cents` (a transform, never a CSS transition — a transition would LAG the
// signal). Only the discrete radius morph (--ease-spring) + glow fade (--glow-fade)
// are transitioned, in tuner.css, off the `is-in-tune` class — exactly the §12.2
// in-scale↔root transitions, reused. Under reduced motion (§17.8) the morph
// collapses to instant but the dot's position keeps tracking (it is data).

import { type OpenString } from '@violin-tools/theory';

import {
  AXIS_Y,
  CENTER_X,
  centsToX,
  GLOW_RADIUS,
  IN_TUNE_RADIUS,
  LABEL_Y_OFFSET,
  SEEKING_RADIUS,
  TRAVEL_HALF,
  VIEW_H,
  VIEW_W,
} from './meter-geometry.ts';

/** Props for the meter — a stabilized reading, plus whether a signal is present. */
export interface TunerMeterProps {
  /** Signed cents from the held note (negative = flat, + = sharp). */
  cents: number;
  /** True iff `|cents| ≤ 5` — drives the off→in-tune morph (§17.2). */
  inTune: boolean;
  /** The held note name (Geist-Mono everywhere EXCEPT this in-dot label, §17.2). */
  note: string;
  /** The held note's octave (rendered in the readout, not the dot). */
  octave: number;
  /** The nearest open string, or null (highlighted in the chip row, not here). */
  nearestString: OpenString | null;
  /**
   * Whether a confident signal is currently present. When false (idle / silence)
   * the dot parks at center and reads as "no pitch yet" — it is NOT drawn in-tune
   * (a centered green dot with no sound would be a false positive, §17.7).
   */
  hasSignal: boolean;
}

/**
 * The dot-echo meter (§17.2). Presentational; renders the cents axis, the center
 * tick, the `flat ♭` / `sharp ♯` direction labels, and the dot whose x-position
 * is the live cents value and whose state (in-scale vs root) is the off→in-tune
 * morph. No audio — driven entirely by props.
 */
export function TunerMeter({
  cents,
  inTune,
  note,
  octave,
  nearestString: _nearestString,
  hasSignal,
}: TunerMeterProps) {
  // In tune ONLY when a real signal is present (§17.7 — a silent meter is never
  // green). With no signal the dot parks at center as a neutral seeking dot.
  const showInTune = hasSignal && inTune;
  const x = hasSignal ? centsToX(cents) : CENTER_X;
  const radius = showInTune ? IN_TUNE_RADIUS : SEEKING_RADIUS;
  // The note name shows INSIDE the dot ONLY in tune (§17.2 root-dot label); while
  // seeking the in-scale dot carries no label.
  const inDotLabel = showInTune ? note : '';

  return (
    <svg
      className="tuner-meter"
      viewBox={`0 0 ${String(VIEW_W)} ${String(VIEW_H)}`}
      // §11.3 — the meter is decorative chrome for the live readout, which the
      // visually-hidden status region announces. role="img" with a name keeps it
      // from exposing per-frame churn to AT (the announcer is the throttled voice).
      role="img"
      aria-label={
        hasSignal
          ? `Tuning meter: ${note}${String(octave)}, ${formatCents(cents)}`
          : 'Tuning meter: no pitch detected'
      }
    >
      {/* The axis baseline — a hairline rule the dot rides (§17.2). */}
      <line
        className="tuner-axis"
        x1={CENTER_X - TRAVEL_HALF}
        y1={AXIS_Y}
        x2={CENTER_X + TRAVEL_HALF}
        y2={AXIS_Y}
      />
      {/* The center tick — a faint 1px {mint} hairline anchor at 0¢ (§17.2). NOT
          a filled element, so it never challenges the root dot as the lone fill. */}
      <line
        className="tuner-tick"
        x1={CENTER_X}
        y1={AXIS_Y - 14}
        x2={CENTER_X}
        y2={AXIS_Y + 14}
      />
      {/* Direction labels — `flat ♭` (left) / `sharp ♯` (right). The ♭/♯ glyph
          backs the side with LANGUAGE, never colour alone (§17.7 / §11.1). */}
      <text className="tuner-dir tuner-dir-flat" x={CENTER_X - TRAVEL_HALF} y={AXIS_Y + 34}>
        flat ♭
      </text>
      <text className="tuner-dir tuner-dir-sharp" x={CENTER_X + TRAVEL_HALF} y={AXIS_Y + 34}>
        sharp ♯
      </text>

      {/* The dot — a §12.2 node. The wrapper class drives the off→in-tune morph
          (tuner.css transitions r + glow opacity); the x is set DIRECTLY via
          transform each render from the live cents (NOT a CSS transition — §17.8).
          data-in-tune is a stable seam the e2e/units read. */}
      <g
        className={`tuner-dot-g${showInTune ? ' is-in-tune' : ''}`}
        data-in-tune={showInTune ? 'true' : 'false'}
        data-cents={hasSignal ? Math.round(cents) : ''}
        transform={`translate(${String(x)}, ${String(AXIS_Y)})`}
      >
        {/* glow — present always, shown only in tune via `.is-in-tune .tuner-glow`
            (the §12.2 root-glow ring; opacity fades on --glow-fade, §17.8). */}
        <circle className="tuner-glow" cx={0} cy={0} r={GLOW_RADIUS} fill="none" />
        {/* dot — the state circle; r morphs in/out on --ease-spring (§17.8). */}
        <circle className="tuner-dot" cx={0} cy={0} r={radius} />
        {/* in-dot label — Inter, ONLY in tune (§17.2 / §3 exception). */}
        <text
          className="tuner-dot-lbl"
          x={0}
          y={LABEL_Y_OFFSET}
          textAnchor="middle"
          aria-hidden="true"
        >
          {inDotLabel}
        </text>
      </g>
    </svg>
  );
}

/** Format a signed cents value for the meter's accessible name (e.g. "+4 cents"). */
function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  if (rounded === 0) return 'in tune';
  return `${rounded > 0 ? '+' : ''}${String(rounded)} cents`;
}
