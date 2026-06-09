import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TunerMeter } from './TunerMeter.tsx';
import { centsToX } from './meter-geometry.ts';

// TunerMeter unit tests (DESIGN.md §17.2). DESIGN.md §17 wins on any conflict
// (AGENTS.md). The meter is PRESENTATIONAL — props-driven, no audio — so every
// §17.2 behaviour is verifiable in jsdom: the off→in-tune morph (the dot wrapper
// class + radius), the dot's x-position from cents, the in-dot label appearing
// ONLY in tune, and the no-red rule (the SVG names {mint} / neutral, never red).

/** The single dot group inside the meter SVG. */
function dotGroup(container: HTMLElement): SVGGElement {
  const g = container.querySelector<SVGGElement>('.tuner-dot-g');
  if (g === null) throw new Error('no dot group');
  return g;
}

describe('centsToX — the dot x-position is the live cents (§17.2)', () => {
  it('maps 0¢ to the axis center and is symmetric about it', () => {
    const center = centsToX(0);
    expect(centsToX(-25) + centsToX(25)).toBeCloseTo(center * 2, 5);
  });

  it('a sharp reading sits right of center, a flat reading left (§17.2)', () => {
    const center = centsToX(0);
    expect(centsToX(20)).toBeGreaterThan(center); // sharp → right
    expect(centsToX(-20)).toBeLessThan(center); // flat → left
  });

  it('clamps a wild reading to the ±50¢ edge (never flies off-meter)', () => {
    expect(centsToX(200)).toBe(centsToX(50));
    expect(centsToX(-200)).toBe(centsToX(-50));
  });
});

describe('off / seeking state (|cents| > 5) — the §12.2 in-scale dot', () => {
  it('is NOT in tune, carries no in-dot label, and parks the dot off-center', () => {
    const { container } = render(
      <TunerMeter cents={-22} inTune={false} note="A" octave={4} nearestString="A4" hasSignal />,
    );
    const g = dotGroup(container);
    // Wrapper is NOT in tune (the morph stays at the in-scale dot).
    expect(g.classList.contains('is-in-tune')).toBe(false);
    expect(g.getAttribute('data-in-tune')).toBe('false');
    // No note name inside the dot while seeking (§17.2).
    expect(container.querySelector('.tuner-dot-lbl')?.textContent).toBe('');
    // The dot is off-center (flat → left of the center column).
    const transform = g.getAttribute('transform') ?? '';
    const x = Number(/translate\(([-\d.]+)/.exec(transform)?.[1]);
    expect(x).toBeLessThan(centsToX(0));
  });
});

describe('in-tune state (|cents| ≤ 5) — the §12.2 root dot + in-dot label', () => {
  it('flips the wrapper to in-tune and shows the note name INSIDE in the dot (§17.2)', () => {
    const { container } = render(
      <TunerMeter cents={2} inTune note="A" octave={4} nearestString="A4" hasSignal />,
    );
    const g = dotGroup(container);
    expect(g.classList.contains('is-in-tune')).toBe(true);
    expect(g.getAttribute('data-in-tune')).toBe('true');
    // The note name is shown inside the dot ONLY in tune (the root-dot label, §17.2).
    expect(container.querySelector('.tuner-dot-lbl')?.textContent).toBe('A');
  });

  it('the in-tune dot has the larger root radius and the glow ring is present', () => {
    const { container } = render(
      <TunerMeter cents={0} inTune note="D" octave={4} nearestString="D4" hasSignal />,
    );
    const dot = container.querySelector('.tuner-dot');
    const glow = container.querySelector('.tuner-glow');
    // r=15 root dot (§12.2 / §17.2), bigger than the seeking r≈14.
    expect(dot?.getAttribute('r')).toBe('15');
    expect(glow).not.toBeNull();
  });
});

describe('no signal — never a false in-tune (§17.7)', () => {
  it('parks the dot at center and reads NOT in tune even if inTune prop is true', () => {
    const { container } = render(
      <TunerMeter cents={0} inTune note="A" octave={4} nearestString={null} hasSignal={false} />,
    );
    const g = dotGroup(container);
    // A silent meter is never green (§17.7) — a centered green dot with no sound
    // would be a false positive.
    expect(g.classList.contains('is-in-tune')).toBe(false);
    expect(container.querySelector('.tuner-dot-lbl')?.textContent).toBe('');
  });
});

describe('no red anywhere (§17.7 / §2.6)', () => {
  it('the meter markup references no red token / red hex and uses the ♯/♭ words', () => {
    const { container } = render(
      <TunerMeter cents={-30} inTune={false} note="G" octave={3} nearestString="G3" hasSignal />,
    );
    const html = container.innerHTML.toLowerCase();
    // Direction is backed by the ♯/♭ words (language, not hue) — §17.7 / §11.1.
    expect(container.textContent).toContain('flat ♭');
    expect(container.textContent).toContain('sharp ♯');
    // The component names no red literal (the only pitch colours are mint + grey).
    expect(html).not.toContain('#e5644e'); // red-500 reserved literal
    expect(html).not.toContain('danger');
    expect(html).not.toContain('red');
  });
});
