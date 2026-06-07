// React binding over the pure mapView policy. Holds the persisted MapView and
// exposes the RESOLVED orientation by combining the user's mode with the live
// viewport aspect. An explicit choice is persisted and wins over the viewport;
// 'auto' follows rotation. Resolution runs during the initial render (lazy
// useState initializer + a synchronous matchMedia read), so the first paint
// already carries the correct orientation — no flash.

import { useCallback, useState } from 'react';

import {
  loadMapView,
  resolveOrientation,
  storeMapView,
  type Density,
  type Handedness,
  type MapView,
  type Orientation,
  type OrientationMode,
} from './mapView';
import { useIsLandscape } from './useIsLandscape';

export interface MapViewApi {
  mode: OrientationMode;
  orientation: Orientation;
  density: Density;
  handedness: Handedness;
  setOrientation: (mode: OrientationMode) => void;
  setDensity: (density: Density) => void;
  setHandedness: (handedness: Handedness) => void;
}

export function useMapView(): MapViewApi {
  const [view, setView] = useState<MapView>(() => loadMapView());
  const isLandscape = useIsLandscape();

  // Use the functional-update form so the callback never closes over `view`,
  // keeping the exhaustive-deps dep array correct (no stale-closure risk).
  const update = useCallback((updater: (prev: MapView) => MapView) => {
    setView((prev) => {
      const next = updater(prev);
      storeMapView(next);
      return next;
    });
  }, []);

  return {
    mode: view.orientation,
    orientation: resolveOrientation(view.orientation, isLandscape),
    density: view.density,
    handedness: view.handedness,
    setOrientation: (orientation) => { update((prev) => ({ ...prev, orientation })); },
    setDensity: (density) => { update((prev) => ({ ...prev, density })); },
    setHandedness: (handedness) => { update((prev) => ({ ...prev, handedness })); },
  };
}
