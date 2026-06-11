// DrillMap — the C6 note-map drill overlay (issue #136).
//
// Renders the note map in drill mode: drill dots with scale-degree letters +
// state-driven fill (ramp for 'played', in-scale-fill for 'pending', active
// highlight), an active-target pulse ring (gated on prefers-reduced-motion),
// and a discrete fingerboard-window re-frame driven by the player's position.
//
// DESIGN.md wins on any design conflict (AGENTS.md). §12.1/§12.2 own the
// geometry and dot visuals; §7 owns motion values; rampColor (C4) owns fill
// colors for played dots; drillWindow.ts owns the re-frame logic. This
// component owns ONLY the display of drill state onto the map.
//
// SCOPE: this component is purely additive — it does NOT modify NoteMap.tsx,
// geometry.ts, or motion.ts. It renders an SVG fragment (same shape as
// NoteMap) that the shell mounts alongside NoteMap inside the <svg id="board">
// (or in place of it in drill mode, per the C9 view-wiring story).
//
// Fingerboard window: the map container is clipped to show only the current
// DRILL_WINDOW_SIZE columns. A CSS `transform: translateX / translateY` (per
// orientation) advances the window discretely at position boundaries. Under
// prefers-reduced-motion: reduce the re-frame is instant (transition: none).

import { useMemo, useState } from 'react';

import {
  axisOf,
  LABEL_Y_OFFSET,
  STOPPED_OFFSETS,
  STRINGS,
} from '../notemap/geometry';
import type { Handedness, Orientation, ResolvedDensity } from '../notemap/mapView';

import type { DrillDot } from './drillTypes';
import { DRILL_WINDOW_SIZE, resolveWindowAdvance, windowStartFor } from './drillWindow';
import './drillmap.css';

/** §12.2 in-scale dot radius — used for all drill dot states. */
const DRILL_DOT_RADIUS = 14;

/** Initial pulse ring radius (at rest). */
const PULSE_RING_RADIUS_REST = 17;

interface DrillMapProps {
  /**
   * The drill dots to render — one per scale degree target. Populated by
   * C5 (`useIntonationDrill`) from the drillPlan + NoteResult array.
   * When empty, the map renders with no drill overlay (pre-run state).
   */
  dots: readonly DrillDot[];
  /**
   * The resolved render orientation — `'horizontal'` | `'vertical'`.
   * Already resolved from the user's mode; the shell threads the concrete
   * value. Defaults to `'horizontal'`.
   */
  orientation?: Orientation;
  /** Player handedness — `'right'` (default) | `'left'`. */
  handedness?: Handedness;
  /**
   * Neck-axis spacing — `'fit'` (default) | `'comfort'`. The RESOLVED
   * render type (never `'auto'`); same contract as NoteMap.
   */
  density?: ResolvedDensity;
  /**
   * The §0 fill color for pending dots — the token value string.
   * Defaults to `var(--in-scale-fill)` (the §12.2 in-scale fill).
   */
  pendingFill?: string;
}

const DEFAULT_ORIENTATION: Orientation = 'horizontal';
const DEFAULT_HANDEDNESS: Handedness = 'right';
const DEFAULT_DENSITY: ResolvedDensity = 'fit';
const DEFAULT_PENDING_FILL = 'var(--in-scale-fill)';

/**
 * The DrillMap renders the note map in drill mode as an SVG fragment (for
 * mounting inside `<svg id="board">`). It renders the static chrome (strings,
 * nut, guides) plus the drill-dot overlay (letters + state-driven fill +
 * active pulse ring) + the discrete fingerboard window re-frame.
 */
export function DrillMap({
  dots,
  orientation = DEFAULT_ORIENTATION,
  handedness = DEFAULT_HANDEDNESS,
  density = DEFAULT_DENSITY,
  pendingFill = DEFAULT_PENDING_FILL,
}: DrillMapProps) {
  // Resolve the §12.1 layout for this axis config — same call NoteMap uses.
  const layout = useMemo(
    () => axisOf({ orientation, handedness, density }),
    [orientation, handedness, density],
  );

  // ── Fingerboard window state ────────────────────────────────────────────
  // The window start is derived from the active-target column offset. We
  // store `{ prevOffset, prevOrientation, prevDensity, windowStart }` as
  // state so we can detect boundary crossings without effects or ref mutation
  // during render. This uses React's "store previous props in state" pattern:
  // if the stored values are stale, we call setState during the render and
  // immediately return the same JSX (React will re-render synchronously with
  // the updated state). See https://react.dev/learn/you-might-not-need-an-effect#storing-information-from-previous-renders
  const activeOffset = useMemo(() => {
    const active = dots.find((d) => d.state === 'active');
    return active?.columnOffset ?? 0;
  }, [dots]);

  interface WindowState {
    prevOffset: number;
    prevOrientation: Orientation;
    prevDensity: ResolvedDensity;
    windowStart: number;
  }

  const [windowState, setWindowState] = useState<WindowState>(() => ({
    prevOffset: activeOffset,
    prevOrientation: orientation,
    prevDensity: density,
    windowStart: windowStartFor(activeOffset),
  }));

  // If orientation/density changed, reset the window to the current offset.
  // If only the active offset changed, apply boundary-crossing logic.
  // Both paths call setWindowState during render — this is the React "store
  // previous render data" pattern; React re-renders with the new state
  // synchronously in the same frame.
  let windowStart = windowState.windowStart;
  const layoutChanged =
    orientation !== windowState.prevOrientation || density !== windowState.prevDensity;
  if (layoutChanged) {
    const next = windowStartFor(activeOffset);
    setWindowState({ prevOffset: activeOffset, prevOrientation: orientation, prevDensity: density, windowStart: next });
    windowStart = next;
  } else if (activeOffset !== windowState.prevOffset) {
    const next = resolveWindowAdvance(
      windowState.prevOffset,
      activeOffset,
      windowState.windowStart,
    );
    const nextWindowStart = next ?? windowState.windowStart;
    setWindowState({ prevOffset: activeOffset, prevOrientation: orientation, prevDensity: density, windowStart: nextWindowStart });
    windowStart = nextWindowStart;
  }

  // ── Reduced-motion preference ──────────────────────────────────────────
  // Read once at mount; `prefers-reduced-motion: reduce` suppresses the pulse
  // ring element entirely (the AC says "absent, not just invisible").
  // Guard: jsdom does not implement matchMedia, so check before calling.
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // ── Window translate (the re-frame CSS transform) ───────────────────────
  // The translate shifts the drill-dot layer so that column windowStart aligns
  // with the left (horizontal) or top (vertical) edge of the chrome area.
  // The chrome (strings/nut/guides) renders BEHIND this container at full
  // neck width; the container clips to the window via CSS overflow:hidden on
  // the parent SVG (or a clipPath — here we use a translate offset to position
  // only the dots within the visible area, keeping the chrome always visible).
  //
  // The neck-axis position of column `windowStart` is neckPos(windowStart).
  // Translating by −neckPos(windowStart) + neckPos(0) slides the dots so that
  // the first visible column aligns with the nut end. We use the layout's own
  // dotCenter to compute the per-column neckPos as the center of column 0 on
  // string 0 vs. windowStart on string 0.
  const origin = layout.dotCenter(0, 0);
  const windowEdge = layout.dotCenter(0, windowStart);
  const translateX =
    orientation === 'horizontal' ? origin.cx - windowEdge.cx : 0;
  const translateY =
    orientation === 'vertical' ? origin.cy - windowEdge.cy : 0;

  const windowTransform =
    translateX !== 0 || translateY !== 0
      ? `translate(${String(translateX)}, ${String(translateY)})`
      : undefined;

  return (
    <>
      {/* Static chrome — guide lines, nut, string lines, labels — same as
          NoteMap but rendered here so the DrillMap is a complete, standalone
          SVG fragment (the §12.1 chrome is behind the drill dots). */}
      <g className="chrome" aria-hidden="true">
        {STOPPED_OFFSETS.map((offset) => {
          const guide = layout.guideLine(offset);
          return (
            <line
              key={`drill-guide-${String(offset)}`}
              className="guide"
              x1={guide.x1}
              y1={guide.y1}
              x2={guide.x2}
              y2={guide.y2}
            />
          );
        })}
        {(() => {
          const nut = layout.nutRect();
          return (
            <rect
              className="nut"
              x={nut.x}
              y={nut.y}
              width={nut.width}
              height={nut.height}
            />
          );
        })()}
        {STRINGS.map((string, stringIndex) => {
          const line = layout.stringLine(stringIndex);
          return (
            <line
              key={`drill-string-${string.name}`}
              className="string-line"
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
            />
          );
        })}
        {/* §12.2 column-0 rule, drill form: the string name renders at the open
            slot iff no dot occupies it. DrillMap draws no open-string dots of
            its own, so occupancy is a PLAN-LEVEL test — does the whole plan put
            a drill target at columnOffset 0 on this string? — never a window-
            visibility check, so a name never flashes in/out as the drill window
            translates. The names live in this fixed chrome group (NOT the
            translated .drill-window group) so they stay pinned during re-frames. */}
        {STRINGS.map((string, stringIndex) => {
          const slotOccupied = dots.some(
            (d) => d.stringIndex === stringIndex && d.columnOffset === 0,
          );
          if (slotOccupied) return null;
          const { cx, cy } = layout.dotCenter(stringIndex, 0);
          return (
            <text
              key={`drill-string-name-${string.name}`}
              className="string-name"
              x={cx}
              y={cy + LABEL_Y_OFFSET}
              textAnchor="middle"
            >
              {string.name}
            </text>
          );
        })}
        {(() => {
          const open = layout.openLabelPos();
          return (
            <text className="open-label" x={open.x} y={open.y} textAnchor="middle">
              open
            </text>
          );
        })()}
      </g>

      {/* Drill dots — placed in a translated container so the fingerboard
          window re-frame is a single CSS transform on this group. The dots
          render at their full §12.1 positions; the transform slides them
          so the current window aligns with the viewport. */}
      <g
        className="drill-window"
        transform={windowTransform}
        aria-label={`Drill mode, showing columns ${String(windowStart)} to ${String(windowStart + DRILL_WINDOW_SIZE - 1)}`}
      >
        {dots.map((dot) => {
          const { stringIndex, columnOffset, letter, state } = dot;
          const { cx, cy } = layout.dotCenter(stringIndex, columnOffset);

          const isActive = state === 'active';
          const isPlayed = state === 'played';

          // Fill: played → ramp color; active → in-scale-fill (same as pending
          // but pulse ring distinguishes it); pending → in-scale-fill.
          const dotFill = isPlayed ? dot.rampColor : pendingFill;

          // Stroke: all drill dots use the §12.2 in-scale stroke ({mint}, 1.5px).
          // This matches the "pending" and "active" in-scale treatment.
          const dotStroke = 'var(--mint)';

          const wrapperClass = `drill-dot${isActive ? ' is-active' : ''}${isPlayed ? ' is-played' : ''}`;

          return (
            <g
              key={`drill-${String(stringIndex)}-${String(columnOffset)}`}
              className={wrapperClass}
              aria-label={`${letter}, ${state}`}
            >
              {/* The drill dot circle — §12.2 in-scale radius (14px). */}
              <circle
                className="drill-dot-circle"
                cx={cx}
                cy={cy}
                r={DRILL_DOT_RADIUS}
                fill={dotFill}
                stroke={dotStroke}
                strokeWidth={1.5}
              />

              {/* Pulse ring — additive ring on the active dot. Rendered only
                  when NOT in reduced-motion mode (AC: "absent, not just
                  invisible"). In normal motion mode it is present on all dots
                  but animated only on the active one via .is-active CSS. */}
              {!prefersReducedMotion && (
                <circle
                  className="drill-pulse"
                  cx={cx}
                  cy={cy}
                  r={PULSE_RING_RADIUS_REST}
                />
              )}

              {/* Scale-degree letter — same geometry as NoteMap lbl (§12.2):
                  `y = cy + LABEL_Y_OFFSET`, `textAnchor="middle"`, `aria-hidden`.
                  The letter is the caller's responsibility (from C5's drillPlan
                  → note spelling). */}
              <text
                className="drill-lbl"
                x={cx}
                y={cy + LABEL_Y_OFFSET}
                textAnchor="middle"
                aria-hidden="true"
              >
                {letter}
              </text>
            </g>
          );
        })}
      </g>
    </>
  );
}

