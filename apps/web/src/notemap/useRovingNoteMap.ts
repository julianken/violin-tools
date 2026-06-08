// useRovingNoteMap — the §11.3 roving-tabindex keyboard model for the note-map
// composite widget. DESIGN.md §11.3 wins on any conflict (AGENTS.md).
//
// The 60-dot SVG map is ONE composite widget, not 60 tab stops: exactly one
// marker is tabbable (`tabindex="0"`) at a time, the rest are `tabindex="-1"`.
// Arrow keys move focus among the markers along the two grid axes — the ALONG
// axis (a string, by column) and the CROSS axis (across strings) — re-bound to
// the VISUAL axis per `orientation` (§11.3): horizontal binds Left/Right to ALONG
// and Up/Down to CROSS, vertical swaps them, and `handedness` (via `crossOrder`)
// sets the cross sign so a key always moves focus in the matching screen
// direction. Enter/Space sound the focused marker, Home/End jump to the string
// ends (always along-string, orientation-invariant), and Tab (left to the
// browser) exits the whole widget. The grid is `STRINGS × COLUMN_OFFSETS`, so a
// marker's flat index is `stringIndex * columns + columnOffset` (unchanged by a
// flip — only the key → delta mapping rotates).
//
// This is keyboard wiring only — it carries NO motion and NO ARIA-name logic
// (NoteMap owns the per-marker `aria-label`). It tracks the focused marker as
// React state so the roving `tabindex` and the visible §8 focus ring stay on the
// same element; the initial tabbable marker is the root (or, if no root marker is
// supplied, the first marker), per §11.3.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { crossOrder } from './geometry';
import type { Handedness, Orientation } from './mapView';

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
  /**
   * The resolved render orientation (§12.1). The flat index model is unchanged;
   * only the physical-key → delta mapping flips: horizontal binds Left/Right to
   * the ALONG axis (a string) and Up/Down to the CROSS axis (across strings),
   * vertical swaps them, so the arrow keys always match what the user sees (§11.3).
   */
  orientation: Orientation;
  /**
   * Player handedness (§12.5). Together with `orientation` it sets the CROSS-axis
   * sign (via `crossOrder`) so a key pressed toward the larger on-screen cross
   * coordinate moves focus in that screen direction even when the string order is
   * reversed (vertical+right, horizontal+left).
   */
  handedness: Handedness;
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
  orientation,
  handedness,
}: RovingNoteMapOptions): RovingNoteMap {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  // Live element refs so an arrow key can move focus to the newly-active marker.
  const markerRefs = useRef<(SVGGElement | null)[]>([]);
  // Whether the user has interacted (so an initialIndex change doesn't yank focus
  // away from a marker the user arrowed to). On a fresh root, the active marker
  // re-snaps to the root only until the first keyboard move.
  const movedRef = useRef(false);
  // A live mirror of `activeIndex` so the orientation-flip refocus effect can read
  // the current active marker WITHOUT taking `activeIndex` as a dependency — the
  // effect must re-focus only on a FLIP, not on every arrow move (`moveTo` already
  // focuses on each keystroke). Kept in sync wherever `setActiveIndex` is called.
  const activeIndexRef = useRef(initialIndex);

  // Keep the tabbable marker on the root as long as the user hasn't arrowed yet:
  // a root/scale change recomputes `initialIndex`, and the map should present the
  // root as the entry point until the user takes over navigation (§11.3).
  useEffect(() => {
    if (!movedRef.current) {
      setActiveIndex(initialIndex);
      activeIndexRef.current = initialIndex;
    }
  }, [initialIndex]);

  // Preserve focus on the SAME note across an orientation flip (§11.3): once the
  // user has arrowed (movedRef), a flip re-projects the dots, so re-focus the
  // active marker's element to keep the visible focus ring on the same note. Keyed
  // on `orientation` only — the flat index is unchanged by the flip, so the same
  // marker element stays active. Reads the active index from a ref so the effect
  // has no `activeIndex` dependency (re-focus on a FLIP, not on every move —
  // `moveTo` already focuses on a keystroke).
  //
  // Gated on TWO conditions, BOTH required (WCAG 3.2 — no surprise focus change):
  //   • movedRef — the user has taken over navigation (so the initial AUTO flip,
  //     with no user interaction yet, never steals focus into the SVG); AND
  //   • focus currently lives ON a marker in this widget — if the user has since
  //     Tabbed AWAY (focus parked on the skip link or another control), a flip
  //     must NOT yank focus back into the SVG. We re-focus only to KEEP the ring
  //     on a note the user is already focused on, never to grab focus from
  //     elsewhere. (`movedRef` alone is sticky-true forever once arrowed, so it
  //     can't distinguish "still in the map" from "left the map".)
  useEffect(() => {
    const active = document.activeElement;
    const focusInWidget = markerRefs.current.some((el) => el !== null && el === active);
    if (movedRef.current && focusInWidget) {
      markerRefs.current[activeIndexRef.current]?.focus();
    }
  }, [orientation]);

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
    activeIndexRef.current = index;
    // Move focus to the marker we just activated so the roving tabindex and the
    // visible focus ring stay on the same element (§8 / §11.3).
    markerRefs.current[index]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<SVGGElement>) => {
      const row = Math.floor(activeIndex / columns);
      const col = activeIndex % columns;

      // ALONG the string (by column): ±1, clamped at the open/last column.
      const along = (step: 1 | -1): void => {
        const nextCol = col + step;
        if (nextCol >= 0 && nextCol < columns) moveTo(activeIndex + step);
      };
      // ACROSS strings (by string): ±columns, clamped at the first/last string.
      // `sign` is the on-SCREEN direction the key presses (toward the larger cross
      // coordinate = +1). The cross-axis flat-index step that increases the visual
      // position depends on the string order: a string's visual position is
      // `order.indexOf(stringIndex)`, so when `order` is ASCENDING ([0,1,2,3])
      // increasing `stringIndex` (+columns) increases the position, and when it is
      // DESCENDING ([3,2,1,0]) it decreases it — so the flat-index step is inverted.
      const order = crossOrder(orientation, handedness);
      const crossStep = order[0] === 0 ? columns : -columns; // +columns if ascending
      const cross = (sign: 1 | -1): void => {
        const nextRow = row + (sign * crossStep) / columns;
        if (nextRow >= 0 && nextRow < rows) moveTo(activeIndex + sign * crossStep);
      };

      switch (event.key) {
        // Re-bind the arrow keys to the VISUAL axis per orientation (§11.3): in
        // horizontal Left/Right are ALONG and Up/Down are CROSS; vertical swaps
        // them. Up/Left always press toward the smaller coordinate, Down/Right
        // toward the larger — so the keys match what the user sees in both.
        case 'ArrowRight':
          event.preventDefault();
          if (orientation === 'horizontal') along(1);
          else cross(1);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          if (orientation === 'horizontal') along(-1);
          else cross(-1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (orientation === 'horizontal') cross(1);
          else along(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (orientation === 'horizontal') cross(-1);
          else along(-1);
          break;
        // Home/End are ALWAYS along-string (the string ends), orientation-invariant.
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
    [activeIndex, columns, rows, moveTo, onSound, orientation, handedness],
  );

  return { activeIndex, tabIndexFor, registerMarker, onKeyDown };
}
