import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type MapViewApi } from '../notemap/useMapView.ts';

import { ViewRow } from './ViewRow.tsx';

// ViewRow — the §16 mobile-sheet View row: three labeled segmented controls
// (Orientation · Density · Handedness) wired to the useMapView setters. Tested IN
// ISOLATION (FINDING 3): rendered directly with a stub MapViewApi so there is no
// other surface to collide with (the desktop card / mobile sheet has its own
// radiogroups; mounting ViewRow alone keeps the role queries unambiguous in the
// no-CSS-hide jsdom environment).

// A complete MapViewApi stub with spied setters; the resolve fields default to the
// app's first-paint defaults (auto mode, auto density, right hand) and individual
// fields can be overridden per test to drive the active-segment highlight.
function stubMapView(overrides: Partial<MapViewApi> = {}): MapViewApi {
  return {
    mode: 'auto',
    orientation: 'vertical',
    density: 'auto',
    handedness: 'right',
    setOrientation: vi.fn(),
    setDensity: vi.fn(),
    setHandedness: vi.fn(),
    ...overrides,
  };
}

describe('ViewRow — three segmented radiogroups (§16)', () => {
  it('renders exactly three radiogroups: Orientation, Density, Handedness', () => {
    render(<ViewRow mapView={stubMapView()} />);
    const groups = screen.getAllByRole('radiogroup');
    expect(groups).toHaveLength(3);
    expect(screen.getByRole('radiogroup', { name: 'Orientation' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Density' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Handedness' })).toBeInTheDocument();
  });

  it('Orientation offers Auto / Vertical / Horizontal in order', () => {
    render(<ViewRow mapView={stubMapView()} />);
    const group = screen.getByRole('radiogroup', { name: 'Orientation' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Auto', 'Vertical', 'Horizontal']);
  });

  it('Density offers Auto / Fit / Comfort in order (tri-state, mirrors orientation)', () => {
    render(<ViewRow mapView={stubMapView()} />);
    const group = screen.getByRole('radiogroup', { name: 'Density' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Auto', 'Fit', 'Comfort']);
  });

  it('Handedness offers Right / Left in order', () => {
    render(<ViewRow mapView={stubMapView()} />);
    const group = screen.getByRole('radiogroup', { name: 'Handedness' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Right', 'Left']);
  });
});

describe('ViewRow — active segment tracks mapView state (aria-checked)', () => {
  it('highlights the Orientation segment matching mapView.mode (the STORED mode, not the resolved orientation)', () => {
    // mode='auto' is selected even though the RESOLVED orientation is 'vertical' —
    // the toggle reflects the user's choice (auto), not what auto resolved to.
    render(<ViewRow mapView={stubMapView({ mode: 'auto', orientation: 'vertical' })} />);
    const group = screen.getByRole('radiogroup', { name: 'Orientation' });
    expect(within(group).getByRole('radio', { name: 'Auto' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(
      within(group).getByRole('radio', { name: 'Vertical' }).getAttribute('aria-checked'),
    ).toBe('false');
    expect(
      within(group).getByRole('radio', { name: 'Horizontal' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('highlights the Density segment matching mapView.density (the STORED density mode)', () => {
    render(<ViewRow mapView={stubMapView({ density: 'fit' })} />);
    const group = screen.getByRole('radiogroup', { name: 'Density' });
    expect(within(group).getByRole('radio', { name: 'Fit' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(within(group).getByRole('radio', { name: 'Auto' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(
      within(group).getByRole('radio', { name: 'Comfort' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('highlights the Handedness segment matching mapView.handedness', () => {
    render(<ViewRow mapView={stubMapView({ handedness: 'left' })} />);
    const group = screen.getByRole('radiogroup', { name: 'Handedness' });
    expect(within(group).getByRole('radio', { name: 'Left' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(within(group).getByRole('radio', { name: 'Right' }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });
});

describe('ViewRow — roving tabindex + arrow-key selection-follows-focus (§9.1 / §11.3)', () => {
  // Each View radiogroup must implement the SAME keyboard contract the Root/Scale
  // rows do (useRovingRadiogroup): exactly one pill tabbable at a time (the
  // selected one), arrows move selection in the §9.1 left-to-right order with
  // selection-follows-focus, Tab exits. A plain Tab-stop-per-option radiogroup is
  // the ARIA anti-pattern §11.3 forbids — it tells AT "radio, N of M" but ignores
  // the arrow keys the user is then told to use.

  it('only the selected pill is tabbable (tabIndex 0); the rest are -1 (roving tabindex)', () => {
    render(<ViewRow mapView={stubMapView({ mode: 'auto' })} />);
    const group = screen.getByRole('radiogroup', { name: 'Orientation' });
    const [auto, vertical, horizontal] = within(group).getAllByRole('radio');
    expect(auto?.getAttribute('tabindex')).toBe('0');
    expect(vertical?.getAttribute('tabindex')).toBe('-1');
    expect(horizontal?.getAttribute('tabindex')).toBe('-1');
  });

  it("ArrowRight on the selected Orientation pill selects the next option (calls setOrientation('vertical'))", () => {
    const mapView = stubMapView({ mode: 'auto' });
    render(<ViewRow mapView={mapView} />);
    const group = screen.getByRole('radiogroup', { name: 'Orientation' });
    fireEvent.keyDown(within(group).getByRole('radio', { name: 'Auto' }), { key: 'ArrowRight' });
    expect(mapView.setOrientation).toHaveBeenCalledTimes(1);
    expect(mapView.setOrientation).toHaveBeenCalledWith('vertical');
  });

  it("ArrowLeft on the selected Density pill selects the previous option (calls setDensity('auto'))", () => {
    const mapView = stubMapView({ density: 'fit' });
    render(<ViewRow mapView={mapView} />);
    const group = screen.getByRole('radiogroup', { name: 'Density' });
    fireEvent.keyDown(within(group).getByRole('radio', { name: 'Fit' }), { key: 'ArrowLeft' });
    expect(mapView.setDensity).toHaveBeenCalledTimes(1);
    expect(mapView.setDensity).toHaveBeenCalledWith('auto');
  });

  it("ArrowLeft on the first Orientation pill clamps (re-selects 'auto', never wraps to 'horizontal')", () => {
    // Matches the Root/Scale clamp semantics in useRovingRadiogroup: at index 0 the
    // move is Math.max(current-1, 0) = 0, so it re-selects the boundary value and
    // never wraps around to the last option.
    const mapView = stubMapView({ mode: 'auto' });
    render(<ViewRow mapView={mapView} />);
    const group = screen.getByRole('radiogroup', { name: 'Orientation' });
    fireEvent.keyDown(within(group).getByRole('radio', { name: 'Auto' }), { key: 'ArrowLeft' });
    expect(mapView.setOrientation).toHaveBeenCalledTimes(1);
    expect(mapView.setOrientation).toHaveBeenCalledWith('auto');
  });

  it("Home/End jump to the ends of the Density group (calls setDensity('auto'/'comfort'))", () => {
    const mapView = stubMapView({ density: 'fit' });
    render(<ViewRow mapView={mapView} />);
    const group = screen.getByRole('radiogroup', { name: 'Density' });
    fireEvent.keyDown(within(group).getByRole('radio', { name: 'Fit' }), { key: 'End' });
    expect(mapView.setDensity).toHaveBeenLastCalledWith('comfort');
    fireEvent.keyDown(within(group).getByRole('radio', { name: 'Fit' }), { key: 'Home' });
    expect(mapView.setDensity).toHaveBeenLastCalledWith('auto');
  });
});

describe('ViewRow — clicking a segment calls the matching useMapView setter', () => {
  it("clicking 'Horizontal' calls setOrientation('horizontal')", () => {
    const mapView = stubMapView();
    render(<ViewRow mapView={mapView} />);
    const group = screen.getByRole('radiogroup', { name: 'Orientation' });
    fireEvent.click(within(group).getByRole('radio', { name: 'Horizontal' }));
    expect(mapView.setOrientation).toHaveBeenCalledTimes(1);
    expect(mapView.setOrientation).toHaveBeenCalledWith('horizontal');
  });

  it("clicking 'Fit' calls setDensity('fit')", () => {
    const mapView = stubMapView();
    render(<ViewRow mapView={mapView} />);
    const group = screen.getByRole('radiogroup', { name: 'Density' });
    fireEvent.click(within(group).getByRole('radio', { name: 'Fit' }));
    expect(mapView.setDensity).toHaveBeenCalledTimes(1);
    expect(mapView.setDensity).toHaveBeenCalledWith('fit');
  });

  it("clicking 'Left' calls setHandedness('left')", () => {
    const mapView = stubMapView();
    render(<ViewRow mapView={mapView} />);
    const group = screen.getByRole('radiogroup', { name: 'Handedness' });
    fireEvent.click(within(group).getByRole('radio', { name: 'Left' }));
    expect(mapView.setHandedness).toHaveBeenCalledTimes(1);
    expect(mapView.setHandedness).toHaveBeenCalledWith('left');
  });
});
