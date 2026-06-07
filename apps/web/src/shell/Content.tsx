import { Controls } from '../controls/Controls';
import { NoteMap } from '../notemap/NoteMap';
import { NoteMapLegend } from '../notemap/NoteMapLegend';
import { derive } from '../state/controls';
import { useControls } from '../state/useControls';

// The max-880px content column (DESIGN.md §9 tree, §4.2). It emits the slot set
// in §9-tree order — kicker · toolhead · controls · panelcard · caveat · legend.
// S3 shipped these as empty placeholders; S5 filled the note-map SVG (`#board`)
// and the `.legend` key; S6 now owns the STATE SEAM: it holds the single
// `(root, scale, refs)` source of truth (useControls), renders the three live
// controls rows (Controls), and re-derives the map's `(rootPc, scaleSet)` from it
// (derive) so a control change re-renders the §12 60-dot map IN PLACE. The
// caveat / reference-overlay rendering is still S7; the H1 scale-name + the live
// breadcrumb are out of S6 scope (they need §13 scale-aware spelling).

export function Content() {
  // The single app state every control writes and the map renders from (§9.1).
  const controls = useControls();
  // Pure derivation of the selected root's pitch class through the theory engine
  // (§12.5(b)) — never re-derived here. The map takes (rootPc, scale) and
  // classifies each node via `classify()` (it resolves the §12.5(a) interval set
  // from `scale` itself; `derive()` exposes both halves for the state-seam test).
  const { rootPc } = derive(controls.state);

  return (
    <main id="main" className="content">
      <div className="kicker">Scale map</div>

      <div className="toolhead">
        {/* H1 scale-name slot + interval-formula slot — both empty pending the
            §13 scale-aware spelling that names "A Major" / "A Harmonic Minor"
            (out of S6 scope). The H1 holds its 32px lh-tight box at every width
            (§10) so the landmark/heading order stays correct while empty. */}
        <h1 className="h1" />
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
            role="img"
            aria-label="Full fingerboard note map"
          >
            <NoteMap rootPc={rootPc} scale={controls.state.scale} />
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
