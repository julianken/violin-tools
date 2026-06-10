import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CENTER_X, centsToX } from '../tuner/meter-geometry.ts';

import { DrillMeter } from './DrillMeter.tsx';

// DrillMeter unit tests (DESIGN.md §17.2 / C7). DESIGN.md wins on any conflict
// (AGENTS.md). The meter is PURELY PRESENTATIONAL — no audio — so every §17.2
// and C7 behaviour is verifiable in jsdom: the seeking vs in-tune morph, the dot
// x-position, the in-dot label appearing ONLY in tune, the echo trail, and the
// no-red rule.
//
// Echo trail tests use `act()` to flush the useEffect that imperatively updates
// echo node attributes (since the echo positions are written in useEffect, not
// during render).

/** The live dot group inside the drill meter SVG. */
function dotGroup(container: HTMLElement): SVGGElement {
  const g = container.querySelector<SVGGElement>('.drill-dot-g');
  if (g === null) throw new Error('no drill-dot-g');
  return g;
}

/** Extract the x value from a translate(x, y) transform attribute. */
function transformX(g: SVGGElement): number {
  const transform = g.getAttribute('transform') ?? '';
  return Number(/translate\(([-\d.]+)/.exec(transform)?.[1]);
}

// ── Seeking state ────────────────────────────────────────────────────────────

describe('seeking state (running, liveCents non-null, inTune false)', () => {
  it('AC2 — dot is NOT in-tune, no targetLetter inside dot, x is off-center (flat → left)', () => {
    const { container } = render(
      <DrillMeter
        liveCents={-22}
        inTune={false}
        targetLetter="D"
        isRunning={true}
      />,
    );
    const g = dotGroup(container);

    // Not in-tune class (AC2).
    expect(g.classList.contains('is-in-tune')).toBe(false);
    expect(g.getAttribute('data-in-tune')).toBe('false');

    // No targetLetter inside the dot while seeking (§17.2 — in-scale dot carries no label).
    expect(container.querySelector('.drill-dot-lbl')?.textContent).toBe('');

    // Dot is left of center (flat = negative cents → left side, §17.7).
    expect(transformX(g)).toBeLessThan(centsToX(0));
    expect(transformX(g)).toBeLessThan(CENTER_X);
  });

  it('sharp reading sits right of center, flat left (symmetry check via centsToX)', () => {
    const { container: flatContainer } = render(
      <DrillMeter liveCents={-20} inTune={false} targetLetter="A" isRunning={true} />,
    );
    const { container: sharpContainer } = render(
      <DrillMeter liveCents={20} inTune={false} targetLetter="A" isRunning={true} />,
    );

    expect(transformX(dotGroup(sharpContainer))).toBeGreaterThan(CENTER_X); // sharp → right
    expect(transformX(dotGroup(flatContainer))).toBeLessThan(CENTER_X); // flat → left
  });
});

// ── In-tune state ────────────────────────────────────────────────────────────

describe('in-tune state (liveCents within ±5, inTune true)', () => {
  it('AC3 — dot has is-in-tune class, targetLetter inside dot, glow ring present', () => {
    const { container } = render(
      <DrillMeter
        liveCents={2}
        inTune={true}
        targetLetter="B♭"
        isRunning={true}
      />,
    );
    const g = dotGroup(container);

    // In-tune class set (AC3).
    expect(g.classList.contains('is-in-tune')).toBe(true);
    expect(g.getAttribute('data-in-tune')).toBe('true');

    // targetLetter appears inside the dot ONLY in tune (§17.2 root-dot label).
    expect(container.querySelector('.drill-dot-lbl')?.textContent).toBe('B♭');

    // Glow ring is present in the DOM (the CSS shows it on is-in-tune).
    expect(container.querySelector('.drill-glow')).not.toBeNull();
  });

  it('in-tune dot uses the larger root radius (§12.2)', () => {
    const { container } = render(
      <DrillMeter liveCents={0} inTune={true} targetLetter="E" isRunning={true} />,
    );
    const dot = container.querySelector('.drill-dot');
    // r=15 = IN_TUNE_RADIUS (§12.2 / §17.2), bigger than seeking r≈14.
    expect(dot?.getAttribute('r')).toBe('15');
  });

  it('AC5 — inTune=false with liveCents=2 → no glow class, no targetLetter (prop is authoritative)', () => {
    // The component never self-computes inTune; it trusts the prop. Passing
    // inTune=false with a 2¢ reading confirms the component does NOT override it.
    const { container } = render(
      <DrillMeter
        liveCents={2}
        inTune={false}
        targetLetter="D"
        isRunning={true}
      />,
    );
    const g = dotGroup(container);

    expect(g.classList.contains('is-in-tune')).toBe(false);
    expect(container.querySelector('.drill-dot-lbl')?.textContent).toBe('');
  });
});

// ── No signal ────────────────────────────────────────────────────────────────

describe('no signal (liveCents null) — never a false in-tune (§17.7)', () => {
  it('AC4 — dot parks at CENTER_X, not in-tune, no label', () => {
    const { container } = render(
      <DrillMeter
        liveCents={null}
        inTune={false}
        targetLetter="G"
        isRunning={true}
      />,
    );
    const g = dotGroup(container);

    // Not in-tune.
    expect(g.classList.contains('is-in-tune')).toBe(false);
    // No label.
    expect(container.querySelector('.drill-dot-lbl')?.textContent).toBe('');
    // Parks at CENTER_X.
    expect(transformX(g)).toBeCloseTo(CENTER_X, 5);
  });

  it('AC4 — liveCents null + inTune true still never shows green (§17.7)', () => {
    // A silent meter must never show the in-tune state even if the hook passes
    // inTune=true erroneously (the component is the last line of defence).
    const { container } = render(
      <DrillMeter
        liveCents={null}
        inTune={true}
        targetLetter="A"
        isRunning={true}
      />,
    );
    const g = dotGroup(container);
    expect(g.classList.contains('is-in-tune')).toBe(false);
    expect(container.querySelector('.drill-dot-lbl')?.textContent).toBe('');
  });
});

// ── isRunning=false ──────────────────────────────────────────────────────────

describe('idle state (isRunning false)', () => {
  it('renders at center, not in-tune, even with non-null liveCents', () => {
    const { container } = render(
      <DrillMeter
        liveCents={10}
        inTune={false}
        targetLetter="C"
        isRunning={false}
      />,
    );
    const g = dotGroup(container);
    expect(g.classList.contains('is-in-tune')).toBe(false);
    expect(transformX(g)).toBeCloseTo(CENTER_X, 5);
  });
});

// ── Echo trail (normal motion) ───────────────────────────────────────────────

describe('echo trail — normal motion (AC6)', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query !== '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('AC6 — after two renders with different liveCents, active [data-echo="true"] nodes appear', () => {
    const { container, rerender } = render(
      <DrillMeter liveCents={-10} inTune={false} targetLetter="D" isRunning={true} />,
    );

    // First render populates the trail buffer; the useEffect runs after commit.
    act(() => {
      // flush effects from first render
    });

    // Second render: prior value from first render → at least one echo node active.
    act(() => {
      rerender(
        <DrillMeter liveCents={-5} inTune={false} targetLetter="D" isRunning={true} />,
      );
    });

    const echoAfterTwo = container.querySelectorAll('[data-echo="true"]');
    expect(echoAfterTwo.length).toBeGreaterThanOrEqual(1);

    // Third render: two prior values → at least two echo nodes active.
    act(() => {
      rerender(
        <DrillMeter liveCents={0} inTune={true} targetLetter="D" isRunning={true} />,
      );
    });

    const echoAfterThree = container.querySelectorAll('[data-echo="true"]');
    expect(echoAfterThree.length).toBeGreaterThanOrEqual(2);
  });

  it('AC6 — opacity decreases from most-recent to oldest echo node', () => {
    const { container, rerender } = render(
      <DrillMeter liveCents={-15} inTune={false} targetLetter="A" isRunning={true} />,
    );

    act(() => {
      rerender(
        <DrillMeter liveCents={-10} inTune={false} targetLetter="A" isRunning={true} />,
      );
    });

    act(() => {
      rerender(
        <DrillMeter liveCents={-5} inTune={false} targetLetter="A" isRunning={true} />,
      );
    });

    act(() => {
      rerender(
        <DrillMeter liveCents={0} inTune={false} targetLetter="A" isRunning={true} />,
      );
    });

    const echoNodes = container.querySelectorAll<SVGCircleElement>('[data-echo="true"]');
    // Collect opacities from the active nodes.
    const opacities = Array.from(echoNodes).map((n) =>
      Number(n.getAttribute('opacity') ?? '1'),
    );

    // Need at least 2 active nodes to assert a decreasing sequence.
    expect(opacities.length).toBeGreaterThanOrEqual(2);

    // Each subsequent ghost must have lower or equal opacity (most-recent > oldest).
    for (let i = 0; i < opacities.length - 1; i++) {
      expect(opacities[i]).toBeGreaterThanOrEqual(opacities[i + 1] ?? 0);
    }
  });
});

// ── Echo trail — reduced-motion ──────────────────────────────────────────────

describe('echo trail — reduced-motion guard (AC7 / AC10)', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('AC7 — under prefers-reduced-motion: reduce, no [data-echo="true"] nodes are emitted', () => {
    const { container, rerender } = render(
      <DrillMeter liveCents={-10} inTune={false} targetLetter="D" isRunning={true} />,
    );

    act(() => {
      rerender(
        <DrillMeter liveCents={-5} inTune={false} targetLetter="D" isRunning={true} />,
      );
    });

    act(() => {
      rerender(
        <DrillMeter liveCents={0} inTune={true} targetLetter="D" isRunning={true} />,
      );
    });

    // Under reduced-motion the useEffect skips populating echo nodes.
    const echoNodes = container.querySelectorAll('[data-echo="true"]');
    expect(echoNodes.length).toBe(0);
  });
});

// ── No red (§17.7 / §2.6) ───────────────────────────────────────────────────

describe('no red anywhere (§17.7 / §2.6)', () => {
  it('AC8 — rendered markup has no {danger}/red/#e5644e; includes ♭ and ♯ direction words', () => {
    const { container } = render(
      <DrillMeter liveCents={-30} inTune={false} targetLetter="G" isRunning={true} />,
    );
    const html = container.innerHTML.toLowerCase();

    // Direction is backed by language (§17.7 / §11.1).
    expect(container.textContent).toContain('flat ♭');
    expect(container.textContent).toContain('sharp ♯');

    // No red literal (the only pitch colours are mint + grey).
    expect(html).not.toContain('#e5644e'); // red-500 reserved literal
    expect(html).not.toContain('danger');
    expect(html).not.toContain('red');
  });
});
