// DrillMeter — the drill-context cents number-line meter (DESIGN.md §17.2 / C7).
// DESIGN.md wins on any design conflict (AGENTS.md).
//
// This component is PURELY PRESENTATIONAL: it takes `liveCents`, `inTune`,
// `targetLetter`, and `isRunning` as props and renders the SVG meter — no audio,
// no hook, no Web Audio — so it unit-tests against crafted props in jsdom.
//
// Design delta vs TunerMeter (§17.2 ancestry, not a copy):
//   1. Reference is the intended drill degree, not nearest-12-TET — the axis zero
//      tick is "on target", and the in-dot label is the TARGET DEGREE LETTER.
//   2. Echo trail: 2–3 lower-opacity ghost dots behind the live dot communicate
//      recency/direction. Ghost dots are rendered as SVG nodes whose cx attribute
//      is updated imperatively via a useEffect each render (same pattern as the
//      dot's transform write in TunerMeter). Under prefers-reduced-motion: reduce
//      the trail is suppressed by CSS (.drill-echo { visibility: hidden }) and the
//      imperitive updates are skipped.
//   3. Taller mint zero tick — the center anchor is taller than §17.2 to foreground
//      the "target" concept; still a hairline stroke, never a filled element (§2.4).
//   4. Soft ±5 mint zone — a low-opacity mint rect spanning centsToX(-5) to
//      centsToX(5) signals the in-tune window without a new color token.
//
// Motion (§17.8, no motion library):
//   • The dot's x is written DIRECTLY each render from liveCents — NOT a CSS
//     transition (a transition lags the signal, §17.8).
//   • Only the discrete seeking→in-tune morph (radius + glow) is transitioned,
//     on --dot-radius / --ease-spring + --glow-fade — same as TunerMeter.
//   • Under prefers-reduced-motion: reduce, morph collapses to instant; echo trail
//     suppressed via CSS; dot position still tracks (it is data).
//
// Geometry import: this component imports centsToX and radius constants directly
// from ../tuner/meter-geometry.ts — a deliberate cross-feature reference. The
// geometry is a single source of truth shared between the Tuner meter and this
// drill meter. If a future refactor wants to move meter-geometry.ts to a shared
// location, that is a separate concern — documented here so reviewers know it is
// intentional, not an oversight.

import { useEffect, useRef } from 'react';

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
} from '../tuner/meter-geometry.ts';

import './intonation.css';

/** Maximum number of echo ghost-dot entries in the trail. */
const ECHO_MAX = 3;

/** Per-slot opacity (index 0 = most-recent echo). */
const ECHO_OPACITIES: readonly [number, number, number] = [0.35, 0.22, 0.10];

/** Props for the DrillMeter — a presentational reading of the live drill state. */
export interface DrillMeterProps {
  /**
   * Signed cents of the live pitch vs the intended degree.
   * null = no signal (dot parks at center, no glow, no in-tune morph).
   */
  liveCents: number | null;
  /**
   * True iff |liveCents| ≤ 5 AND a signal is present — drives the in-tune morph.
   * The component never self-computes this; it is a prop from the hook.
   */
  inTune: boolean;
  /**
   * The current target's degree letter (e.g. "D", "B♭") — shown inside the dot
   * ONLY in tune (§12.2 root-dot label exception, §17.2).
   */
  targetLetter: string;
  /**
   * Whether the drill is running. When false the meter renders an idle/blank
   * state (dot at center, no glow, no label).
   */
  isRunning: boolean;
}

/**
 * The drill-context cents number-line meter (§17.2 dot-echo language, C7).
 * Presentational; renders the drill's live cents deviation from the target
 * degree on a −50 … 0 … +50 axis with the same dot-echo vocabulary as
 * TunerMeter — but the zero tick is "on target" for the drill, not "globally
 * in tune". No audio — driven entirely by props.
 */
export function DrillMeter({ liveCents, inTune, targetLetter, isRunning }: DrillMeterProps) {
  // Echo trail: refs to the ghost SVG circle elements. We render exactly ECHO_MAX
  // ghost nodes (always in the DOM), and update their cx and opacity imperatively
  // in a useEffect so reads/writes happen outside render — same pattern as the
  // dot's transform write in TunerMeter.
  const echo0Ref = useRef<SVGCircleElement | null>(null);
  const echo1Ref = useRef<SVGCircleElement | null>(null);
  const echo2Ref = useRef<SVGCircleElement | null>(null);
  const echoNodeRefs = [echo0Ref, echo1Ref, echo2Ref] as const;

  // Ring buffer of the last ECHO_MAX liveCents values (prior renders). Updated
  // imperatively in useEffect — never read during render.
  const trailRef = useRef<number[]>([]);

  // The in-tune morph applies only when the drill is running AND a real signal
  // is present (§17.7 — a silent / idle meter is never green).
  const showInTune = isRunning && inTune && liveCents !== null;
  const x = liveCents !== null && isRunning ? centsToX(liveCents) : CENTER_X;
  const radius = showInTune ? IN_TUNE_RADIUS : SEEKING_RADIUS;

  // The target letter appears INSIDE the dot ONLY in tune (§17.2 root-dot label).
  const inDotLabel = showInTune ? targetLetter : '';

  // ±5-cent zone bounds on the axis.
  const zoneLeft = centsToX(-5);
  const zoneRight = centsToX(5);
  const zoneWidth = zoneRight - zoneLeft;

  // Imperatively update echo ghost positions and opacity after each render.
  // This is the same "write directly to the SVG attribute" pattern the dot's
  // transform uses (§17.8 — position is data, not chrome). We use useEffect so
  // the read+write of the trail ref happens outside render (satisfying the
  // react-hooks/refs rule), after the DOM is committed.
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || liveCents === null || !isRunning) {
      // Clear trail and hide all ghost nodes.
      trailRef.current = [];
      for (const ref of echoNodeRefs) {
        const node = ref.current;
        if (node) {
          node.setAttribute('cx', String(CENTER_X));
          node.setAttribute('opacity', '0');
          node.setAttribute('data-echo', 'false');
        }
      }
      return;
    }

    // Update: stamp the current liveCents as the newest trail entry.
    const trail = [liveCents, ...trailRef.current].slice(0, ECHO_MAX);
    trailRef.current = trail;

    // Write each ghost node's position and opacity from the trail.
    for (let i = 0; i < ECHO_MAX; i++) {
      const node = echoNodeRefs[i]?.current;
      if (!node) continue;

      const cents = trail[i];
      if (cents !== undefined) {
        node.setAttribute('cx', String(centsToX(cents)));
        node.setAttribute('opacity', String(ECHO_OPACITIES[i] ?? 0.10));
        node.setAttribute('data-echo', 'true');
      } else {
        node.setAttribute('cx', String(CENTER_X));
        node.setAttribute('opacity', '0');
        node.setAttribute('data-echo', 'false');
      }
    }
  });

  return (
    <svg
      className="drill-meter"
      viewBox={`0 0 ${String(VIEW_W)} ${String(VIEW_H)}`}
      // §11.3 — the meter is decorative chrome; the drill's aria-live announcer
      // (C10) is the AT voice. role="img" + aria-label keeps it from exposing
      // per-frame churn to AT.
      role="img"
      aria-label={
        !isRunning
          ? 'Drill meter: idle'
          : liveCents !== null
            ? `Drill meter: ${targetLetter}, ${formatCents(liveCents)}`
            : 'Drill meter: no signal'
      }
    >
      {/* The axis baseline — a hairline rule the dot rides (§17.2). */}
      <line
        className="drill-axis"
        x1={CENTER_X - TRAVEL_HALF}
        y1={AXIS_Y}
        x2={CENTER_X + TRAVEL_HALF}
        y2={AXIS_Y}
      />

      {/* ±5-cent in-tune zone — a low-opacity mint rect communicating the window
          without a new color token. Opacity ≤0.15 so it never challenges the dot
          or zero tick as the primary visual (§2.4). */}
      <rect
        className="drill-zone"
        x={zoneLeft}
        y={AXIS_Y - 10}
        width={zoneWidth}
        height={20}
        rx={2}
      />

      {/* The center tick — taller than §17.2 to foreground the "target" anchor.
          Still a hairline stroke, never a filled element (§2.4). */}
      <line
        className="drill-tick drill-tick-center"
        x1={CENTER_X}
        y1={AXIS_Y - 20}
        x2={CENTER_X}
        y2={AXIS_Y + 20}
      />

      {/* Side ticks at ±25¢ and ±50¢ — shorter reference marks. */}
      {([-50, -25, 25, 50] as const).map((c) => (
        <line
          key={c}
          className="drill-tick"
          x1={centsToX(c)}
          y1={AXIS_Y - 8}
          x2={centsToX(c)}
          y2={AXIS_Y + 8}
        />
      ))}

      {/* Direction labels — `flat ♭` (left) / `sharp ♯` (right). The ♭/♯ glyph
          backs the side with LANGUAGE, never colour alone (§17.7 / §11.1). */}
      <text className="drill-dir drill-dir-flat" x={CENTER_X - TRAVEL_HALF} y={AXIS_Y + 34}>
        flat ♭
      </text>
      <text className="drill-dir drill-dir-sharp" x={CENTER_X + TRAVEL_HALF} y={AXIS_Y + 34}>
        sharp ♯
      </text>

      {/* Echo trail — ECHO_MAX ghost nodes always present in the DOM. Their cx /
          opacity are updated imperatively in useEffect (above). The .drill-echo
          class provides the CSS fallback to hide them under prefers-reduced-motion:
          reduce. data-echo is set to 'true' when a ghost is active, 'false' when
          idle — used by tests to count live ghost nodes. */}
      <circle
        ref={echo0Ref}
        className="drill-echo"
        data-echo="false"
        cx={CENTER_X}
        cy={AXIS_Y}
        r={SEEKING_RADIUS}
        opacity={0}
      />
      <circle
        ref={echo1Ref}
        className="drill-echo"
        data-echo="false"
        cx={CENTER_X}
        cy={AXIS_Y}
        r={SEEKING_RADIUS}
        opacity={0}
      />
      <circle
        ref={echo2Ref}
        className="drill-echo"
        data-echo="false"
        cx={CENTER_X}
        cy={AXIS_Y}
        r={SEEKING_RADIUS}
        opacity={0}
      />

      {/* The live dot — a §12.2 node. The wrapper class drives the seeking→in-tune
          morph (intonation.css transitions r + glow opacity); the x is set DIRECTLY
          via transform each render from liveCents (NOT a CSS transition — §17.8).
          data-in-tune is a stable seam for tests. */}
      <g
        className={`drill-dot-g${showInTune ? ' is-in-tune' : ''}`}
        data-in-tune={showInTune ? 'true' : 'false'}
        data-cents={liveCents !== null && isRunning ? Math.round(liveCents) : ''}
        transform={`translate(${String(x)}, ${String(AXIS_Y)})`}
      >
        {/* glow — present in DOM always, shown only in tune via CSS (.is-in-tune
            .drill-glow). Opacity fades on --glow-fade (§17.8). */}
        <circle className="drill-glow" cx={0} cy={0} r={GLOW_RADIUS} fill="none" />
        {/* dot — the state circle; r morphs in/out on --ease-spring (§17.8). */}
        <circle className="drill-dot" cx={0} cy={0} r={radius} />
        {/* in-dot label — Inter, ONLY in tune (§17.2 / §3 exception).
            The target degree letter is shown on the solid mint root dot. */}
        <text
          className="drill-dot-lbl"
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

/** Format a signed cents value for the meter's accessible label (e.g. "+4 cents"). */
function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  if (rounded === 0) return 'in tune';
  return `${rounded > 0 ? '+' : ''}${String(rounded)} cents`;
}
