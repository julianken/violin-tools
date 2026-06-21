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
// Fingerboard window (§18.2): the drill dots render at their full §12.1 neck
// positions inside a translated `.drill-window` group, and a real <clipPath> on a
// static wrapper restricts that group to the visible window slice — so columns
// outside the window are HIDDEN, never half-painted at the SVG edge. The window is
// anchored at the open end (windowStart 0) for the whole of first position
// (drillWindow.ts), so the translate is the identity for first-position targets and
// the nut / open-string identifiers sit undisturbed at the open slot. The translate
// is non-zero only when the active target climbs into the upper neck; then the open
// column scrolls out of view, the open-end chrome (string names, nut, "open" label)
// is absent (there is no open column on screen), and the clip hides the off-window
// dots. The re-frame is one §7 transition on the group's transform (§18.8), instant
// under prefers-reduced-motion (drillmap.css §7.4 guard).

import { useId, useMemo } from 'react';

import {
  axisOf,
  LABEL_Y_OFFSET,
  STOPPED_OFFSETS,
  STRINGS,
} from '../notemap/geometry';
import type { Handedness, Orientation, ResolvedDensity } from '../notemap/mapView';

import type { DrillDot } from './drillTypes';
import { DRILL_WINDOW_SIZE, windowStartFor } from './drillWindow';
import './drillmap.css';

/** §12.2 in-scale dot radius — used for all drill dot states. */
const DRILL_DOT_RADIUS = 14;

/** Initial pulse ring radius (at rest). */
const PULSE_RING_RADIUS_REST = 17;

/**
 * Clip half-margin along the neck axis: large enough to keep a window-edge dot and
 * its active pulse ring (r ≤ 22) fully visible, small enough to exclude the adjacent
 * out-of-window column (neck step ≥ 44, so its near edge sits ≥ 30px past the edge
 * column's center). Picked at 24 — inside that 30px gap, outside the 22px pulse.
 */
const WINDOW_CLIP_PAD = 24;

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

  // ── Fingerboard window ──────────────────────────────────────────────────
  // The window start is a pure function of the active-target column offset
  // (drillWindow.ts): it stays 0 (open-anchored) for the whole of first position
  // and advances only when the active target climbs to the upper neck. The
  // auto-follow drill moves the active target monotonically up then down (§18.6),
  // so deriving windowStart directly each render is jitter-free — no previous-state
  // machine is needed.
  const activeOffset = useMemo(() => {
    const active = dots.find((d) => d.state === 'active');
    return active?.columnOffset ?? 0;
  }, [dots]);
  const windowStart = windowStartFor(activeOffset);

  // The open column (nut, open-string identifiers, "open" label) is on screen only
  // while the window is anchored at the open end. Once it scrolls into the upper
  // neck the open-end chrome is absent — there is no open column to label (§18.2).
  const isOpenColumnVisible = windowStart === 0;

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
  // Translating by −neckPos(windowStart) + neckPos(0) slides the dot layer so the
  // window's first column aligns with the open end. For first-position targets
  // windowStart is 0, so this is the identity (no translate) and the dots sit at
  // their true §12.1 positions over the chrome.
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

  // ── Window clip ─────────────────────────────────────────────────────────
  // A real <clipPath> in viewBox space, on a STATIC wrapper around the translated
  // group, so it clips the dots to the FIXED screen region the window always maps
  // into — column windowStart → neckPos(0) … column windowStart+SIZE−1 → neckPos(
  // SIZE−1) — regardless of windowStart. Columns outside the window (translated past
  // either edge) fall outside the clip and are hidden, instead of bleeding off the
  // SVG edge or onto the open-column chrome. clipPathUnits defaults to userSpaceOnUse
  // in the wrapper's (untranslated) user space, so the rect coordinates are viewBox
  // coordinates. The id is per-instance (useId) so multiple boards never collide.
  const clipId = `drill-window-clip-${useId().replace(/:/g, '')}`;
  const windowEndCenter = layout.dotCenter(0, DRILL_WINDOW_SIZE - 1);
  const clipRect =
    orientation === 'horizontal'
      ? {
          x: origin.cx - WINDOW_CLIP_PAD,
          y: 0,
          width: windowEndCenter.cx - origin.cx + 2 * WINDOW_CLIP_PAD,
          height: layout.viewBoxHeight,
        }
      : {
          x: 0,
          y: origin.cy - WINDOW_CLIP_PAD,
          width: layout.viewBoxWidth,
          height: windowEndCenter.cy - origin.cy + 2 * WINDOW_CLIP_PAD,
        };

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={clipRect.x} y={clipRect.y} width={clipRect.width} height={clipRect.height} />
        </clipPath>
      </defs>

      {/* Static chrome — guide lines, nut, string lines, labels — same as
          NoteMap but rendered here so the DrillMap is a complete, standalone
          SVG fragment (the §12.1 chrome is behind the drill dots). The open-end
          markers (nut, open-string names, "open" label) render only while the
          open column is in the window (§18.2). */}
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
        {isOpenColumnVisible &&
          (() => {
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
            visibility check, so a name never flashes in/out as the active target
            moves WITHIN first position. The names live in this fixed chrome group
            (NOT the translated .drill-window group) so they stay pinned. They are
            present only while the open column is on screen (windowStart 0); once
            the window advances to the upper neck the open slot is off screen, so
            the names are absent rather than mislabeling the scrolled dots. */}
        {isOpenColumnVisible &&
          STRINGS.map((string, stringIndex) => {
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
        {isOpenColumnVisible &&
          (() => {
            const open = layout.openLabelPos();
            return (
              <text className="open-label" x={open.x} y={open.y} textAnchor="middle">
                open
              </text>
            );
          })()}
      </g>

      {/* Drill dots — placed in a translated container so the fingerboard
          window re-frame is a single CSS transform on this group, and clipped to
          the window slice by the static wrapper above it. The dots render at their
          full §12.1 positions; the transform slides them so the current window
          aligns with the open end, and the clip hides any column outside it. */}
      <g clipPath={`url(#${clipId})`}>
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
      </g>
    </>
  );
}
