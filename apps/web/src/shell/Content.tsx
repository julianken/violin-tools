import { Controls } from '../controls/Controls';
import { NoteMap } from '../notemap/NoteMap';
import { NoteMapLegend } from '../notemap/NoteMapLegend';
import { type MotionBuild } from '../notemap/motion';
import { derive, scaleName } from '../state/controls';
import { type ControlsApi } from '../state/useControls';

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

export function Content({ controls, onSoundNote }: ContentProps) {
  // Pure derivation of the selected root's pitch class through the theory engine
  // (§12.5(b)) — never re-derived here. The map takes (rootPc, scale) and
  // classifies each node via `classify()` (it resolves the §12.5(a) interval set
  // from `scale` itself; `derive()` exposes both halves for the state-seam test).
  const { rootPc } = derive(controls.state);
  // §13 spelled heading ("B♭ Major", "A Harmonic Minor") — same `spell()` engine
  // the map labels use, so the H1 and the fingerboard never disagree.
  const heading = scaleName(controls.state);
  const motion = resolveMotionBuild();

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

      <Controls
        state={controls.state}
        selectRoot={controls.selectRoot}
        selectScale={controls.selectScale}
        toggleRef={controls.toggleRef}
      />

      <div className="panelcard">
        {/* The note-map plate: `overflow-x:auto`, inner SVG holds its 760px
            min-width so it horizontal-scrolls below the narrow floor (§4.2, §10).
            S5 renders the §12 60-dot map; S6 feeds it the live (rootPc, scaleSet)
            so it re-classifies + re-renders in place on every control change. */}
        <div className="panel">
          <svg
            id="board"
            className="board"
            viewBox="0 0 760 264"
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
          >
            <NoteMap
              rootPc={rootPc}
              root={controls.state.root}
              scale={controls.state.scale}
              refs={controls.state.refs}
              motion={motion}
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
