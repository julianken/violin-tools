// useActiveHighlight — positions the STATIC active-pill highlight on the
// single-select Root and Scale rows (§8.1 active wash). DESIGN.md §8.1 / §7 win
// on any conflict (AGENTS.md).
//
// This is the transitions-dev tabs-sliding (#16) pattern at its REST state only:
// a single absolutely-positioned element behind the pills whose `transform`
// (translateX) and `width` are written from the active pill's `offsetLeft` /
// `offsetWidth`. S6 writes those values WITHOUT any transition (the highlight is
// static); S8 (#16) adds the `transform`/`width` tween + the first-paint/resize
// `transition:none` snap + the `prefers-reduced-motion` guard. No @keyframes,
// transition, or stagger is authored in S6 — only the positioned element S8
// animates.
//
// Implementation note (the #16 first-paint gotcha, pre-handled for S8): we
// measure in `useLayoutEffect` so the highlight is positioned BEFORE the browser
// paints — it never flashes at `translateX(0)/width:0`. A `ResizeObserver` on the
// track re-measures on layout change (wrap, font load, viewport resize) so the
// highlight tracks the active pill without a window-resize listener.

import { useCallback, useLayoutEffect, useRef } from 'react';

interface ActiveHighlight {
  /** Ref for the row's pill track (the positioned-ancestor the highlight sits in). */
  trackRef: React.RefObject<HTMLDivElement | null>;
  /** Ref for the highlight element itself. */
  highlightRef: React.RefObject<HTMLSpanElement | null>;
  /** Ref callback to register the active pill so its box can be measured. */
  setActivePill: (el: HTMLButtonElement | null) => void;
}

/**
 * Position the static highlight at the active pill. `activeKey` is whatever
 * identifies the current selection (root or scale value); a change re-runs the
 * layout effect and re-positions the highlight to the new active pill's box.
 */
export function useActiveHighlight(activeKey: string): ActiveHighlight {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);
  const activePillRef = useRef<HTMLButtonElement | null>(null);

  const position = useCallback(() => {
    const pill = activePillRef.current;
    const highlight = highlightRef.current;
    if (pill === null || highlight === null) return;
    // The #16 measure: write the active pill's box onto the highlight. S6 leaves
    // `transition` unset in CSS, so this is an instant snap (static). S8 adds the
    // tween + the explicit `transition:none` first-paint suspend.
    highlight.style.transform = `translateX(${String(pill.offsetLeft)}px)`;
    highlight.style.width = `${String(pill.offsetWidth)}px`;
  }, []);

  // Layout effect → positioned before paint (no first-paint flash; §16 gotcha).
  useLayoutEffect(() => {
    position();
    const track = trackRef.current;
    // `ResizeObserver` is a browser API; guard for environments without it
    // (jsdom under the test gate, any non-DOM runtime) — the initial `position()`
    // above still runs, only the live re-measure is skipped.
    if (track === null || typeof ResizeObserver === 'undefined') return;
    // Re-measure on any layout change (wrap / font load / resize) without a
    // window listener — the highlight stays glued to the active pill.
    const observer = new ResizeObserver(() => {
      position();
    });
    observer.observe(track);
    return () => {
      observer.disconnect();
    };
  }, [position, activeKey]);

  const setActivePill = useCallback((el: HTMLButtonElement | null) => {
    activePillRef.current = el;
  }, []);

  return { trackRef, highlightRef, setActivePill };
}
