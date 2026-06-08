import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MAP_VIEW_KEY } from '../notemap/mapView.ts';

import { AppShell } from './AppShell.tsx';

// S16 Phase 3 (U2) — AppShell now routes the STORED map density through the U1
// `resolveDensity(mode, orientation)` policy instead of the dead Phase-2
// line-46 override (`orientation === 'horizontal' ? 'fit' : 'comfort'`), so an
// explicit `setDensity` reaches the render while AUTO still derives from the
// resolved orientation. These tests render the WHOLE shell tree.
//
// jsdom has no `matchMedia`, so `useIsLandscape()` reads false and the resolved
// orientation is 'vertical' (the mobile/portrait default). The default state
// has density mode 'auto', which resolves (vertical → 'comfort') to the
// byte-identical default render — the §12.1 invariant this unit must not move.
//
// Per FINDING 3 (jsdom applies no CSS, so a future U3/U4 desktop card AND the
// MobileControls subtree both mount), these assertions stay on the BOARD
// (`data-orientation` / `viewBox`), never on radiogroup/checkbox COUNTS.

function board(): SVGSVGElement {
  const el = document.getElementById('board');
  if (el === null) throw new Error('no board');
  return el as unknown as SVGSVGElement;
}

afterEach(() => {
  localStorage.clear();
});

describe('AppShell map-density wiring (U2)', () => {
  it('default state renders the byte-identical vertical+comfort board (no stored mapView)', () => {
    render(<AppShell />);
    const svg = board();
    // jsdom → no matchMedia → vertical; density 'auto' → vertical → 'comfort'.
    expect(svg.getAttribute('data-orientation')).toBe('vertical');
    expect(svg.getAttribute('viewBox')).toBe('0 0 352 850');
  });

  it('an explicit stored density wins — resolveDensity is wired, not the orientation derive', () => {
    // The OLD line-46 override ignored the stored density and derived 'comfort'
    // from the vertical orientation (→ '0 0 352 850'). resolveDensity returns an
    // explicit choice verbatim, so a stored 'fit' must reach the board as the
    // vertical+fit viewBox '0 0 352 704'.
    localStorage.setItem(
      MAP_VIEW_KEY,
      JSON.stringify({ orientation: 'auto', density: 'fit', handedness: 'right' }),
    );
    render(<AppShell />);
    const svg = board();
    expect(svg.getAttribute('data-orientation')).toBe('vertical');
    expect(svg.getAttribute('viewBox')).toBe('0 0 352 704');
  });
});
