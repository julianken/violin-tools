// The note-map VIEW model — how the map is displayed, distinct from WHAT it shows
// (controls.ts owns root/scale/refs). DESIGN.md §10/§12 win on any conflict.
//
// Pure policy only: no React, no geometry. `resolveOrientation` turns the user's
// mode ('auto' | explicit) + the current viewport aspect into a concrete
// orientation; the React binding (matchMedia, first paint) lives in useMapView.ts.

export type Orientation = 'vertical' | 'horizontal';
export type OrientationMode = 'auto' | Orientation;
export type Handedness = 'right' | 'left';
// `Density` is the STORED, mode-level type — what the user picks and what
// persists. 'auto' means "derive from the resolved orientation"; an explicit
// 'fit'/'comfort' persists and wins. `ResolvedDensity` is the RENDER type: the
// concrete value the geometry/render path consumes after `resolveDensity` has
// erased 'auto'. Re-typing every render consumer to `ResolvedDensity` makes
// passing an unresolved (possibly-'auto') `Density` into geometry a COMPILE
// error — the structural guard FINDING 1 asks for.
export type Density = 'auto' | 'fit' | 'comfort';
export type ResolvedDensity = 'fit' | 'comfort';

export interface MapView {
  orientation: OrientationMode;
  density: Density;
  handedness: Handedness;
}

export const DEFAULT_MAP_VIEW: MapView = {
  orientation: 'auto',
  density: 'auto',
  handedness: 'right',
};

export function resolveOrientation(mode: OrientationMode, isLandscape: boolean): Orientation {
  if (mode === 'auto') return isLandscape ? 'horizontal' : 'vertical';
  return mode;
}

// Resolve the stored density MODE to a concrete render density: an explicit
// choice is returned verbatim (it persists and wins); 'auto' derives from the
// resolved orientation — horizontal → 'fit' (the byte-identical §12.1 desktop
// neck), vertical → 'comfort' (the wider mobile neck). This is the policy the
// AppShell density override is replaced by (U2); the render path only ever sees
// a `ResolvedDensity`.
export function resolveDensity(mode: Density, orientation: Orientation): ResolvedDensity {
  if (mode !== 'auto') return mode;
  return orientation === 'horizontal' ? 'fit' : 'comfort';
}

export const MAP_VIEW_KEY = 'vt:notemap-view';

const ORIENTATIONS: readonly OrientationMode[] = ['auto', 'vertical', 'horizontal'];
const DENSITIES: readonly Density[] = ['auto', 'fit', 'comfort'];
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
