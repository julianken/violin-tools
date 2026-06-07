// useRovingListbox — the roving SELECTION inside the palette results listbox
// (DESIGN.md §8.5 "focus", §11.3). DESIGN.md wins on any conflict (AGENTS.md).
//
// Distinct from the controls' `useRovingRadiogroup`: there, focus lives on each
// pill and selection follows the browser focus ring; here the whole input keeps
// DOM focus (you keep typing) and exactly ONE result row is "selected" via a
// shared `{raised}` fill — there is NO focus ring inside the modal (§8.5/§15.2).
// So this hook tracks a selected INDEX into the flat list of selectable rows and
// moves it with ↑/↓, CROSSING group boundaries (§11.3) — the flat list already
// concatenates Scales then Tools and skips the non-selectable `soon` stubs
// (palette-data `selectableRows`).
//
// Hover and keyboard share one state: pointer hover writes the same index, so
// the `{raised}` fill is identical for both (§8.5 "keyboard selection and
// pointer hover share this state" — they never diverge).

import { useCallback, useState } from 'react';

export interface RovingListbox {
  /** Index of the currently-selected row within the selectable list. */
  selectedIndex: number;
  /** `true` when row `index` is the selected (`.sel`) one. */
  isSelected: (index: number) => boolean;
  /** Move selection down one (clamped at the last row). */
  moveDown: () => void;
  /** Move selection up one (clamped at the first row). */
  moveUp: () => void;
  /** Point selection at a specific row (used on pointer hover). */
  setSelectedIndex: (index: number) => void;
}

/**
 * Track the roving selection over `count` selectable rows. `resetKey` is the
 * current query string: when it changes the user has re-filtered, so selection
 * snaps back to the first row (the top match), making Enter immediately
 * meaningful. The reset is done by adjusting state DURING render off a tracked
 * previous key (the React-sanctioned alternative to a setState-in-effect) — no
 * effect, no cascading render. ↑/↓ clamp at the ends (no wrap, matching the
 * controls' arrow contract, §11.3) while still crossing group boundaries because
 * the list is already flat across groups.
 */
export function useRovingListbox(count: number, resetKey: string): RovingListbox {
  const [selectedIndex, setSelectedIndexState] = useState(0);
  // The previous query, stored in STATE (not a ref) so the documented
  // "adjust state when a prop changes during render" pattern applies — React
  // bails out and re-renders immediately without committing/painting, so this is
  // NOT a cascading render.
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  const [prevKey, setPrevKey] = useState(resetKey);

  let current = selectedIndex;
  if (prevKey !== resetKey) {
    // Query changed → snap selection back to the first (top) match.
    setPrevKey(resetKey);
    setSelectedIndexState(0);
    current = 0;
  }
  // Clamp into range in case the list shrank without the key changing.
  if (count > 0 && current > count - 1) current = count - 1;

  const isSelected = useCallback((index: number) => index === current, [current]);

  const moveDown = useCallback(() => {
    setSelectedIndexState((i) => (count === 0 ? 0 : Math.min(i + 1, count - 1)));
  }, [count]);

  const moveUp = useCallback(() => {
    setSelectedIndexState((i) => Math.max(i - 1, 0));
  }, []);

  const setSelectedIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < count) setSelectedIndexState(index);
    },
    [count],
  );

  return { selectedIndex: current, isSelected, moveDown, moveUp, setSelectedIndex };
}
