// The note-map VIEW model — how the map is displayed, distinct from WHAT it shows
// (controls.ts owns root/scale/refs). DESIGN.md §10/§12 win on any conflict.
//
// Pure policy only: no React, no geometry. `resolveOrientation` turns the user's
// mode ('auto' | explicit) + the current viewport aspect into a concrete
// orientation; the React binding (matchMedia, first paint) lives in useMapView.ts.

export type Orientation = 'vertical' | 'horizontal';
export type OrientationMode = 'auto' | Orientation;
export type Handedness = 'right' | 'left';
export type Density = 'fit' | 'comfort';

export interface MapView {
  orientation: OrientationMode;
  density: Density;
  handedness: Handedness;
}

export const DEFAULT_MAP_VIEW: MapView = {
  orientation: 'auto',
  density: 'comfort',
  handedness: 'right',
};

export function resolveOrientation(mode: OrientationMode, isLandscape: boolean): Orientation {
  if (mode === 'auto') return isLandscape ? 'horizontal' : 'vertical';
  return mode;
}

export const MAP_VIEW_KEY = 'vt:notemap-view';

const ORIENTATIONS: readonly OrientationMode[] = ['auto', 'vertical', 'horizontal'];
const DENSITIES: readonly Density[] = ['fit', 'comfort'];
const HANDEDNESS: readonly Handedness[] = ['right', 'left'];

function pick<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function loadMapView(): MapView {
  let raw: string | null;
  try {
    raw = localStorage.getItem(MAP_VIEW_KEY);
  } catch {
    return DEFAULT_MAP_VIEW;
  }
  if (raw === null) return DEFAULT_MAP_VIEW;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_MAP_VIEW;
  }
  const obj = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>;
  return {
    orientation: pick(ORIENTATIONS, obj['orientation'], DEFAULT_MAP_VIEW.orientation),
    density: pick(DENSITIES, obj['density'], DEFAULT_MAP_VIEW.density),
    handedness: pick(HANDEDNESS, obj['handedness'], DEFAULT_MAP_VIEW.handedness),
  };
}

export function storeMapView(view: MapView): void {
  try {
    localStorage.setItem(MAP_VIEW_KEY, JSON.stringify(view));
  } catch {
    // ignore — persistence is a nicety, never load-bearing
  }
}
