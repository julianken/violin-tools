// A4Calibration — the reference-pitch control (DESIGN.md §17.5). DESIGN.md §17 wins
// on any conflict (AGENTS.md). It sets the A4 the cents math is computed against:
// `A = 440 Hz`, adjustable 415–446, default 440 — rendered as −/+ steppers flanking
// a Geist-Mono value (a technical numeral, §17.5). Each stepper is keyboard-operable
// and carries a ≥44px (`touch-target-min`, WCAG 2.5.5) hit target via transparent
// hit-padding (the §10/§8 idiom), not a 44px painted box. The control introduces NO
// new colour and NO second solid fill (§17.5 / §2.4).
//
// Presentational + controlled: it takes the current `a4` and an `onChange`, clamps
// to the theory range, and never owns the value (the hook does). The clamp lives in
// `clampA4` (@violin-tools/theory) so the bounds are the single source of truth.

import { A4_MAX, A4_MIN, clampA4 } from '@violin-tools/theory';

/** One Hz per stepper press — the finest adjustment the §17.5 range needs. */
const STEP_HZ = 1;

interface A4CalibrationProps {
  /** The current A4 reference in Hz (already clamped to 415–446 by the hook). */
  a4: number;
  /** Set a new A4; the parent clamps via the hook, this clamps defensively too. */
  onChange: (a4: number) => void;
}

/**
 * The A4 calibration stepper (§17.5). `−` / value / `+`: the steppers disable at the
 * range ends (so the value can't run past 415 / 446), the value is Geist-Mono tnum,
 * and the whole control is a labelled group for AT.
 */
export function A4Calibration({ a4, onChange }: A4CalibrationProps) {
  const atMin = a4 <= A4_MIN;
  const atMax = a4 >= A4_MAX;

  const step = (delta: number): void => {
    onChange(clampA4(a4 + delta));
  };

  return (
    <div className="a4-cal" role="group" aria-label="A4 calibration reference">
      <span className="a4-cal-caption" id="a4-cal-caption">
        Reference pitch
      </span>
      <div className="a4-cal-row">
        <button
          type="button"
          className="a4-step"
          aria-label="Lower the A4 reference by 1 hertz"
          onClick={() => {
            step(-STEP_HZ);
          }}
          disabled={atMin}
        >
          −
        </button>
        {/* The value — Geist-Mono tnum (§17.5). aria-live polite so a stepper change
            is announced; the unit is spoken via the wrapping label. */}
        <span className="a4-cal-value" aria-live="polite" aria-atomic="true">
          <span className="a4-cal-num">{`A = ${String(a4)}`}</span>
          <span className="a4-cal-unit"> Hz</span>
        </span>
        <button
          type="button"
          className="a4-step"
          aria-label="Raise the A4 reference by 1 hertz"
          onClick={() => {
            step(STEP_HZ);
          }}
          disabled={atMax}
        >
          +
        </button>
      </div>
    </div>
  );
}
