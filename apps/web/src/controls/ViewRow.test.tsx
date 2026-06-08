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
