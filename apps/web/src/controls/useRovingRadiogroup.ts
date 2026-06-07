// useRovingRadiogroup — the §11.3 radiogroup keyboard contract for the
// single-select Root and Scale rows: a roving tabindex (exactly one pill is
// tabbable at a time — the selected one), arrow keys move the selection in the
// §9.1 left-to-right order (selection FOLLOWS focus), Home/End jump to the ends,
// and Tab exits the group. DESIGN.md §11.3 / §9.1 win on any conflict (AGENTS.md).
//
// This is keyboard wiring only — it carries NO motion (the active-pill highlight
// is a static positioned element S6 renders; the slide tween is S8). It is
// generic over the option type so Root (`Root`) and Scale (`ScaleType`) share
// one tested implementation.

import { useCallback, useRef, type KeyboardEvent } from 'react';

interface RovingRadiogroup<T> {
  /** Whether option `value` is the currently-selected (and so tabbable) one. */
  isSelected: (value: T) => boolean;
  /** The roving `tabIndex` for option at `index`: 0 for selected, -1 otherwise. */
  tabIndexFor: (value: T) => 0 | -1;
  /** Ref callback to register each pill button by index (for focus moves). */
  registerPill: (index: number) => (el: HTMLButtonElement | null) => void;
  /** The keydown handler to attach to every pill in the group. */
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

/**
 * Wire one single-select row. `options` is the ordered §9.1 list, `selected` the
 * current value, `onSelect` the state mutator. Selection follows focus, so each
 * arrow move both focuses and selects the next option.
 */
export function useRovingRadiogroup<T>(
  options: readonly T[],
  selected: T,
  onSelect: (value: T) => void,
): RovingRadiogroup<T> {
  // Live element refs so an arrow key can move focus to the newly-selected pill.
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const isSelected = useCallback((value: T) => value === selected, [selected]);

  const tabIndexFor = useCallback(
    (value: T): 0 | -1 => (value === selected ? 0 : -1),
    [selected],
  );

  const registerPill = useCallback(
    (index: number) => (el: HTMLButtonElement | null) => {
      pillRefs.current[index] = el;
    },
    [],
  );

  const moveTo = useCallback(
    (index: number) => {
      const next = options[index];
      if (next === undefined) return;
      onSelect(next);
      // Selection follows focus: move focus to the pill we just selected so the
      // roving tabindex and the visible focus ring stay on the same element.
      pillRefs.current[index]?.focus();
    },
    [options, onSelect],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const current = options.indexOf(selected);
      if (current === -1) return;
      const last = options.length - 1;
      switch (event.key) {
        // Forward in the §9.1 order (left-to-right / top wrap is not specified,
        // so clamp at the ends — no wrap-around).
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          moveTo(Math.min(current + 1, last));
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          moveTo(Math.max(current - 1, 0));
          break;
        case 'Home':
          event.preventDefault();
          moveTo(0);
          break;
        case 'End':
          event.preventDefault();
          moveTo(last);
          break;
        // Space/Enter on the already-selected pill is a no-op re-select (the
        // radio is single-select; clicking still selects via onClick). Tab is
        // left to the browser so it exits the group (roving tabindex = one stop).
        default:
          break;
      }
    },
    [options, selected, moveTo],
  );

  return { isSelected, tabIndexFor, registerPill, onKeyDown };
}
