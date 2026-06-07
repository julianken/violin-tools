// The max-880px content column (DESIGN.md §9 tree, §4.2). It emits the slot set
// in §9-tree order — kicker · toolhead · controls · panelcard · caveat · legend
// — as EMPTY, correctly-ordered placeholders. Later steps fill them: S5 renders
// the note-map SVG inside `.panel`; S6 fills the controls rows with pills; the
// caveat and legend land with the reference-layer work. This step only lays out
// the structurally-correct, accessible frame.

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
            The SVG is an empty placeholder — S5 renders the 60-dot map into it. */}
        <div className="panel">
          <svg
            id="board"
            className="board"
            viewBox="0 0 760 264"
            role="img"
            aria-label="Full fingerboard note map"
          />
        </div>
      </div>

      <div className="caveat" />

      <div className="legend" />
    </main>
  );
}
