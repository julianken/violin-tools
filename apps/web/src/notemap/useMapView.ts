// React binding over the pure mapView policy. Holds the persisted MapView and
// exposes the RESOLVED orientation by combining the user's mode with the live
// viewport aspect. An explicit choice is persisted and wins over the viewport;
// 'auto' follows rotation. Resolution runs during the initial render (lazy
// useState initializer + a synchronous matchMedia read), so the first paint
// already carries the correct orientation — no flash.

import { useState } from 'react';

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

  // Commit a new view: update state AND persist, both outside the state updater
  // (a state updater must stay pure — StrictMode double-invokes it). `view` is in
  // scope, so exhaustive-deps is satisfied with no memoization to manage.
  const commit = (next: MapView): void => {
    setView(next);
    storeMapView(next);
  };

  return {
    mode: view.orientation,
    orientation: resolveOrientation(view.orientation, isLandscape),
    density: view.density,
    handedness: view.handedness,
    setOrientation: (orientation) => { commit({ ...view, orientation }); },
    setDensity: (density) => { commit({ ...view, density }); },
    setHandedness: (handedness) => { commit({ ...view, handedness }); },
  };
}
