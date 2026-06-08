import { describe, expect, it, beforeEach } from 'vitest';

import {
  DEFAULT_MAP_VIEW,
  resolveOrientation,
  resolveDensity,
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

describe('resolveDensity (explicit wins, auto derives from orientation)', () => {
  it('an explicit density is returned verbatim, ignoring orientation', () => {
    expect(resolveDensity('fit', 'vertical')).toBe('fit');
    expect(resolveDensity('comfort', 'horizontal')).toBe('comfort');
  });
  it("'auto' derives from the resolved orientation: horizontal → fit, vertical → comfort", () => {
    expect(resolveDensity('auto', 'horizontal')).toBe('fit');
    expect(resolveDensity('auto', 'vertical')).toBe('comfort');
  });
});

describe('DEFAULT_MAP_VIEW', () => {
  it('defaults to auto / auto / right', () => {
    const v: MapView = DEFAULT_MAP_VIEW;
    expect(v).toEqual({ orientation: 'auto', density: 'auto', handedness: 'right' });
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
  it("accepts each stored density mode ('fit' | 'comfort' | 'auto')", () => {
    for (const density of ['fit', 'comfort', 'auto'] as const) {
      storeMapView({ orientation: 'horizontal', density, handedness: 'right' });
      expect(loadMapView().density).toBe(density);
    }
  });
  it('falls back to defaults on a corrupt value', () => {
    localStorage.setItem(MAP_VIEW_KEY, '{not json');
    expect(loadMapView()).toEqual(DEFAULT_MAP_VIEW);
  });
  it("ignores unknown fields and falls a garbage density back to 'auto'", () => {
    localStorage.setItem(MAP_VIEW_KEY, JSON.stringify({ orientation: 'vertical', density: 'bogus', handedness: 'left', x: 1 }));
    expect(loadMapView()).toEqual({ orientation: 'vertical', density: 'auto', handedness: 'left' });
  });
});
