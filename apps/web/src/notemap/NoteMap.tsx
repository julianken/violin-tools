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

import {
  classify,
  nodePitchClass,
  noteMarkerName,
  spell,
  spokenName,
  SCALE_INTERVALS,
  type Root,
  type ScaleType,
} from '@violin-tools/theory';
import { useRef, useState } from 'react';

import { INITIAL_CONTROLS, type RefsState } from '../state/controls';

import { RefLayers } from './RefLayers';
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
import { type MotionBuild, useDotPopReplay } from './motion';
import { useRovingNoteMap } from './useRovingNoteMap';
import './motion.css';
import './notemap.css';

// §12.2 — the per-state dot radii. Radius is a redundant non-color cue (§11.1),
// so it is carried as a real geometric value, not only a class.
const DOT_RADIUS = { off: 6, 'in-scale': 14, root: 15 } as const;
// §12.2 — the root glow ring radius (present on every node, shown only on root).
const GLOW_RADIUS = 19;

interface NoteMapProps {
  /** Selected root as a pitch-class integer (§12.5(b)); A = 9 by default. */
  rootPc?: number;
  /**
   * Selected root pill name (§9.1) — the §13 key the dot labels spell within.
   * `rootPc` classifies (§12.5); `root` names (§13), so both are threaded: the
   * pitch class is what `classify` needs, the spelling needs the chosen glyph
   * (`Bb` vs `A#`). Defaults to `A`, matching the `rootPc` default.
   */
  root?: Root;
  /** Selected scale type (§12.5(a)); Major by default. */
  scale?: ScaleType;
  /**
   * The four §9.1 Refs toggles that show/hide the §12.3 reference overlays. The
   * map passes them straight to <RefLayers>; defaults to every layer off (the
   * S6 initial state) so the static render matches the spec default.
   */
  refs?: RefsState;
  /**
   * The §7 motion build — `'stateful'` (primary, default) | `'snappy'`. The board
   * carries it as `data-motion` so motion.css selects the live variable set; the
   * snappy build also adds `.dot-anim` to in-scale dots and runs the reflow-replay
   * (§7.1 / §7.2). It is the single root toggle, orthogonal to per-node state.
   */
  motion?: MotionBuild;
  /**
   * Announce a sounded note's spoken name (§11.3) — called on Enter/Space over a
   * marker so the shell's polite live region can speak it. Optional so the static
   * NoteMap (tests, the S5 default render) need not wire audio plumbing.
   */
  onSoundNote?: (spokenNoteName: string) => void;
}

// S5 has no controls yet (S6 wires selection), so it renders a fixed default —
// A Major (rootPc 9), the §12.5 worked-check selection, so the static render is
// the exact case a reviewer can diff against the spec.
const DEFAULT_ROOT_PC = 9;
const DEFAULT_ROOT: Root = 'A';
const DEFAULT_SCALE: ScaleType = 'major';
// Every reference layer off by default (the S6 INITIAL_CONTROLS refs) — the
// first paint is the bare map a reviewer diffs against §12.

/**
 * The board content: string lines + nut + position guides + string/open labels,
 * then the 60 persistent note nodes. Returned as an SVG fragment so it mounts as
 * children of the shell's `<svg id="board">` (which owns the viewBox + the
 * `aria-label="Full fingerboard note map"` per §11.3, §12.1).
 */
export function NoteMap({
  rootPc = DEFAULT_ROOT_PC,
  root = DEFAULT_ROOT,
  scale = DEFAULT_SCALE,
  refs = INITIAL_CONTROLS.refs,
  motion = 'stateful',
  onSoundNote,
}: NoteMapProps) {
  const scaleSet = SCALE_INTERVALS[scale];

  // The snappy build replays `dotPop` on each (root, scale) change via the
  // number-pop-in reflow trick (motion.ts). `changeKey` keys the effect on the
  // selection; the stateful build no-ops inside the hook.
  const notesRef = useRef<SVGGElement>(null);
  useDotPopReplay(notesRef, motion, `${String(rootPc)}-${scale}`);

  // Precompute the 60 markers in flat (stringIndex × columnOffset) order — the
  // same order the render walks — so the roving hook (§11.3) knows each marker's
  // classification, accessible name, and the root's flat index. classify/spell
  // flow through @violin-tools/theory; §12.5/§13 are never re-derived here.
  const columns = COLUMN_OFFSETS.length;
  const markers = STRINGS.flatMap((string, stringIndex) =>
    COLUMN_OFFSETS.map((columnOffset, colIndex) => {
      const nodePc = nodePitchClass(string.pc, columnOffset);
      const state = classify(rootPc, scaleSet, nodePc);
      return {
        index: stringIndex * columns + colIndex,
        stringIndex,
        columnOffset,
        nodePc,
        state,
        cx: xOf(columnOffset),
        cy: string.y,
        // §11.3 accessible name — the §13 spoken note name + state suffix
        // ("C sharp, root"), recomputed every render so it tracks (root, scale).
        name: noteMarkerName(nodePc, root, scale, state),
      };
    }),
  );
  // The first root marker is the §11.3 initial tab stop; fall back to marker 0 if
  // (defensively) no root marker exists in the grid.
  const rootIndex = markers.find((m) => m.state === 'root')?.index ?? 0;

  // §11.3 roving keyboard model: one tab stop, arrows move in pitch order,
  // Enter/Space sounds the focused marker. Sounding announces via the shell live
  // region (onSoundNote) and toggles the static {mint} stroke (§12.2 / §11.4).
  const [soundingIndex, setSoundingIndex] = useState<number | null>(null);
  const roving = useRovingNoteMap({
    rows: STRINGS.length,
    columns,
    initialIndex: rootIndex,
    onSound: (index) => {
      setSoundingIndex(index);
      const marker = markers[index];
      if (marker !== undefined && onSoundNote !== undefined) {
        onSoundNote(spokenName(spell(marker.nodePc, root, 'chromatic')));
      }
    },
  });

  return (
    <>
      {/* §12.3 reference overlays FIRST, so the tape/landmark bands paint BEHIND
          the note dots (SVG paints in document order). Their visibility is the
          `.hide` class driven by the Refs pills — mounted-but-hidden, never
          unmounted (the S8 attach contract). */}
      <RefLayers refs={refs} />

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

      {/* The 60 persistent note markers (the §11.3 composite-widget members). The
          flat `markers` list is walked in (stringIndex, columnOffset) order, so a
          marker's `data-col`/key/identity match the S8 in-place tween contract.
          Each `<g>` is a focusable marker: `role="img"` + the §11.3 accessible
          name, a roving `tabindex` (one tab stop), and the shared keydown handler
          (arrows rove in pitch order, Enter/Space sounds). */}
      <g className="notes" ref={notesRef}>
        {markers.map((marker) => {
          const { index, stringIndex, columnOffset, nodePc, state, cx, cy, name } = marker;
          const radius = DOT_RADIUS[state];
          const hasLabel = state !== 'off';
          // §7.2 — the snappy build pops every in-scale (and root) dot in via
          // `dotPop`; off dots carry no pop. The stateful build never adds it
          // (its rules key off `[data-motion='stateful']`, not this class).
          const popAnim = motion === 'snappy' && state !== 'off';
          const isSounding = index === soundingIndex;

          return (
            <g
              // Stable identity per (string, column): the SAME element across
              // every re-render, so re-classification is in-place (§7.5).
              key={`${String(stringIndex)}-${String(columnOffset)}`}
              className={`note ${stateClass(state)}${popAnim ? ' dot-anim' : ''}`}
              // §11.3 — each marker is an exposed widget member with a spoken
              // accessible name; the roving tabindex makes the whole map one tab
              // stop (initially the root). The keydown handler is shared.
              role="img"
              aria-label={name}
              tabIndex={roving.tabIndexFor(index)}
              ref={roving.registerMarker(index)}
              onKeyDown={roving.onKeyDown}
              // §7.1/§7.2 per-column stagger: `--col` feeds the stateful
              // transition-delay AND the snappy animation-delay (motion.css),
              // both = col × var(--stagger-per-column). columnOffset is o = 0…14
              // (§12.1), so a change sweeps left → right up the neck.
              style={{ '--col': columnOffset }}
              // The column index as a plain attribute — a stable seam for the
              // e2e to read computed delays per column without parsing inline
              // style (the §7.5 stagger assertion targets col 0 vs col 14).
              data-col={columnOffset}
            >
              {/* glow — present on EVERY node, shown only on the root via
                  `.note.is-root .glow` (§12.2 / §15.1). S8 fades its opacity. */}
              <circle className="glow" cx={cx} cy={cy} r={GLOW_RADIUS} fill="none" />
              {/* dot — the state circle (radius + fill + stroke per §12.2). */}
              <circle className="dot" cx={cx} cy={cy} r={radius} />
              {/* sound — the persistent §12.2 sounding overlay. `.is-sounding`
                  toggles its opacity to the static heavier {mint} stroke — the
                  sole, motion-free sounding cue in ALL modes (§7.5 / §11.4). It
                  sits ABOVE the dot but BELOW the label so the note name stays
                  legible. Its r follows the dot's state radius. */}
              <circle
                className={`sound${isSounding ? ' is-sounding' : ''}`}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
              />
              {/* lbl — the note name (Inter, tnum, baseline cy + 4, no
                  dominant-baseline). Empty string on off nodes so the element
                  persists for S8 (the element is never removed). aria-hidden so
                  the marker's own aria-label (the spoken name) is the single
                  accessible name, not duplicated by the visual glyph. */}
              <text
                className="lbl"
                x={cx}
                y={cy + LABEL_Y_OFFSET}
                textAnchor="middle"
                aria-hidden="true"
              >
                {/* §13 letter-correct spelling for the current key — Bb major's
                    root reads Bb, A major's 3rd reads C♯, never the sharp-only
                    table. Off nodes carry no label (the element persists empty
                    for S8). */}
                {hasLabel ? spell(nodePc, root, scale) : ''}
              </text>
            </g>
          );
        })}
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
