import { Controls } from '../controls/Controls';
import { MobileControls } from '../controls/MobileControls';
import { NoteMap } from '../notemap/NoteMap';
import { NoteMapLegend } from '../notemap/NoteMapLegend';
import { axisOf } from '../notemap/geometry';
import { type Handedness, type Orientation, type ResolvedDensity } from '../notemap/mapView';
import { type MotionBuild } from '../notemap/motion';
import { type MapViewApi } from '../notemap/useMapView';
import { derive, REF_PILLS, scaleName, type ControlsState } from '../state/controls';
import { type ControlsApi } from '../state/useControls';

// §10/§16 summary-bar text — the scale name plus any active reference layers, the
// one-tap mobile summary the sheet expands from ("A Major · Tapes", "A Major" with
// no refs). It derives from the SAME `controls.state` AppShell's describeMap reads,
// so the summary and the map never disagree. Active refs are listed in the §9.1
// REF_PILLS order using their pill labels, joined with ", "; the scale name and the
// refs cluster are separated by a §13 middle dot.
function summarize(state: ControlsState): string {
  const activeRefs = REF_PILLS.filter(({ key }) => state.refs[key]).map(({ label }) => label);
  const name = scaleName(state);
  return activeRefs.length === 0 ? name : `${name} · ${activeRefs.join(', ')}`;
}

// The max-880px content column (DESIGN.md §9 tree, §4.2). It emits the slot set
// in §9-tree order — kicker · toolhead · controls · panelcard · caveat · legend.
// S3 shipped these as empty placeholders; S5 filled the note-map SVG (`#board`)
// and the `.legend` key; S6 owns the STATE SEAM and S9 lifts it to the shell: the
// single `(root, scale, refs)` source of truth lives in AppShell (useControls) so
// the command palette can write into it too — Content RECEIVES the `controls` api
// as a prop. The three live controls rows (Controls) write it, and the map
// re-derives its `(rootPc, scaleSet)` from it (derive) so a control change
// re-renders the §12 60-dot map IN PLACE. S7 wires the Refs toggles into the map's
// §12.3 reference overlays (the four `.tape` / `.land` layers). S14 fills the H1
// scale-name (and the topbar breadcrumb, in AppShell) from §13 scale-aware
// spelling via `scaleName()`. The caveat copy stays out of scope.

interface ContentProps {
  /** The shared controls api, owned by AppShell so the palette can write it too. */
  controls: ControlsApi;
  /**
   * The whole map-view api (§16) — threaded down to <Controls> so the mobile
   * sheet's View row can drive the orientation/density/handedness toggles. The
   * resolved orientation/handedness/density props below feed the board/NoteMap
   * RENDER path and are unchanged; `mapView` is used ONLY by the mobile sheet (the
   * desktop card ignores it). Optional so a prop-absent Content render (a unit
   * harness that only exercises the controls→map wiring) still mounts.
   */
  mapView?: MapViewApi;
  /**
   * The resolved render orientation (§12.1) — `'horizontal'` (desktop) |
   * `'vertical'` (mobile). Already resolved (never `'auto'`); AppShell does the
   * matchMedia resolve and threads the concrete value (U4). Content drives the
   * board <svg> viewBox AND `data-orientation` from it, and forwards it to
   * <NoteMap> so the parent box and the dot centers share ONE config. Defaults
   * to `'horizontal'` so a prop-absent render is the byte-identical desktop map.
   */
  orientation?: Orientation;
  /** Player handedness (§12.5) — `'right'` (default) | `'left'`; forwarded to <NoteMap>. */
  handedness?: Handedness;
  /**
   * Neck-axis spacing (§12.1) — `'fit'` (default) | `'comfort'`. The RESOLVED
   * render type (`ResolvedDensity`, never `'auto'`): the AppShell resolves the
   * stored mode via `resolveDensity` (U2) before threading it here. Forwarded to
   * <NoteMap> so the viewBox and the dot centers agree (a Content/NoteMap config
   * mismatch clips or squishes the map).
   */
  density?: ResolvedDensity;
  /**
   * Announce a sounded note's spoken name (§11.3) up to the shell's polite live
   * region — threaded into the note map's Enter/Space sounding handler.
   */
  onSoundNote: (spokenNoteName: string) => void;
}

/**
 * The §7 motion build to render. `'stateful'` is the primary default; `?motion=
 * snappy` selects the alternative build (the single `data-motion` root toggle,
 * §7.1/§7.2). A query param keeps the toggle a real runtime switch — no rebuild —
 * and lets the Playwright e2e exercise both builds against the same bundle.
 */
function resolveMotionBuild(): MotionBuild {
  if (typeof window === 'undefined') return 'stateful';
  return new URLSearchParams(window.location.search).get('motion') === 'snappy'
    ? 'snappy'
    : 'stateful';
}

export function Content({
  controls,
  mapView,
  orientation = 'horizontal',
  handedness = 'right',
  density = 'fit',
  onSoundNote,
}: ContentProps) {
  // Pure derivation of the selected root's pitch class through the theory engine
  // (§12.5(b)) — never re-derived here. The map takes (rootPc, scale) and
  // classifies each node via `classify()` (it resolves the §12.5(a) interval set
  // from `scale` itself; `derive()` exposes both halves for the state-seam test).
  const { rootPc } = derive(controls.state);
  // §13 spelled heading ("B♭ Major", "A Harmonic Minor") — same `spell()` engine
  // the map labels use, so the H1 and the fingerboard never disagree.
  const heading = scaleName(controls.state);
  const motion = resolveMotionBuild();
  // §12.1 — the resolved layout drives the board's viewBox (horizontal+fit is the
  // byte-identical '0 0 760 264' post-U0; vertical+comfort is '0 0 352 850'). The
  // SAME (orientation, handedness, density) is forwarded to <NoteMap> below so the
  // parent box and the dot centers never disagree (a mismatch clips/squishes).
  const layout = axisOf({ orientation, handedness, density });

  return (
    <main id="main" className="content">
      <div className="kicker">Scale map</div>

      <div className="toolhead">
        {/* H1 scale-name slot — the §13 spelled current selection ("A Major",
            "B♭ Major", "A Harmonic Minor"). S14 fills it from `scaleName()` (the
            same `spell()` engine as the map labels). The interval-formula slot
            stays empty (its §13 formula tokens are a later concern). The H1 holds
            its 32px lh-tight box at every width (§10). */}
        <h1 className="h1">{heading}</h1>
        <div className="formula" />
      </div>

      {/* The DESKTOP controls card (§9.1) — shown ≥760px, `display:none` <760px
          (U6 CSS). The mobile MobileControls surface below mounts alongside it and
          is shown <760px; BOTH mount and CSS toggles which is visible (FINDING 6 —
          the hidden surface is display:none so its radiogroups/checkboxes leave the
          a11y tree, keeping the desktop strict-count e2e exact). */}
      <Controls
        state={controls.state}
        selectRoot={controls.selectRoot}
        selectScale={controls.selectScale}
        toggleRef={controls.toggleRef}
        // §12.3 — the Refs overlays are still horizontal-axis-only (the band/heel/
        // low-2 geometry is not yet projected through `axisOf`; that is the tracked
        // U3b follow-up). On the vertical map the Refs pills are therefore disabled
        // so a user cannot paint a mis-projected band; <RefLayers> is also skipped
        // in NoteMap while vertical (defense in depth). Forwarded so RefsRow can
        // dim/disable the pills.
        orientation={orientation}
        // §16 — the whole map-view api, used ONLY by the mobile sheet's View row
        // (U4). The desktop card ignores it. Spread conditionally so a mapView-
        // absent Content render doesn't pass literal `undefined`
        // (exactOptionalPropertyTypes).
        {...(mapView !== undefined ? { mapView } : {})}
      />

      {/* The MOBILE controls surface (§10/§16) — a one-tap summary bar + non-modal
          bottom sheet, shown <760px and `display:none` ≥760px (U6 CSS). It needs
          the whole map-view api (its View row drives orientation/density/handedness),
          so it mounts only when `mapView` is threaded — the Content unit harness
          (which exercises only the controls→map wiring, no mapView) renders just the
          desktop card, keeping its H1/board assertions unambiguous. */}
      {mapView !== undefined && (
        <MobileControls
          controls={controls}
          mapView={mapView}
          orientation={orientation}
          summaryText={summarize(controls.state)}
        />
      )}

      <div className="panelcard">
        {/* The note-map plate: `overflow-x:auto`, inner SVG holds its 760px
            min-width so it horizontal-scrolls below the narrow floor (§4.2, §10).
            S5 renders the §12 60-dot map; S6 feeds it the live (rootPc, scaleSet)
            so it re-classifies + re-renders in place on every control change. */}
        <div className="panel">
          <svg
            id="board"
            className="board"
            // §12.1 — the resolved layout's viewBox (U2): horizontal+fit is the
            // shipped '0 0 760 264', vertical+comfort is '0 0 352 850'.
            viewBox={layout.viewBox}
            // §11.3 — the composite-widget container. `role="group"` (not `img`)
            // so the focusable note markers inside are exposed to AT; the group's
            // accessible name stays "Full fingerboard note map". tabIndex={-1} so
            // the skip link (`#board`) can land focus on the group.
            role="group"
            aria-label="Full fingerboard note map"
            tabIndex={-1}
            // §7.1/§7.2 — the single root toggle that selects the live motion
            // variable set (stateful property transitions vs the snappy dotPop
            // keyframe). motion.css keys every rule off this attribute.
            data-motion={motion}
            // §10/§12.1 — drives `.board[data-orientation='vertical']{min-width:0}`
            // (shell.css), so the intrinsically-narrow vertical SVG shrinks to the
            // plate width instead of forcing the desktop 760px min-width and
            // overflowing on a phone. Horizontal keeps the 760px floor.
            data-orientation={orientation}
          >
            <NoteMap
              rootPc={rootPc}
              root={controls.state.root}
              scale={controls.state.scale}
              refs={controls.state.refs}
              motion={motion}
              orientation={orientation}
              handedness={handedness}
              density={density}
              onSoundNote={onSoundNote}
            />
          </svg>
        </div>
      </div>

      <div className="caveat" />

      <div className="legend">
        <NoteMapLegend />
      </div>
    </main>
  );
}
