// RefLayers — the §12.3 reference overlays of the fingerboard note map: the
// beginner tape bands and the heel / octave / position landmarks. DESIGN.md §12.3
// (geometry), §0/§3 (tokens, typography), and §7.1/§7.5 (the `.hide` visibility
// contract + the panel-reveal slide hook) win on any conflict (AGENTS.md). The
// pure geometry + variant logic lives in the sibling `refOverlays.ts`; this file
// is the React render only (so it exports a single component — fast-refresh clean).
//
// These render as TWO SVG groups BEHIND the dots (the caller mounts <RefLayers>
// before <NoteMap> so the bands paint under the note nodes — §12.3 "live in their
// own SVG groups"). Every band/label keys off the S5 `xOf(offset)` seam — it is
// CONSUMED here, never recomputed — so the overlays sit on the same column grid as
// the dots. No pitch model and no scale classification live here (that is S6 /
// §12.5): a tape at `+4` is at `+4` regardless of root or scale.
//
// Transition-readiness (the S8 attach contract — STRUCTURE ONLY, no motion):
//   • `.hide` is the visibility mechanism (§7.1) — the `.tape` and `.land` groups
//     are ALWAYS mounted; turning a layer off adds `.hide`, it never unmounts the
//     node. Tape 2 under "3-tape" stays mounted-but-hidden the same way (its own
//     `.hide`). S8's opacity tweens (§7.5) attach to nodes already in the DOM, so
//     it never restructures the tree.
//   • Tape 2 carries the transitions-dev panel-reveal (07) hook — the
//     `t-panel-slide` class + a `data-open` attribute — so S8 can drive the
//     `+4`↔`+3` "low 2" translate (230ms `ease-spring-2`, §7.5) without
//     restructuring. S7 renders only the correct END-STATE `x` for each variant
//     and authors NO transition/keyframe/stagger (motion is S8).
// Every color resolves to a §0 token via the classes in notemap.css — no hard-
// coded hex here.

import { type RefsState } from '../state/controls';

import { xOf } from './geometry';
import './notemap.css';
import {
  BAND_HEIGHT,
  BAND_RX,
  BAND_Y,
  HEEL_DASH_Y,
  HEEL_HALF,
  HEEL_OFFSET,
  HEEL_WIDTH,
  LABEL_BOTTOM_Y,
  LABEL_TOP_Y,
  OCTAVE_HALF,
  OCTAVE_OFFSET,
  OCTAVE_WIDTH,
  POS_LABEL_Y,
  POSITION_LABELS,
  TAPE_HALF,
  TAPE_SPECS,
  TAPE_WIDTH,
  tapeLabel,
  tapeOffset,
} from './refOverlays';

interface RefLayersProps {
  /** The four independent Refs toggles (§9.1) that drive overlay visibility. */
  refs: RefsState;
}

/**
 * The §12.3 reference overlays: the `.tape` group (four tape bands + number
 * labels) and the `.land` group (heel band + dashed underline + "heel ⌄", octave
 * band + "octave ◈" + "½ string", and the four position labels). Returned as an
 * SVG fragment so it mounts as children of the shell's `<svg id="board">`,
 * BEFORE the note nodes so the bands paint behind the dots (§12.3).
 *
 * Visibility is the `.hide` class (§7.1), never a mount/unmount: the `Tapes` pill
 * toggles `.hide` on the `.tape` group; the `Landmarks` pill toggles `.hide` on
 * the `.land` group (octave + heel + position labels together). Tape 2 under
 * "3-tape" carries its own `.hide`, staying mounted. NO motion is authored here.
 */
export function RefLayers({ refs }: RefLayersProps) {
  return (
    <>
      {/* Tape group (§12.3 / §7.1) — `.hide` when the Tapes pill is off; kept
          mounted so S8 can attach the opacity tween. The bands paint behind the
          dots because this group is rendered before <NoteMap>. */}
      <g className={`tape${refs.tapes ? '' : ' hide'}`} aria-hidden="true">
        {TAPE_SPECS.map((spec) => {
          const offset = tapeOffset(spec, refs);
          const center = xOf(offset);
          const isTape2 = spec.low2Offset !== undefined;
          // "3-tape" hides tape 2 — mounted-but-hidden via `.hide`, NOT removed.
          const hidden = isTape2 && refs.threeTape;
          // Tape 2 carries the panel-reveal (07) hook so S8 can drive the
          // `+4`↔`+3` slide; S7 renders the end-state x only and animates nothing.
          const bandClass = isTape2
            ? `tape-band t-panel-slide${hidden ? ' hide' : ''}`
            : 'tape-band';
          return (
            <g
              key={`tape-${String(spec.num)}`}
              className={bandClass}
              // `data-open` is the panel-reveal end-state flag for S8 (default
              // +4 = open, "low 2" +3 = closed); only meaningful on tape 2.
              data-open={isTape2 ? !refs.low2 : undefined}
            >
              <rect
                className="tape-rect"
                x={center - TAPE_HALF}
                y={BAND_Y}
                width={TAPE_WIDTH}
                height={BAND_HEIGHT}
                rx={BAND_RX}
              />
              <text className="tape-num" x={center} y={LABEL_TOP_Y} textAnchor="middle">
                {tapeLabel(spec, offset)}
              </text>
            </g>
          );
        })}
      </g>

      {/* Landmark group (§12.3 / §7.1) — `.hide` when the Landmarks pill is off;
          the heel band, the octave band, and the four position labels all live
          here so a single `.hide` toggle governs them together (§12.3). */}
      <g className={`land${refs.landmarks ? '' : ' hide'}`} aria-hidden="true">
        {/* Heel / position landmark ({violet}, 5th position, column offset 9). */}
        <rect
          className="heel-rect"
          x={xOf(HEEL_OFFSET) - HEEL_HALF}
          y={BAND_Y}
          width={HEEL_WIDTH}
          height={BAND_HEIGHT}
          rx={BAND_RX}
        />
        <line
          className="heel-dash"
          x1={xOf(HEEL_OFFSET) - HEEL_HALF}
          y1={HEEL_DASH_Y}
          x2={xOf(HEEL_OFFSET) + HEEL_HALF}
          y2={HEEL_DASH_Y}
        />
        <text
          className="heel-label"
          x={xOf(HEEL_OFFSET)}
          y={LABEL_BOTTOM_Y}
          textAnchor="middle"
        >
          heel ⌄
        </text>

        {/* Octave landmark ({teal}, 7th position, column offset 12). The two
            labels share `octave-label` color but differ in family AND size: the
            top "octave ◈" is Geist Mono 9px, the bottom "½ string" is Inter 8px
            (§3) — two separate <text> elements. */}
        <rect
          className="octave-rect"
          x={xOf(OCTAVE_OFFSET) - OCTAVE_HALF}
          y={BAND_Y}
          width={OCTAVE_WIDTH}
          height={BAND_HEIGHT}
          rx={BAND_RX}
        />
        <text
          className="octave-label octave-top"
          x={xOf(OCTAVE_OFFSET)}
          y={LABEL_TOP_Y}
          textAnchor="middle"
        >
          octave ◈
        </text>
        <text
          className="octave-label octave-bottom"
          x={xOf(OCTAVE_OFFSET)}
          y={LABEL_BOTTOM_Y}
          textAnchor="middle"
        >
          ½ string
        </text>

        {/* Position labels (§12.3) — Inter 10px/600 tnum below the map at y=252.
            Inside `.land` so they toggle with the Landmarks pill. */}
        {POSITION_LABELS.map((pos) => (
          <text
            key={`pos-${String(pos.offset)}`}
            className="pos-label"
            x={xOf(pos.offset)}
            y={POS_LABEL_Y}
            textAnchor="middle"
          >
            {pos.text}
          </text>
        ))}
      </g>
    </>
  );
}
