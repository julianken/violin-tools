import { NoteMap } from '../notemap/NoteMap';
import { NoteMapLegend } from '../notemap/NoteMapLegend';

// The max-880px content column (DESIGN.md §9 tree, §4.2). It emits the slot set
// in §9-tree order — kicker · toolhead · controls · panelcard · caveat · legend.
// S3 shipped these as empty placeholders; S5 now fills two of them: the note-map
// SVG (`#board`) renders the §12 60-dot map, and the `.legend` slot renders the
// §12.4 always-visible five-swatch key. The controls rows (S6) and the caveat /
// reference overlays (S7) are still empty here.

// The three controls rows (DESIGN.md §9.1, §11.3). Root and Scale are ARIA
// radiogroups; Refs is an ARIA `group` — NOT a radiogroup — because it is
// multi-select (checkboxes), per the S6 (#42) reconciliation of the §9.1 prose.
// The aria-label strings are verbatim from §11.3. Pills are out of scope (S6).
const CONTROL_ROWS = [
  { role: 'radiogroup', label: 'Root', ariaLabel: 'Root note' },
  { role: 'radiogroup', label: 'Scale', ariaLabel: 'Scale type' },
  { role: 'group', label: 'Refs', ariaLabel: 'Reference layers' },
] as const;

export function Content() {
  return (
    <main id="main" className="content">
      <div className="kicker">Scale map</div>

      <div className="toolhead">
        {/* H1 scale-name slot + interval-formula slot — both empty in S3 (S6/S5
            fill them). The H1 is present so the landmark/heading order is correct
            and stays 32px lh-tight at every width (§10). */}
        <h1 className="h1" />
        <div className="formula" />
      </div>

      <section className="controls" aria-label="Scale controls">
        {CONTROL_ROWS.map(({ role, label, ariaLabel }) => (
          <div key={label} className="ctrl-row">
            <div className="lab">{label}</div>
            <div className="ctrl-slot" role={role} aria-label={ariaLabel} />
          </div>
        ))}
      </section>

      <div className="panelcard">
        {/* The note-map plate: `overflow-x:auto`, inner SVG holds its 760px
            min-width so it horizontal-scrolls below the narrow floor (§4.2, §10).
            S5 renders the §12 60-dot map as the SVG's content; the SVG element
            (viewBox + aria-label, §11.3) is the S3 frame it mounts into. */}
        <div className="panel">
          <svg
            id="board"
            className="board"
            viewBox="0 0 760 264"
            role="img"
            aria-label="Full fingerboard note map"
          >
            <NoteMap />
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
