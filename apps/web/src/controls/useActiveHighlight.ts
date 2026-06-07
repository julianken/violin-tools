// useActiveHighlight — positions and TWEENS the active-pill highlight on the
// single-select Root and Scale rows (§8.1 active wash). DESIGN.md §8.1 / §7 win
// on any conflict (AGENTS.md).
//
// This is the transitions-dev tabs-sliding (#16) pattern, full: a single
// absolutely-positioned element behind the pills whose `transform` (translateX)
// and `width` are written from the active pill's `offsetLeft` / `offsetWidth`.
// motion.css owns the `transform`/`width` tween (color-shift 140ms ease-standard)
// + the `prefers-reduced-motion` snap; S8 (#16) adds here the JS half: the tween
// fires on a SELECTION change, but on FIRST PAINT and on RESIZE the highlight must
// SNAP to the active pill — otherwise it animates in from `translateX(0)/width:0`
// (the #16 first-paint gotcha). We snap by suspending the transition
// (`transition: none`), forcing a reflow (`void el.offsetWidth`), then restoring
// it, exactly the tabs-sliding wire-up.
//
// Implementation note: we measure in `useLayoutEffect` so the highlight is
// positioned BEFORE the browser paints — the first measurement is a snap. A
// `ResizeObserver` on the track re-measures (and snaps) on layout change (wrap,
// font load, viewport resize) so the highlight tracks the active pill without a
// window-resize listener and without an unwanted slide on resize.

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

  // Write the active pill's box onto the highlight. `snap` suspends the CSS
  // transition for first-paint / resize positioning (transition:none → forced
  // reflow → restore — the #16 gotcha) so the highlight jumps instead of sliding
  // in from translateX(0)/width:0; a selection change calls it WITHOUT `snap` so
  // the CSS tween carries the move.
  const position = useCallback((snap: boolean) => {
    const pill = activePillRef.current;
    const highlight = highlightRef.current;
    if (pill === null || highlight === null) return;
    if (snap) {
      const prev = highlight.style.transition;
      highlight.style.transition = 'none';
      highlight.style.transform = `translateX(${String(pill.offsetLeft)}px)`;
      highlight.style.width = `${String(pill.offsetWidth)}px`;
      // Force a synchronous reflow so the no-transition jump commits before the
      // tween is restored — without this the browser coalesces the writes and the
      // element still animates from its old box (tabs-sliding #16 wire-up).
      void highlight.offsetWidth;
      highlight.style.transition = prev;
      return;
    }
    highlight.style.transform = `translateX(${String(pill.offsetLeft)}px)`;
    highlight.style.width = `${String(pill.offsetWidth)}px`;
  }, []);

  // First paint: snap (positioned before paint, no first-paint slide; #16 gotcha).
  // On a later selection change this effect re-runs (activeKey changed) and we let
  // it TWEEN — `firstRef` distinguishes the two.
  const firstRef = useRef(true);
  useLayoutEffect(() => {
    position(firstRef.current);
    firstRef.current = false;
    const track = trackRef.current;
    // `ResizeObserver` is a browser API; guard for environments without it
    // (jsdom under the test gate, any non-DOM runtime) — the initial `position()`
    // above still runs, only the live re-measure is skipped.
    if (track === null || typeof ResizeObserver === 'undefined') return;
    // Re-measure on any layout change (wrap / font load / resize) without a
    // window listener — the highlight SNAPS (no slide) so a resize never animates.
    const observer = new ResizeObserver(() => {
      position(true);
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
