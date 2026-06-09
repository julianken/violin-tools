// RefLayers — the §12.3 reference overlays of the fingerboard note map: the
// beginner tape bands and the heel / octave / position landmarks. DESIGN.md §12.3
// (geometry), §0/§3 (tokens, typography), and §7.1/§7.5 (the `.hide` visibility
// contract + the panel-reveal slide hook) win on any conflict (AGENTS.md). The
// pure geometry + variant logic lives in the sibling `refOverlays.ts`; this file
// is the React render only (so it exports a single component — fast-refresh clean).
//
// These render as TWO SVG groups BEHIND the dots (the caller mounts <RefLayers>
// before <NoteMap> so the bands paint under the note nodes — §12.3 "live in their
// own SVG groups"). Every band/label is PROJECTED through the resolved `axisOf`
// layout (S17 ph B / #84) — the same `neckPos`/`crossPos` machinery the dots and
// static chrome use — so the overlays sit on the same column grid as the dots in
// BOTH orientations. HORIZONTAL is byte-identical to §12.3; VERTICAL swaps the
// axes (bands span the cross field centered on the neck column, the heel dash is a
// neck-aligned segment at the cross-end, labels move to the cross gutters upright).
// No pitch model and no scale classification live here (that is S6 / §12.5): a
// tape at `+4` is at `+4` regardless of root or scale.
//
// Transition-readiness (the S8 attach contract — STRUCTURE ONLY, no motion):
//   • `.hide` is the visibility mechanism (§7.1) — the `.tape` and `.land` groups
//     are ALWAYS mounted; turning a layer off adds `.hide`, it never unmounts the
//     node. Tape 2 under "3-tape" stays mounted-but-hidden the same way (its own
//     `.hide`). S8's opacity tweens (§7.5) attach to nodes already in the DOM, so
//     it never restructures the tree.
//   • Tape 2 carries the transitions-dev panel-reveal (07) hook — the
//     `t-panel-slide` class + a `data-open` attribute — so S8 drives the
//     `+4`↔`+3` "low 2" translate (230ms `ease-spring-2`, §7.5) without
//     restructuring. The slide DIRECTION is axis-aware: tape 2 carries an inline
//     `--low2-dx`/`--low2-dy` shift vector (the named-custom-property pattern,
//     AGENTS.md) computed from the geometry — horizontal {−44,0}, vertical {0,dy} —
//     and motion.css translates by `var(--low2-dx)`/`var(--low2-dy)` (transform
//     only, never an x/y attribute tween). Durations/easings stay §7 tokens.
// Every color resolves to a §0 token via the classes in notemap.css — no hard-
// coded hex here.

import { type CSSProperties } from 'react';

import { type RefsState } from '../state/controls';

import { axisOf, type MapLayout } from './geometry';
import type { Orientation } from './mapView';
import './notemap.css';
import {
  BAND_RX,
  HEEL_OFFSET,
  HEEL_WIDTH,
  OCTAVE_OFFSET,
  OCTAVE_WIDTH,
  POSITION_LABELS,
  TAPE_SPECS,
  TAPE_WIDTH,
  tapeLabel,
  tapeOffset,
} from './refOverlays';

interface RefLayersProps {
  /** The four independent Refs toggles (§9.1) that drive overlay visibility. */
  refs: RefsState;
  /**
   * The resolved §12.1 layout (`axisOf({orientation,handedness,density})`) the
   * caller already memoizes — every band/label is projected through it so the
   * overlays follow the render axis (S17 ph B). Defaults to the horizontal+right+fit
   * layout so a bare `<RefLayers refs=…>` render is byte-identical to today.
   */
  layout?: MapLayout;
  /**
   * The resolved render orientation (§12.1). Branches the two label-role
   * placements Figma `124-2` calls for (heel/octave names move to the lead/left
   * gutter on vertical; the position ordinals abbreviate). Defaults to
   * `'horizontal'`.
   */
  orientation?: Orientation;
}

// A bare render (the byte-identical desktop default) uses the §12.1 horizontal
// layout — the same one NoteMap memoizes for horizontal+right+fit.
const DEFAULT_LAYOUT = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });

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
export function RefLayers({
  refs,
  layout = DEFAULT_LAYOUT,
  orientation = 'horizontal',
}: RefLayersProps) {
  // The +4↔+3 "low 2" shift vector for tape 2, in the CURRENT axis. The slide is a
  // transform-only translate owned by motion.css (keyed on data-open); the band's
  // rect stays at its DEFAULT +4 column and this vector moves it to read as +3.
  // horizontal → {dx:-44, dy:0} (byte-identical to the old translateX(-44px));
  // vertical → {dx:0, dy:neckPos(3)−neckPos(4)} (slide along the neck).
  const low2From = layout.dotCenter(0, 4);
  const low2To = layout.dotCenter(0, 3);
  const low2Dx = orientation === 'horizontal' ? low2To.cx - low2From.cx : 0;
  const low2Dy = orientation === 'horizontal' ? 0 : low2To.cy - low2From.cy;

  return (
    <>
      {/* Tape group (§12.3 / §7.1) — `.hide` when the Tapes pill is off; kept
          mounted so S8 can attach the opacity tween. The bands paint behind the
          dots because this group is rendered before <NoteMap>. */}
      <g className={`tape${refs.tapes ? '' : ' hide'}`} aria-hidden="true">
        {TAPE_SPECS.map((spec) => {
          const offset = tapeOffset(spec, refs);
          const isTape2 = spec.low2Offset !== undefined;
          // The rect/label render at the band's DEFAULT column position; the
          // `+4`↔`+3` "low 2" displacement is owned by the panel-reveal `transform`
          // keyed off `data-open` (S8, motion.css) via the inline `--low2-d*`
          // vector, NOT by rewriting the SVG x/y — a CSS transform tween can't
          // catch an attribute change, and the band must physically translate to
          // read as a slide (§7.1/§7.5). So tape 2 sits at its default position and
          // the transform moves it; the label number still shows the ACTIVE offset
          // (`2 (+3)` under low 2). Static tapes use their default position.
          const band = layout.bandRect(spec.defaultOffset, TAPE_WIDTH);
          const lead = layout.overlayLeadLabel(spec.defaultOffset);
          // "3-tape" hides tape 2 — mounted-but-hidden via `.hide`, NOT removed.
          const hidden = isTape2 && refs.threeTape;
          // Tape 2 carries the panel-reveal (07) hook so S8 drives the `+4`↔`+3`
          // slide off `data-open`; the other tapes are static.
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
              // The axis-aware slide vector for tape 2 (the lone sliding band).
              // motion.css translates by these; horizontal {−44,0} is byte-identical
              // to the legacy translateX(-44px).
              style={
                isTape2
                  ? ({
                      '--low2-dx': `${String(low2Dx)}px`,
                      '--low2-dy': `${String(low2Dy)}px`,
                    } as CSSProperties)
                  : undefined
              }
            >
              <rect
                className="tape-rect"
                x={band.x}
                y={band.y}
                width={band.width}
                height={band.height}
                rx={BAND_RX}
              />
              <text
                className="tape-num"
                x={lead.x}
                y={lead.y}
                textAnchor={lead.anchor}
              >
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
        {/* Heel / position landmark ({violet}, 5th position, column offset 9). The
            heel NAME sits in the lead margin on horizontal (above the band) — but
            on vertical it moves to the cross-start (left) gutter per Figma 124-2
            (its col-9 row is free of tape numbers). */}
        {(() => {
          const heel = layout.bandRect(HEEL_OFFSET, HEEL_WIDTH);
          const dash = layout.heelDash(HEEL_OFFSET, HEEL_WIDTH);
          // Heel name: trail (below) on horizontal; lead (left gutter) on vertical.
          const heelLabel =
            orientation === 'horizontal'
              ? layout.overlayTrailLabel(HEEL_OFFSET)
              : layout.overlayLeadLabel(HEEL_OFFSET);
          return (
            <>
              <rect
                className="heel-rect"
                x={heel.x}
                y={heel.y}
                width={heel.width}
                height={heel.height}
                rx={BAND_RX}
              />
              <line
                className="heel-dash"
                x1={dash.x1}
                y1={dash.y1}
                x2={dash.x2}
                y2={dash.y2}
              />
              <text
                className="heel-label"
                x={heelLabel.x}
                y={heelLabel.y}
                textAnchor={heelLabel.anchor}
              >
                heel ⌄
              </text>
            </>
          );
        })()}

        {/* Octave landmark ({teal}, 7th position, column offset 12). The two
            labels share `octave-label` color but differ in family AND size: the
            top "octave ◈" is Geist Mono 9px, the bottom "½ string" is Inter 8px
            (§3) — two separate <text> elements on horizontal. On vertical the
            "½ string" bottom label is OMITTED (the right gutter holds the position
            ordinal at col 12 instead — §12.3, reconciled). */}
        {(() => {
          const octave = layout.bandRect(OCTAVE_OFFSET, OCTAVE_WIDTH);
          const octaveTop = layout.overlayLeadLabel(OCTAVE_OFFSET);
          const octaveBottom = layout.overlayTrailLabel(OCTAVE_OFFSET);
          return (
            <>
              <rect
                className="octave-rect"
                x={octave.x}
                y={octave.y}
                width={octave.width}
                height={octave.height}
                rx={BAND_RX}
              />
              <text
                className="octave-label octave-top"
                x={octaveTop.x}
                y={octaveTop.y}
                textAnchor={octaveTop.anchor}
              >
                octave ◈
              </text>
              {orientation === 'horizontal' && (
                <text
                  className="octave-label octave-bottom"
                  x={octaveBottom.x}
                  y={octaveBottom.y}
                  textAnchor={octaveBottom.anchor}
                >
                  ½ string
                </text>
              )}
            </>
          );
        })()}

        {/* Position labels (§12.3) — Inter 10px/600 tnum at the pos margin. Inside
            `.land` so they toggle with the Landmarks pill. On vertical they render
            ABBREVIATED to the leading ordinal ("3rd"/"4th"/"5th"/"7th") and sit
            end-anchored in the cross-end (right) gutter, clear of the end-string
            dots on a 390px phone (§12.3, Figma 124-2). */}
        {POSITION_LABELS.map((pos) => {
          const anchor = layout.overlayPosLabel(pos.offset);
          const text =
            orientation === 'horizontal' ? pos.text : (pos.text.split(' ')[0] ?? pos.text);
          return (
            <text
              key={`pos-${String(pos.offset)}`}
              className="pos-label"
              x={anchor.x}
              y={anchor.y}
              textAnchor={anchor.anchor}
            >
              {text}
            </text>
          );
        })}
      </g>
    </>
  );
}
