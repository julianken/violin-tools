import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { NoteMap } from './NoteMap';
import type { Orientation } from './mapView';
import { useOrientationSnap } from './motion';

// motion.test — the Vitest (jsdom) half of the §7 motion verification (DESIGN.md
// §7 wins on conflict, AGENTS.md). jsdom does NOT compute CSS transitions or run
// keyframes, so a naive "assert motion is gone" test passes vacuously (§7.5 plan
// note). Instead this layer asserts what jsdom CAN observe:
//   • the resolved §0 CSS-custom-property VALUES per the §7.5 row, read via
//     getComputedStyle().getPropertyValue() — and that they differ correctly
//     between data-motion="stateful" and "snappy" (the two variable sets);
//   • the hook classes / state attributes (is-off/is-scale/is-root, .dot-anim on
//     in-scale dots in snappy, .sound mounted, the build selector, --col stagger);
//   • that the @media (prefers-reduced-motion: reduce) rule is PRESENT in the
//     parsed stylesheet (CSSMediaRule inspection) — not that motion is gone.
//
// The vite config sets `css: false`, so a CSS `import` is a no-op under test; we
// read the real motion.css + tokens.css off disk and inject them as <style> so
// getComputedStyle resolves the live custom properties (NOT a fixture copy — the
// shipped files, so a value drift fails the gate).

// Vitest runs with cwd = the apps/web workspace, so the SHIPPED stylesheets are
// resolved from there (never a fixture copy — a value drift in the real CSS then
// fails the gate).
const tokensCss = readFileSync(
  resolve(process.cwd(), 'src/styles/tokens.css'),
  'utf8',
);
const motionCss = readFileSync(
  resolve(process.cwd(), 'src/notemap/motion.css'),
  'utf8',
);

let tokensStyle: HTMLStyleElement;
let motionStyle: HTMLStyleElement;

beforeAll(() => {
  tokensStyle = document.createElement('style');
  tokensStyle.textContent = tokensCss;
  document.head.appendChild(tokensStyle);
  motionStyle = document.createElement('style');
  motionStyle.textContent = motionCss;
  document.head.appendChild(motionStyle);
});

afterEach(() => {
  document.body.replaceChildren();
});

/** Mount the map inside a `.board` SVG host carrying the build's data-motion. */
function renderBoard(
  motion: 'stateful' | 'snappy',
  props?: Parameters<typeof NoteMap>[0],
) {
  const { container } = render(
    <svg className="board" data-motion={motion}>
      <NoteMap motion={motion} {...props} />
    </svg>,
  );
  const board = container.querySelector<SVGSVGElement>('svg.board');
  if (board === null) throw new Error('no board host');
  return {
    board,
    notes: () => Array.from(board.querySelectorAll<SVGGElement>('g.note')),
  };
}

/** Resolve a custom property off the board element for the given build. */
function cssVar(board: Element, name: string): string {
  return getComputedStyle(board).getPropertyValue(name).trim();
}

/** Normalize whitespace so jsdom's space-stripped cubic-bezier compares equal. */
function norm(value: string): string {
  return value.replace(/\s+/g, '');
}

describe('motion — §0 token values per §7.5 (resolved CSS custom properties)', () => {
  // The §7.1 / §7.5 stateful rows: each duration/easing token resolves to its §0
  // literal (S2 minted them; here we assert the motion layer reads the right
  // names). Read off the board (the cascade root for the note map).
  it('exposes the §7.1 stateful durations/easings as their §0 literals', () => {
    const { board } = renderBoard('stateful');
    expect(cssVar(board, '--dot-radius')).toBe('230ms'); // r ease-spring (§7.1)
    expect(cssVar(board, '--state-color')).toBe('200ms'); // fill/stroke + .land
    expect(cssVar(board, '--glow-fade')).toBe('200ms'); // glow opacity
    expect(cssVar(board, '--label-fade')).toBe('160ms'); // lbl opacity
    expect(cssVar(board, '--lbl-fill')).toBe('190ms'); // lbl fill (no-snap)
    expect(cssVar(board, '--tape-slide')).toBe('230ms'); // tape transform
    expect(norm(cssVar(board, '--ease-spring'))).toBe(
      norm('cubic-bezier(0.34, 1.45, 0.64, 1)'),
    );
    expect(norm(cssVar(board, '--ease-spring-2'))).toBe(
      norm('cubic-bezier(0.34, 1.4, 0.64, 1)'),
    );
  });

  it('exposes the §7.2 snappy pop duration + ease-overshoot as their §0 literals', () => {
    const { board } = renderBoard('snappy');
    expect(cssVar(board, '--pop')).toBe('150ms');
    expect(norm(cssVar(board, '--ease-overshoot'))).toBe(
      norm('cubic-bezier(0.34, 1.56, 0.64, 1)'),
    );
  });

  it('exposes the §0 active-highlight color-shift (140ms) + ease-standard', () => {
    const { board } = renderBoard('stateful');
    expect(cssVar(board, '--color-shift')).toBe('140ms'); // tabs-sliding #16
    expect(cssVar(board, '--ease-standard')).toBe('ease');
  });
});

describe('motion — the two variable sets differ correctly by build (§7.1 / §7.2)', () => {
  // The single data-motion toggle selects two variable SETS. The shared aliases
  // (--stagger-per-column, --root-ring-color) resolve to the build's source token,
  // which is exactly how one recipe yields two builds with no rule fork.
  // jsdom does not resolve a custom-property-to-custom-property `var()` alias in
  // getComputedStyle, so we verify the chain in two halves: (a) each build's alias
  // POINTS at the right source token (the literal `var(--…)` reference differs by
  // build — this is what makes one recipe two builds), and (b) the source tokens
  // resolve to the §0 literals. A real browser collapses the chain; the e2e layer
  // asserts the resolved value end-to-end.
  it('stagger-per-column alias points at the build source; the sources are 6ms / 10ms', () => {
    expect(cssVar(renderBoard('stateful').board, '--stagger-per-column')).toBe(
      'var(--stagger-per-column-stateful)',
    );
    expect(cssVar(renderBoard('snappy').board, '--stagger-per-column')).toBe(
      'var(--stagger-per-column-snappy)',
    );
    // The two source tokens themselves resolve to the §0 literals (S2).
    expect(
      cssVar(renderBoard('stateful').board, '--stagger-per-column-stateful'),
    ).toBe('6ms');
    expect(
      cssVar(renderBoard('snappy').board, '--stagger-per-column-snappy'),
    ).toBe('10ms');
  });

  it('root-ring-color alias points at root-glow (.28) stateful / root-glow-snappy (.25) snappy', () => {
    expect(cssVar(renderBoard('stateful').board, '--root-ring-color')).toBe(
      'var(--root-glow)',
    );
    expect(cssVar(renderBoard('snappy').board, '--root-ring-color')).toBe(
      'var(--root-glow-snappy)',
    );
    // The source tokens resolve to the §0 alpha literals — same {mint} hue.
    expect(norm(cssVar(renderBoard('stateful').board, '--root-glow'))).toBe(
      norm('rgba(0, 212, 164, 0.28)'),
    );
    expect(norm(cssVar(renderBoard('snappy').board, '--root-glow-snappy'))).toBe(
      norm('rgba(0, 212, 164, 0.25)'),
    );
  });
});

describe('motion — per-column stagger index --col (texts-reveal 18)', () => {
  it('writes --col = the 0…14 column offset on each note <g>', () => {
    const { notes } = renderBoard('stateful');
    const all = notes();
    expect(all).toHaveLength(60);
    // The first string's 15 columns carry --col 0…14 in order.
    const firstRow = all.slice(0, 15);
    firstRow.forEach((node, col) => {
      expect(node.style.getPropertyValue('--col')).toBe(String(col));
    });
    // Column 0 vs column 14 differ by 14 (the basis the e2e delay assertion uses).
    const col0 = Number(firstRow[0]?.style.getPropertyValue('--col'));
    const col14 = Number(firstRow[14]?.style.getPropertyValue('--col'));
    expect(col14 - col0).toBe(14);
  });
});

describe('motion — hook classes / state attributes (§7.1 / §7.2)', () => {
  it('the build selector flips data-motion on the board', () => {
    expect(renderBoard('stateful').board.getAttribute('data-motion')).toBe(
      'stateful',
    );
    expect(renderBoard('snappy').board.getAttribute('data-motion')).toBe(
      'snappy',
    );
  });

  it('applies .dot-anim to in-scale + root nodes in snappy, never in stateful (§7.2)', () => {
    const snappy = renderBoard('snappy', { rootPc: 9, scale: 'major' }).notes();
    for (const node of snappy) {
      const isOff = node.classList.contains('is-off');
      // off nodes carry no pop; in-scale/root nodes do (§7.2).
      expect(node.classList.contains('dot-anim')).toBe(!isOff);
    }
    // Stateful never adds .dot-anim — it uses property transitions.
    const stateful = renderBoard('stateful', {
      rootPc: 9,
      scale: 'major',
    }).notes();
    expect(stateful.some((n) => n.classList.contains('dot-anim'))).toBe(false);
  });

  it('mounts a persistent hidden .sound child on every note <g> (§12.2 / §7.5)', () => {
    const { notes } = renderBoard('stateful');
    for (const node of notes()) {
      const sound = node.querySelector('circle.sound');
      expect(sound).not.toBeNull();
      // It is between the dot and the label in document order (§12.2).
      const children = Array.from(node.children).map((c) =>
        c.getAttribute('class'),
      );
      const dotIdx = children.indexOf('dot');
      const soundIdx = children.indexOf('sound');
      const lblIdx = children.indexOf('lbl');
      expect(dotIdx).toBeLessThan(soundIdx);
      expect(soundIdx).toBeLessThan(lblIdx);
    }
  });

  it('the .sound child carries the static stroke-width:3 {mint} ring, opacity 0 at rest', () => {
    const { notes } = renderBoard('stateful');
    const sound = notes()[0]?.querySelector('circle.sound');
    if (sound === null || sound === undefined) throw new Error('no .sound');
    const cs = getComputedStyle(sound);
    expect(cs.strokeWidth).toBe('3');
    expect(cs.opacity).toBe('0'); // hidden at rest; opacity-only toggle (§7.5)
    // fill:none is set both as the SVG attribute and in CSS (jsdom reports the
    // computed fill as transparent, so assert the attribute the renderer sets).
    expect(sound.getAttribute('fill')).toBe('none');
  });

  it('exactly one is-off|is-scale|is-root state class per node (the sole driver)', () => {
    const { notes } = renderBoard('stateful');
    for (const node of notes()) {
      const states = ['is-off', 'is-scale', 'is-root'].filter((c) =>
        node.classList.contains(c),
      );
      expect(states).toHaveLength(1);
    }
  });
});

describe('motion — NO pulse keyframe anywhere; only dotPop is defined (§7.5 / §8.9)', () => {
  it('motion.css defines dotPop and defines NO pulse keyframe (§8.9 transport OUT)', () => {
    // Source-level guard: the only @keyframes is dotPop; transport/pulse is OUT
    // (§8.9 / §16) so no pulse keyframe may exist in any motion mode. Strip CSS
    // comments first so prose like "no pulse keyframe" doesn't false-positive.
    const code = motionCss.replace(/\/\*[\s\S]*?\*\//g, '');
    const keyframeNames = [...code.matchAll(/@keyframes\s+([\w-]+)/g)].map(
      (m) => m[1],
    );
    expect(keyframeNames).toEqual(['dotPop']);
    // No `animation` declaration references a pulse keyframe; the only animation
    // any rule names is dotPop (the .dot-anim rule).
    const animationNames = [
      ...code.matchAll(/animation:\s*([\w-]+)/g),
    ].map((m) => m[1]);
    expect(animationNames.every((n) => n === 'dotPop' || n === 'none')).toBe(
      true,
    );
    expect(code).not.toMatch(/pulse/i);
  });

  it('dotPop matches §7.2 EXACTLY (0% scale.5/blur1.5px → 70% opacity1 → 100% scale1/blur0)', () => {
    // Find the dotPop rule in the parsed stylesheet and assert its keyframes.
    const sheet = motionStyle.sheet;
    if (sheet === null) throw new Error('motion stylesheet not parsed');
    const kf = Array.from(sheet.cssRules).find(
      (r): r is CSSKeyframesRule =>
        r instanceof CSSKeyframesRule && r.name === 'dotPop',
    );
    if (kf === undefined) throw new Error('dotPop keyframes not found');
    const at = (key: string) =>
      Array.from(kf.cssRules).find(
        (r): r is CSSKeyframeRule =>
          r instanceof CSSKeyframeRule && r.keyText === key,
      )?.style;
    const k0 = at('0%');
    const k70 = at('70%');
    const k100 = at('100%');
    expect(k0?.opacity).toBe('0');
    expect(k0?.transform).toBe('scale(0.5)');
    expect(k0?.filter).toBe('blur(1.5px)');
    expect(k70?.opacity).toBe('1');
    expect(k100?.opacity).toBe('1');
    expect(k100?.transform).toBe('scale(1)');
    expect(k100?.filter).toBe('blur(0)');
  });
});

describe('motion — the §7.4 reduced-motion gate is PRESENT (CSSMediaRule)', () => {
  it('parses a @media (prefers-reduced-motion: reduce) rule in motion.css', () => {
    const sheet = motionStyle.sheet;
    if (sheet === null) throw new Error('motion stylesheet not parsed');
    const media = Array.from(sheet.cssRules).filter(
      (r): r is CSSMediaRule => r instanceof CSSMediaRule,
    );
    const reduce = media.find((r) =>
      r.media.mediaText.includes('prefers-reduced-motion'),
    );
    expect(reduce).toBeDefined();
    const inner = Array.from(reduce?.cssRules ?? []).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule,
    );
    const selectors = inner.map((r) => r.selectorText);
    // §7.4 sets `.dot-anim { animation: none }`.
    expect(selectors).toContain('.dot-anim');
    const dotAnim = inner.find((r) => r.selectorText === '.dot-anim');
    expect(dotAnim?.style.animation).toBe('none');
    // The canonical §7.4 transition:none list — jsdom keeps it as one rule with
    // the full selector text; every §7.4 member is present.
    const canonical = inner.find(
      (r) =>
        r.style.transition === 'none' && r.selectorText.includes('.note .dot'),
    );
    expect(canonical).toBeDefined();
    for (const sel of [
      '.note .glow',
      '.note .lbl',
      '.tape',
      '.land',
      '.overlay',
      '.palette',
      '.pill',
    ]) {
      expect(canonical?.selectorText).toContain(sel);
    }
    // The board-scoped override that actually WINS over the build rules (a media
    // query adds no specificity, so the bare list above can't beat
    // `.board[data-motion] …`). It zeroes the transition AND the stagger delay.
    const scoped = inner.find(
      (r) =>
        r.style.transition === 'none' &&
        r.selectorText.includes('.board[data-motion]'),
    );
    expect(scoped).toBeDefined();
    expect(scoped?.style.getPropertyValue('transition-delay')).toBe('0s');
    // §7.4 / §11.4 orientation-flip forward-proofing clause (S16 ph2 U6): a future
    // board-scoped position transition on `.note`/`.notes` must be zeroed here, and
    // MUST carry the `.board[data-motion]` prefix to win the cascade against a build
    // rule (a media query adds no specificity). Assert that reserved selector is
    // present with transition:none — so the §7.4 contract covers a future move.
    const positionSnap = inner.find(
      (r) =>
        r.style.transition === 'none' &&
        r.selectorText.includes('.board[data-motion] .note') &&
        r.selectorText.includes('.board[data-motion] .notes'),
    );
    expect(positionSnap).toBeDefined();
    // .pill:active transform:none
    const pillActive = inner.find((r) => r.selectorText === '.pill:active');
    expect(pillActive?.style.transform).toBe('none');
  });
});

describe('motion — useOrientationSnap forward-proofing snap (S16 ph2 U6)', () => {
  // The orientation flip ALREADY snaps by construction (motion.css transitions
  // only r/fill/stroke/opacity, never cx/cy or a .note <g> transform, and a flip
  // moves dots by rewriting cx/cy ATTRIBUTES, which don't tween). This hook is
  // FORWARD-PROOFING: if a later phase adds a position transition, the orientation
  // flip is already covered by suspending transitions + forcing one reflow on a
  // change. It mirrors useDotPopReplay's mountedRef skip-first-paint + the
  // motion.ts `getBoundingClientRect().width` reflow idiom. jsdom runs no
  // transitions, so this is a structural + no-throw + reflow-call assertion.

  it('is a no-op on first paint (mountedRef skips the initial mount)', () => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const spy = vi.spyOn(group, 'getBoundingClientRect');
    const notesRef = { current: group } satisfies React.RefObject<SVGGElement | null>;

    renderHook(() => {
      useOrientationSnap(notesRef, 'horizontal');
    });

    // First paint must not force a reflow — the first vertical paint is already a
    // snap with no flash, so the hook does nothing until orientation CHANGES.
    expect(spy).not.toHaveBeenCalled();
  });

  it('forces one reflow on the group when orientation CHANGES (skip-first then run)', () => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const spy = vi.spyOn(group, 'getBoundingClientRect');
    const notesRef = { current: group } satisfies React.RefObject<SVGGElement | null>;

    const initialProps: { orientation: Orientation } = { orientation: 'horizontal' };
    const { rerender } = renderHook(
      ({ orientation }: { orientation: Orientation }) => {
        useOrientationSnap(notesRef, orientation);
      },
      { initialProps },
    );
    expect(spy).not.toHaveBeenCalled(); // still skipped on first paint

    rerender({ orientation: 'vertical' });
    // The change forces exactly one reflow read (the canonical NOTEMAP idiom:
    // suspend → getBoundingClientRect().width → restore).
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the orientation prop re-renders unchanged', () => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const spy = vi.spyOn(group, 'getBoundingClientRect');
    const notesRef = { current: group } satisfies React.RefObject<SVGGElement | null>;

    const initialProps: { orientation: Orientation } = { orientation: 'horizontal' };
    const { rerender } = renderHook(
      ({ orientation }: { orientation: Orientation }) => {
        useOrientationSnap(notesRef, orientation);
      },
      { initialProps },
    );
    rerender({ orientation: 'horizontal' }); // same value — effect dep unchanged
    expect(spy).not.toHaveBeenCalled();
  });

  it('is a safe no-op when the ref is null (no group mounted yet)', () => {
    const notesRef = { current: null } satisfies React.RefObject<SVGGElement | null>;
    expect(() =>
      renderHook(() => {
        useOrientationSnap(notesRef, 'horizontal');
      }),
    ).not.toThrow();
  });
});

describe('motion — orientation flip morphs, never remounts (S16 ph2 U6)', () => {
  // A flip moves the 60 dots' coordinates (cx/cy) — it does NOT rebuild the .notes
  // group. The persistent key (stringIndex, columnOffset) is orientation-invariant,
  // so React reuses the SAME elements; the snap moves coordinates in place.
  function renderFlippable(orientation: 'horizontal' | 'vertical') {
    const { container, rerender } = render(
      <svg className="board" data-motion="stateful">
        <NoteMap
          motion="stateful"
          orientation={orientation}
          handedness="right"
          density={orientation === 'horizontal' ? 'fit' : 'comfort'}
        />
      </svg>,
    );
    const board = container.querySelector<SVGSVGElement>('svg.board');
    if (board === null) throw new Error('no board host');
    return {
      notes: () => Array.from(board.querySelectorAll<SVGGElement>('g.note')),
      flip: (next: 'horizontal' | 'vertical') => {
        rerender(
          <svg className="board" data-motion="stateful">
            <NoteMap
              motion="stateful"
              orientation={next}
              handedness="right"
              density={next === 'horizontal' ? 'fit' : 'comfort'}
            />
          </svg>,
        );
      },
    };
  }

  it('keeps the same 60 g.note element identities across a vertical→horizontal flip', () => {
    const { notes, flip } = renderFlippable('vertical');
    const before = notes();
    expect(before).toHaveLength(60);
    const beforeRefs = [...before];

    expect(() => {
      flip('horizontal');
    }).not.toThrow();

    const after = notes();
    expect(after).toHaveLength(60); // nothing unmounted/remounted on the flip
    for (let i = 0; i < 60; i++) {
      expect(after[i]).toBe(beforeRefs[i]); // same elements — coordinates moved, not rebuilt
    }
  });

  it('preserves the --col / data-col stagger seam across the flip (S8 + e2e col 0 vs 14)', () => {
    const { notes, flip } = renderFlippable('vertical');
    flip('horizontal');
    const all = notes();
    // The first string's 15 columns still carry --col / data-col 0…14 in order —
    // the stagger seam the e2e (col 0 vs col 14) and S8 depend on is untouched.
    const firstRow = all.slice(0, 15);
    firstRow.forEach((node, col) => {
      expect(node.style.getPropertyValue('--col')).toBe(String(col));
      expect(node.getAttribute('data-col')).toBe(String(col));
    });
  });
});
