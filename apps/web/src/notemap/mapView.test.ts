import { describe, expect, it, beforeEach } from 'vitest';

import {
  DEFAULT_MAP_VIEW,
  resolveOrientation,
  loadMapView,
  storeMapView,
  MAP_VIEW_KEY,
  type MapView,
} from './mapView';

describe('resolveOrientation (rotation-aware auto)', () => {
  it("'auto' follows the viewport: portrait → vertical, landscape → horizontal", () => {
    expect(resolveOrientation('auto', false)).toBe('vertical');
    expect(resolveOrientation('auto', true)).toBe('horizontal');
  });
  it('an explicit choice ignores the viewport', () => {
    expect(resolveOrientation('vertical', true)).toBe('vertical');
    expect(resolveOrientation('horizontal', false)).toBe('horizontal');
  });
});

describe('DEFAULT_MAP_VIEW', () => {
  it('defaults to auto / comfort / right', () => {
    const v: MapView = DEFAULT_MAP_VIEW;
    expect(v).toEqual({ orientation: 'auto', density: 'comfort', handedness: 'right' });
  });
});

describe('persistence (explicit choices only)', () => {
  beforeEach(() => { localStorage.clear(); });
  it('returns the defaults when nothing is stored', () => {
    expect(loadMapView()).toEqual(DEFAULT_MAP_VIEW);
  });
  it('round-trips a stored view', () => {
    storeMapView({ orientation: 'horizontal', density: 'fit', handedness: 'left' });
    expect(loadMapView()).toEqual({ orientation: 'horizontal', density: 'fit', handedness: 'left' });
  });
  it('falls back to defaults on a corrupt value', () => {
    localStorage.setItem(MAP_VIEW_KEY, '{not json');
    expect(loadMapView()).toEqual(DEFAULT_MAP_VIEW);
  });
  it('ignores unknown fields and keeps valid ones', () => {
    localStorage.setItem(MAP_VIEW_KEY, JSON.stringify({ orientation: 'vertical', density: 'bogus', handedness: 'left', x: 1 }));
    expect(loadMapView()).toEqual({ orientation: 'vertical', density: 'comfort', handedness: 'left' });
  });
});
