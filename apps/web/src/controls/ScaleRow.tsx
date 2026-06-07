// ScaleRow — the §9.1 Scale row: 7 single-select pills (`role="radio"`) inside one
// `role="radiogroup"` named "Scale type" (§11.3). DESIGN.md §9.1 / §11.3 / §8.1
// win on any conflict (AGENTS.md).
//
// Same single-select contract as the Root row (roving tabindex + arrow-key
// selection-follows-focus + a STATIC active-pill highlight; the slide tween is
// S8). The labels are the exact §9.1 truncated strings (`Nat. minor`,
// `Major Pent.`, …) — the `value` is the `ScaleType` the theory engine keys off,
// kept separate from its display label.

import { type ScaleType } from '@violin-tools/theory';

import { SCALE_PILLS } from '../state/controls.ts';

import { useActiveHighlight } from './useActiveHighlight.ts';
import { useRovingRadiogroup } from './useRovingRadiogroup.ts';

interface ScaleRowProps {
  selected: ScaleType;
  onSelect: (scale: ScaleType) => void;
}

const SCALE_VALUES: readonly ScaleType[] = SCALE_PILLS.map((pill) => pill.scale);

export function ScaleRow({ selected, onSelect }: ScaleRowProps) {
  const { isSelected, tabIndexFor, registerPill, onKeyDown } =
    useRovingRadiogroup(SCALE_VALUES, selected, onSelect);
  const { trackRef, highlightRef, setActivePill } = useActiveHighlight(selected);

  return (
    <div
      className="pill-track"
      role="radiogroup"
      aria-label="Scale type"
      ref={trackRef}
    >
      <span className="pill-highlight" aria-hidden="true" ref={highlightRef} />
      {SCALE_PILLS.map(({ scale, label }, index) => {
        const active = isSelected(scale);
        return (
          <button
            key={scale}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={tabIndexFor(scale)}
            ref={(el) => {
              registerPill(index)(el);
              if (active) setActivePill(el);
            }}
            className={`pill${active ? ' is-active' : ''}`}
            onClick={() => {
              onSelect(scale);
            }}
            onKeyDown={onKeyDown}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
