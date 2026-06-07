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
});
