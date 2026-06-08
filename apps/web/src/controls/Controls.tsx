// Controls — the §9.1 controls card: the labeled rows (Root · Scale · Refs, plus
// the View row when a mapView is threaded, S16 ph4) wired to the single app state.
// DESIGN.md §9.1 / §11.3 / §8.1 win on any conflict (AGENTS.md).
//
// The card is the user's only way (in v1) to drive the note map: each row writes
// the one `(root, scale, refs)` state, and the map re-derives + re-renders from
// it. Root and Scale are single-select radiogroups with a static active highlight;
// Refs is a `group` of independent checkboxes with the §9.1 dim logic. The row
// frame (`.controls` card, `.ctrl-row`, `.lab`) is the S3 shell structure;
// controls.css styles the pills/highlight that mount into each `.ctrl-slot`.

import { type Orientation } from '../notemap/mapView.ts';
import { type MapViewApi } from '../notemap/useMapView.ts';
import { type ControlsApi } from '../state/useControls.ts';

import './controls.css';
import { RefsRow } from './RefsRow.tsx';
import { RootRow } from './RootRow.tsx';
import { ScaleRow } from './ScaleRow.tsx';
import { ViewRow } from './ViewRow.tsx';

interface ControlsProps extends ControlsApi {
  /**
   * The resolved render orientation (§12.1) — forwarded to the Refs row. While
   * `'vertical'` the Refs overlays are still horizontal-axis-only (the §12.3 band
   * geometry isn't projected through `axisOf` yet — the tracked U3b follow-up), so
   * RefsRow disables the Refs pills to keep a mis-projected band unreachable.
   * Defaults to `'horizontal'` so an orientation-absent render keeps today's pills.
   */
  orientation?: Orientation;
  /**
   * The whole map-view api (§16) — when present, the desktop card NOW renders
   * <ViewRow mapView={…}> as a 4th row (Orientation/Density/Handedness), the same
   * shared component the mobile sheet uses (S16 ph4). Optional so the desktop-card
   * unit harness (which renders Controls directly with no mapView, the unit path)
   * keeps a byte-identical two-radiogroup card and never reads `mapView.mode` on
   * `undefined`.
   */
  mapView?: MapViewApi;
}

export function Controls({
  state,
  selectRoot,
  selectScale,
  toggleRef,
  orientation = 'horizontal',
  mapView,
}: ControlsProps) {
  return (
    <section className="controls" aria-label="Scale controls">
      <div className="ctrl-row">
        <div className="lab">Root</div>
        <div className="ctrl-slot">
          <RootRow selected={state.root} scale={state.scale} onSelect={selectRoot} />
        </div>
      </div>

      <div className="ctrl-row">
        <div className="lab">Scale</div>
        <div className="ctrl-slot">
          <ScaleRow selected={state.scale} onSelect={selectScale} />
        </div>
      </div>

      <div className="ctrl-row">
        <div className="lab">Refs</div>
        <div className="ctrl-slot">
          <RefsRow refs={state.refs} onToggle={toggleRef} orientation={orientation} />
        </div>
      </div>

      {/* The View row (§16) — byte-identical to the mobile sheet's View row
          (MobileControls.tsx). Rendered only when `mapView` is threaded, mirroring
          Content's conditional spread: the mapView-absent unit harness keeps a
          2-radiogroup card and never reads `mapView.mode` on `undefined`. */}
      {mapView !== undefined && (
        <div className="ctrl-row">
          <div className="lab">View</div>
          <div className="ctrl-slot">
            <ViewRow mapView={mapView} />
          </div>
        </div>
      )}
    </section>
  );
}
