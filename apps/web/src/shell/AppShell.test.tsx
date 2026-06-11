import { fireEvent, render, screen } from '@testing-library/react';
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

// S16 Phase 3 (U7) — the mobile off-canvas drawer is dropped. AppShell no longer
// calls useDrawer, renders no `.drawer-scrim` backdrop, and the topbar carries no
// "Open navigation" hamburger (the search relocates to a mobile-only top-bar
// trigger instead). The sidebar search stays the desktop palette opener.
describe('AppShell drawer drop (U7)', () => {
  it('renders no drawer-scrim element', () => {
    const { container } = render(<AppShell />);
    expect(container.querySelector('.drawer-scrim')).toBeNull();
  });

  it('renders no "Open navigation" hamburger trigger', () => {
    render(<AppShell />);
    expect(
      screen.queryByRole('button', { name: /open navigation/i }),
    ).not.toBeInTheDocument();
  });
});

// §17.1 — AppShell threads the view seam into the topbar. On the note-map view the
// breadcrumb leads with "Scales /" and the "Share scale" button is present; after
// switching to the Tuner or Intonation (the sidebar nav items) the breadcrumb
// collapses to just the tool name and the Scales-only Share cluster is suppressed.
// This proves the shell wiring, not just the component.
describe('AppShell view-aware topbar (§17.1)', () => {
  it('note-map view: breadcrumb shows "Scales / <selection>" and the Share button exists', () => {
    render(<AppShell />);
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumb).toHaveTextContent('Scales');
    expect(crumb.querySelector('.crumb-sep')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Share scale' })).toBeInTheDocument();
  });

  it('Tuner view: breadcrumb collapses to "Tuner" and the Share button is gone', () => {
    render(<AppShell />);
    // Switch to the Tuner via the sidebar nav item (§17.1 live view).
    fireEvent.click(screen.getByRole('button', { name: 'Tuner' }));
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumb).toHaveTextContent('Tuner');
    expect(crumb).not.toHaveTextContent('Scales');
    expect(crumb.querySelector('.crumb-sep')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share scale' })).not.toBeInTheDocument();
  });

  it('Intonation view: breadcrumb collapses to "Intonation" and the Share button is gone', () => {
    render(<AppShell />);
    // Switch to the Intonation view via the sidebar nav item (C9 live view).
    fireEvent.click(screen.getByRole('button', { name: 'Intonation' }));
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumb).toHaveTextContent('Intonation');
    expect(crumb).not.toHaveTextContent('Scales');
    expect(crumb.querySelector('.crumb-sep')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share scale' })).not.toBeInTheDocument();
  });

  it('Intonation view: <main id="main"> is rendered and #board SVG is not', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Intonation' }));
    // The IntonationView renders <main id="main"> so the skip-link resolves.
    expect(document.getElementById('main')).not.toBeNull();
    // The scale-map SVG board is gone (only one surface fills .main at a time).
    expect(document.getElementById('board')).toBeNull();
  });
});
