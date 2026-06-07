// RootRow — the §9.1 Root row: 12 single-select pills (`role="radio"`) inside one
// `role="radiogroup"` named "Root note" (§11.3). DESIGN.md §9.1 / §11.3 / §8.1
// win on any conflict (AGENTS.md).
//
// Single-select with a roving tabindex + arrow-key selection-follows-focus
// (useRovingRadiogroup) and a STATIC active-pill highlight positioned at the
// selected pill (useActiveHighlight) — the slide tween is S8, not here. The pill
// label is the §13 default glyph; the v1 dual-spelling sub-label for `F#`/`Bb` is
// a documented §16 gap and is NOT rendered.

import { type Root } from '@violin-tools/theory';

import { ROOT_PILLS } from '../state/controls.ts';

import { useActiveHighlight } from './useActiveHighlight.ts';
import { useRovingRadiogroup } from './useRovingRadiogroup.ts';

interface RootRowProps {
  selected: Root;
  onSelect: (root: Root) => void;
}

export function RootRow({ selected, onSelect }: RootRowProps) {
  const { isSelected, tabIndexFor, registerPill, onKeyDown } =
    useRovingRadiogroup(ROOT_PILLS, selected, onSelect);
  const { trackRef, highlightRef, setActivePill } = useActiveHighlight(selected);

  return (
    <div
      className="pill-track"
      role="radiogroup"
      aria-label="Root note"
      ref={trackRef}
    >
      {/* Static active highlight (§8.1) — positioned at the selected pill by
          useActiveHighlight; aria-hidden because the radio state is what AT
          reads, not this decorative element. S8 animates its transform/width. */}
      <span className="pill-highlight" aria-hidden="true" ref={highlightRef} />
      {ROOT_PILLS.map((root, index) => {
        const active = isSelected(root);
        return (
          <button
            key={root}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={tabIndexFor(root)}
            ref={(el) => {
              registerPill(index)(el);
              if (active) setActivePill(el);
            }}
            className={`pill${active ? ' is-active' : ''}`}
            onClick={() => {
              onSelect(root);
            }}
            onKeyDown={onKeyDown}
          >
            {root}
          </button>
        );
      })}
    </div>
  );
}
