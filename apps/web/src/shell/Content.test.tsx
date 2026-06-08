import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { axisOf } from '../notemap/geometry.ts';
import { useControls } from '../state/useControls.ts';

import { Content } from './Content.tsx';

// S16 Phase 2 (U2) — the board <svg id="board"> viewBox is driven by the resolved
// layout, not a literal. Content owns the parent SVG; it now receives the resolved
// (orientation, handedness, density) and computes axisOf({...}).viewBox onto it,
// AND mirrors `orientation` onto `data-orientation` so the CSS can drop the 760px
// min-width in the vertical case (the BLOCKER fix: shell.css
// `.board[data-orientation='vertical']{min-width:0}`).
//
// jsdom can't apply or compute CSS layout, so the min-width:0-in-vertical effect
// is STRUCTURAL-ONLY here — the test asserts the `data-orientation` attribute that
// drives that rule, not the rendered width. The real no-horizontal-overflow proof
// (scrollWidth<=clientWidth at 320px / 390px) is the U7 Playwright e2e; this test
// is bound to that e2e for the pixel assertion.
//
// Until U4 wires AppShell to thread the resolved view config, U2's tests pass the
// three fields explicitly. U2 and U4 are one logical sequence.

function ContentHarness(props: {
  orientation: 'horizontal' | 'vertical';
  handedness: 'right' | 'left';
  density: 'fit' | 'comfort';
}) {
  // The real controls api (same hook AppShell uses) — the integration seam, not a
  // hand-rolled stub, so Content↔NoteMap receive a genuine controls value.
  const controls = useControls();
  return (
    <Content
      controls={controls}
      onSoundNote={vi.fn()}
      orientation={props.orientation}
      handedness={props.handedness}
      density={props.density}
    />
  );
}

function board(): SVGSVGElement {
  const el = document.getElementById('board');
  if (el === null) throw new Error('no board');
  return el as unknown as SVGSVGElement;
}

describe('§12.1 board viewBox driven by the resolved layout (U2)', () => {
  it('horizontal + fit reproduces the byte-identical desktop viewBox (post-U0)', () => {
    render(<ContentHarness orientation="horizontal" handedness="right" density="fit" />);
    const svg = board();
    // The shipped desktop literal — now genuinely emitted by axisOf after U0.
    expect(svg.getAttribute('viewBox')).toBe('0 0 760 264');
    expect(svg.getAttribute('viewBox')).toBe(
      axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' }).viewBox,
    );
    expect(svg.getAttribute('data-orientation')).toBe('horizontal');
  });

  it('vertical + comfort emits the taller-than-wide vertical viewBox', () => {
    render(<ContentHarness orientation="vertical" handedness="right" density="comfort" />);
    const svg = board();
    const layout = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    expect(svg.getAttribute('viewBox')).toBe('0 0 352 850');
    expect(svg.getAttribute('viewBox')).toBe(layout.viewBox);
    // The vertical neck is taller than it is wide (the whole point of the flip).
    expect(layout.viewBoxHeight).toBeGreaterThan(layout.viewBoxWidth);
    expect(svg.getAttribute('data-orientation')).toBe('vertical');
  });

  it('preserves the §11.3 aria contract in both orientations', () => {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      const { unmount } = render(
        <ContentHarness orientation={orientation} handedness="right" density="fit" />,
      );
      const svg = board();
      expect(svg.getAttribute('role')).toBe('group');
      expect(svg.getAttribute('aria-label')).toBe('Full fingerboard note map');
      unmount();
    }
  });
});
