// NoteMapLegend — the §12.4 always-visible legend below the note map. DESIGN.md
// §12.4 wins on any conflict (AGENTS.md). All five swatches render even though
// the surfaces two of them key to (beginner tape, landmark) are S7 overlays not
// yet built — the legend is the always-present key (§7.5 "Caveat / legend:
// static, always rendered"). Every color resolves to a §0 token via notemap.css;
// no hard-coded hex here. No motion (the legend never animates, §7.5).

import './notemap.css';

// §12.4 — the five legend entries, in spec order. The shape/size differences
// are themselves a redundant non-color cue (§11.1): root vs in-scale vs off
// differ by diameter; tape vs landmark are rects, not circles.
const LEGEND_ITEMS: readonly { key: string; shape: string; label: string }[] = [
  { key: 'root', shape: 'lg-root', label: 'root' },
  { key: 'in-scale', shape: 'lg-scale', label: 'in scale' },
  { key: 'off', shape: 'lg-off', label: 'not in scale' },
  { key: 'tape', shape: 'lg-tape', label: 'beginner tape' },
  { key: 'landmark', shape: 'lg-landmark', label: 'landmark' },
];

/** The five-swatch legend, rendered into the shell's `.legend` slot. */
export function NoteMapLegend() {
  return (
    <>
      {LEGEND_ITEMS.map((item) => (
        <span key={item.key} className="legend-item">
          <span className={`legend-swatch ${item.shape}`} aria-hidden="true" />
          <span className="legend-label">{item.label}</span>
        </span>
      ))}
    </>
  );
}
