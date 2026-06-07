// NoteMap — the §12 fingerboard note map, rendered as the inner content of the
// S3 app-shell board (`<svg id="board">`, §8 line 800). DESIGN.md §12 wins on any
// conflict (AGENTS.md). This is the STATIC render of S5: a pure function from
// `(root, scale)` to the 60-dot SVG, with NO motion (motion is S8) and NO tape /
// landmark overlays (those are S7). Every color resolves to a §0 token via the
// classes in notemap.css — no hard-coded hex here.
//
// Transition-readiness (the S8 attach contract — structure only, no motion):
//   • Persistent nodes — the 60 `<g class="note …">` mount once and are
//     re-classified IN PLACE on a (root, scale) change. A stable React `key`
//     keyed on (stringIndex, columnOffset) means React reuses the SAME DOM
//     element across re-renders; a node leaving the scale becomes an `is-off`
//     dot in the same element, never unmounted (§7.5 "never exits — re-classed
//     in place"; §15.1).
//   • State as a class on the wrapper — `note is-off|is-scale|is-root` — the
//     single hook S8 drives. The off treatment IS the hidden state; nothing is
//     removed (the transitions-dev "hidden-not-unmounted" rule).
//   • Persistent inner pieces — every node carries `glow`, `dot`, and `lbl`
//     children as separate elements so S8 can tween each inner piece (the
//     transitions-dev "animate the inner pieces, not one container" rule). The
//     glow ring is present on EVERY node and shown only on the root, via the
//     `.note.is-root .glow` selector — S8 fades its opacity, S5 leaves it static.

import { classify, SCALE_INTERVALS, type ScaleType } from '@violin-tools/theory';

import {
  COLUMN_OFFSETS,
  GUIDE_Y1,
  GUIDE_Y2,
  LABEL_Y_OFFSET,
  NUT,
  OPEN_LABEL,
  STOPPED_OFFSETS,
  STRING_LABEL_X,
  STRING_X1,
  STRING_X2,
  STRINGS,
  xOf,
} from './geometry';
import './notemap.css';
import { noteName } from './notes';

// §12.2 — the per-state dot radii. Radius is a redundant non-color cue (§11.1),
// so it is carried as a real geometric value, not only a class.
const DOT_RADIUS = { off: 6, 'in-scale': 14, root: 15 } as const;
// §12.2 — the root glow ring radius (present on every node, shown only on root).
const GLOW_RADIUS = 19;

interface NoteMapProps {
  /** Selected root as a pitch-class integer (§12.5(b)); A = 9 by default. */
  rootPc?: number;
  /** Selected scale type (§12.5(a)); Major by default. */
  scale?: ScaleType;
}

// S5 has no controls yet (S6 wires selection), so it renders a fixed default —
// A Major (rootPc 9), the §12.5 worked-check selection, so the static render is
// the exact case a reviewer can diff against the spec.
const DEFAULT_ROOT_PC = 9;
const DEFAULT_SCALE: ScaleType = 'major';

/**
 * The board content: string lines + nut + position guides + string/open labels,
 * then the 60 persistent note nodes. Returned as an SVG fragment so it mounts as
 * children of the shell's `<svg id="board">` (which owns the viewBox + the
 * `aria-label="Full fingerboard note map"` per §11.3, §12.1).
 */
export function NoteMap({
  rootPc = DEFAULT_ROOT_PC,
  scale = DEFAULT_SCALE,
}: NoteMapProps) {
  const scaleSet = SCALE_INTERVALS[scale];

  return (
    <>
      {/* Static chrome — guide lines, nut, string lines, labels. The guide
          lines and nut are decorative (no meaning); they read as background. */}
      <g className="chrome" aria-hidden="true">
        {STOPPED_OFFSETS.map((offset) => (
          <line
            key={`guide-${String(offset)}`}
            className="guide"
            x1={xOf(offset)}
            y1={GUIDE_Y1}
            x2={xOf(offset)}
            y2={GUIDE_Y2}
          />
        ))}
        <rect
          className="nut"
          x={NUT.x}
          y={NUT.y}
          width={NUT.width}
          height={NUT.height}
        />
        {STRINGS.map((string) => (
          <line
            key={`string-${string.name}`}
            className="string-line"
            x1={STRING_X1}
            y1={string.y}
            x2={STRING_X2}
            y2={string.y}
          />
        ))}
        {STRINGS.map((string) => (
          <text
            key={`string-name-${string.name}`}
            className="string-name"
            x={STRING_LABEL_X}
            y={string.y + LABEL_Y_OFFSET}
            textAnchor="middle"
          >
            {string.name}
          </text>
        ))}
        <text
          className="open-label"
          x={OPEN_LABEL.x}
          y={OPEN_LABEL.y}
          textAnchor="middle"
        >
          open
        </text>
      </g>

      {/* The 60 persistent note nodes. The outer loop is stringIndex, the inner
          is columnOffset, so the (stringIndex, columnOffset) key is the stable
          identity S8's in-place tween relies on. */}
      <g className="notes">
        {STRINGS.map((string, stringIndex) =>
          COLUMN_OFFSETS.map((columnOffset) => {
            const cx = xOf(columnOffset);
            const cy = string.y;
            // §12.5(c) nodePc = (openStringPc + columnIndex) mod 12, then
            // §12.5(d) classify — both from the theory engine, never re-derived.
            const nodePc = (string.pc + columnOffset) % 12;
            const state = classify(rootPc, scaleSet, nodePc);
            const radius = DOT_RADIUS[state];
            const hasLabel = state !== 'off';

            return (
              <g
                // Stable identity per (string, column): the SAME element across
                // every re-render, so re-classification is in-place (§7.5).
                key={`${String(stringIndex)}-${String(columnOffset)}`}
                className={`note ${stateClass(state)}`}
              >
                {/* glow — present on EVERY node, shown only on the root via
                    `.note.is-root .glow` (§12.2 / §15.1). Static in S5. */}
                <circle
                  className="glow"
                  cx={cx}
                  cy={cy}
                  r={GLOW_RADIUS}
                  fill="none"
                />
                {/* dot — the state circle (radius + fill + stroke per §12.2). */}
                <circle className="dot" cx={cx} cy={cy} r={radius} />
                {/* lbl — the note name (Inter, tnum, baseline cy + 4, no
                    dominant-baseline). Empty string on off nodes so the element
                    persists for S8 (the element is never removed). */}
                <text
                  className="lbl"
                  x={cx}
                  y={cy + LABEL_Y_OFFSET}
                  textAnchor="middle"
                >
                  {hasLabel ? noteName(nodePc) : ''}
                </text>
              </g>
            );
          }),
        )}
      </g>
    </>
  );
}

/** Map a classification state to its §15.1 wrapper class (`is-off|is-scale|is-root`). */
function stateClass(state: 'off' | 'in-scale' | 'root'): string {
  if (state === 'root') return 'is-root';
  if (state === 'in-scale') return 'is-scale';
  return 'is-off';
}
