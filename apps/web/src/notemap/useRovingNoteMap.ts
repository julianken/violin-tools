// useRovingNoteMap — the §11.3 roving-tabindex keyboard model for the note-map
// composite widget. DESIGN.md §11.3 wins on any conflict (AGENTS.md).
//
// The 60-dot SVG map is ONE composite widget, not 60 tab stops: exactly one
// marker is tabbable (`tabindex="0"`) at a time, the rest are `tabindex="-1"`.
// Arrow keys move focus among the markers in pitch order — Left/Right step along
// a string by column, Up/Down cross strings spatially (same column, adjacent
// string) — Enter/Space sound the focused marker, and Tab (left to the browser)
// exits the whole widget. The grid is `STRINGS × COLUMN_OFFSETS`, so a marker's
// flat index is `stringIndex * columns + columnOffset`.
//
// This is keyboard wiring only — it carries NO motion and NO ARIA-name logic
// (NoteMap owns the per-marker `aria-label`). It tracks the focused marker as
// React state so the roving `tabindex` and the visible §8 focus ring stay on the
// same element; the initial tabbable marker is the root (or, if no root marker is
// supplied, the first marker), per §11.3.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface RovingNoteMap {
  /** The flat index (0…count−1) of the currently-tabbable marker. */
  activeIndex: number;
  /** The roving `tabIndex` for the marker at `index`: 0 for active, -1 otherwise. */
  tabIndexFor: (index: number) => 0 | -1;
  /** Ref callback to register each marker `<g>` by flat index (for focus moves). */
  registerMarker: (index: number) => (el: SVGGElement | null) => void;
  /** The keydown handler to attach to every marker in the widget. */
  onKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
}

interface RovingNoteMapOptions {
  /** Rows (strings) and columns of the marker grid (§12.1: 4 × 15). */
  rows: number;
  columns: number;
  /** The flat index of the initial tabbable marker (the root); defaults to 0. */
  initialIndex: number;
  /** Sound the marker at `index` (Enter/Space) — wired by NoteMap (§11.3). */
  onSound: (index: number) => void;
}

/**
 * Wire the note map's roving keyboard model. `rows`/`columns` describe the grid,
 * `initialIndex` is the root marker (the first tabbable), and `onSound` is called
 * with the focused flat index on Enter/Space.
 */
export function useRovingNoteMap({
  rows,
  columns,
  initialIndex,
  onSound,
}: RovingNoteMapOptions): RovingNoteMap {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  // Live element refs so an arrow key can move focus to the newly-active marker.
  const markerRefs = useRef<(SVGGElement | null)[]>([]);
  // Whether the user has interacted (so an initialIndex change doesn't yank focus
  // away from a marker the user arrowed to). On a fresh root, the active marker
  // re-snaps to the root only until the first keyboard move.
  const movedRef = useRef(false);

  // Keep the tabbable marker on the root as long as the user hasn't arrowed yet:
  // a root/scale change recomputes `initialIndex`, and the map should present the
  // root as the entry point until the user takes over navigation (§11.3).
  useEffect(() => {
    if (!movedRef.current) setActiveIndex(initialIndex);
  }, [initialIndex]);

  const tabIndexFor = useCallback(
    (index: number): 0 | -1 => (index === activeIndex ? 0 : -1),
    [activeIndex],
  );

  const registerMarker = useCallback(
    (index: number) => (el: SVGGElement | null) => {
      markerRefs.current[index] = el;
    },
    [],
  );

  const moveTo = useCallback((index: number) => {
    movedRef.current = true;
    setActiveIndex(index);
    // Move focus to the marker we just activated so the roving tabindex and the
    // visible focus ring stay on the same element (§8 / §11.3).
    markerRefs.current[index]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<SVGGElement>) => {
      const row = Math.floor(activeIndex / columns);
      const col = activeIndex % columns;
      switch (event.key) {
        // Along the string (by column) — clamp at the ends, no wrap.
        case 'ArrowRight':
          event.preventDefault();
          if (col < columns - 1) moveTo(activeIndex + 1);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          if (col > 0) moveTo(activeIndex - 1);
          break;
        // Across strings (spatially, same column) — Up = toward E5 (row 0),
        // Down = toward G3 (last row); clamp at the top/bottom string.
        case 'ArrowUp':
          event.preventDefault();
          if (row > 0) moveTo(activeIndex - columns);
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (row < rows - 1) moveTo(activeIndex + columns);
          break;
        case 'Home':
          event.preventDefault();
          moveTo(row * columns); // first column of the current string
          break;
        case 'End':
          event.preventDefault();
          moveTo(row * columns + (columns - 1)); // last column of the current string
          break;
        // Enter / Space sound the focused marker (§11.3). Tab is left to the
        // browser so it exits the whole widget (roving tabindex = one tab stop).
        case 'Enter':
        case ' ':
          event.preventDefault();
          onSound(activeIndex);
          break;
        default:
          break;
      }
    },
    [activeIndex, columns, rows, moveTo, onSound],
  );

  return { activeIndex, tabIndexFor, registerMarker, onKeyDown };
}
