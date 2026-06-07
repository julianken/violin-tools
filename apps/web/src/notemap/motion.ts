// motion.ts — the minimal JS half of the §7 motion layer (DESIGN.md §7 wins on
// any conflict, AGENTS.md). The CSS (motion.css) owns every transition / keyframe
// / value; this file owns ONLY the imperative bit a stylesheet cannot express: the
// snappy build's `void el.offsetWidth` reflow-to-replay (the transitions-dev
// number-pop-in 02 orchestration), so an off→in-scale dot re-runs `dotPop` on each
// (root, scale) change instead of the keyframe playing once on mount. No timing
// value lives here — the durations/easings/stagger are §0 tokens read from CSS.

import { useLayoutEffect, useRef } from 'react';

/** The two §7 motion builds, selected by the `data-motion` root attribute. */
export type MotionBuild = 'stateful' | 'snappy';

/**
 * Reflow-to-replay for the snappy build (transitions-dev number-pop-in 02).
 *
 * The `dotPop` keyframe (motion.css) plays once when `.dot-anim` first appears.
 * To make an off→in-scale dot re-pop on every (root, scale) change — re-classed
 * in place, never re-mounted (§7.2, Principle 5) — we strip `.dot-anim`, force a
 * synchronous reflow with `void el.offsetWidth`, then re-add it. The browser then
 * treats it as a fresh animation and replays `dotPop`.
 *
 * - Runs only in the snappy build; the stateful build uses CSS property
 *   transitions, which need no replay.
 * - jsdom (the Vitest gate) does not run keyframes; the reflow read is a harmless
 *   no-op there, so this is safe under test.
 *
 * `notesRef` points at the `.notes` group; `changeKey` is whatever identifies the
 * current (root, scale) selection — a change re-runs the effect.
 */
export function useDotPopReplay(
  notesRef: React.RefObject<SVGGElement | null>,
  build: MotionBuild,
  changeKey: string,
): void {
  // Skip the very first paint: the dots mount with `.dot-anim` already present, so
  // the keyframe plays once on its own (the §7.5 snappy "Enter" row). The replay
  // is for SUBSEQUENT changes only.
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    const group = notesRef.current;
    if (build !== 'snappy' || group === null) {
      mountedRef.current = true;
      return;
    }
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const anims = Array.from(group.querySelectorAll<SVGGElement>('.dot-anim'));
    for (const el of anims) el.classList.remove('dot-anim');
    // One reflow for the whole group is enough to reset every animation (the
    // number-pop-in trick; `offsetWidth` forces synchronous layout).
    void group.getBoundingClientRect().width;
    for (const el of anims) el.classList.add('dot-anim');
  }, [notesRef, build, changeKey]);
}
