import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAP_VIEW_KEY } from './mapView';
import { useMapView } from './useMapView';

function installMatchMedia(initialLandscape: boolean) {
  let landscape = initialLandscape;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    get matches() { return landscape; },
    media: '(orientation: landscape)',
    addEventListener: (_t: string, cb: (e: MediaQueryListEvent) => void) => { listeners.add(cb); },
    removeEventListener: (_t: string, cb: (e: MediaQueryListEvent) => void) => { listeners.delete(cb); },
    dispatchEvent: () => true,
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    setLandscape(next: boolean) {
      landscape = next;
      listeners.forEach((cb) => { cb({ matches: next } as MediaQueryListEvent); });
    },
  };
}

describe('useMapView', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('auto resolves to vertical in portrait on first render (no flash)', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useMapView());
    expect(result.current.orientation).toBe('vertical');
    expect(result.current.mode).toBe('auto');
  });

  it('auto re-resolves when the device rotates to landscape', () => {
    const mm = installMatchMedia(false);
    const { result } = renderHook(() => useMapView());
    expect(result.current.orientation).toBe('vertical');
    act(() => { mm.setLandscape(true); });
    expect(result.current.orientation).toBe('horizontal');
  });

  it('an explicit choice sticks across a rotation and persists', () => {
    const mm = installMatchMedia(false);
    const { result } = renderHook(() => useMapView());
    act(() => { result.current.setOrientation('horizontal'); });
    expect(result.current.orientation).toBe('horizontal');
    act(() => { mm.setLandscape(false); });
    expect(result.current.orientation).toBe('horizontal');
    const stored = localStorage.getItem(MAP_VIEW_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).orientation).toBe('horizontal');
  });

  it('setting orientation back to auto resumes following the viewport', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useMapView());
    act(() => { result.current.setOrientation('vertical'); });
    expect(result.current.orientation).toBe('vertical');
    act(() => { result.current.setOrientation('auto'); });
    expect(result.current.orientation).toBe('horizontal');
  });

  it('setDensity reflects in state AND persists to localStorage', () => {
    // setDensity is one of the two setters in the 66.7%-funcs gap (no test touched
    // it). The default density is 'auto'; setting 'fit' must update the exposed
    // value and write the whole MapView through storeMapView.
    installMatchMedia(false);
    const { result } = renderHook(() => useMapView());
    expect(result.current.density).toBe('auto');
    act(() => { result.current.setDensity('fit'); });
    expect(result.current.density).toBe('fit');
    const stored = localStorage.getItem(MAP_VIEW_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).density).toBe('fit');
  });

  it('sequential setDensity then setHandedness BOTH persist (no stale-closure clobber)', () => {
    // The other gap setter, setHandedness, plus the stale-closure risk in commit():
    // each setter spreads `...view`, so two updates fired back-to-back through the
    // SAME render's `view` could clobber each other in storage. Driving them in
    // separate acts (each re-reads the latest `view`) must leave BOTH the new
    // density and the new handedness coexisting in the persisted MapView.
    installMatchMedia(false);
    const { result } = renderHook(() => useMapView());
    act(() => { result.current.setDensity('comfort'); });
    act(() => { result.current.setHandedness('left'); });
    expect(result.current.density).toBe('comfort');
    expect(result.current.handedness).toBe('left');
    const stored = localStorage.getItem(MAP_VIEW_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    // BOTH survive — the second write did not drop the first's density.
    expect(parsed.density).toBe('comfort');
    expect(parsed.handedness).toBe('left');
  });
});
