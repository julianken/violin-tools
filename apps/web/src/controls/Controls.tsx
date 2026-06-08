// Controls — the §9.1 controls card: the three labeled rows (Root · Scale · Refs)
// wired to the single app state. DESIGN.md §9.1 / §11.3 / §8.1 win on any
// conflict (AGENTS.md).
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
   * The whole map-view api (§16) — used ONLY by the mobile sheet's View row (U4).
   * The desktop three-row card render below is unchanged and does NOT consume it;
   * it is threaded through so U4 can mount <ViewRow mapView={…}> inside the sheet.
   * Optional so the desktop-card unit harness (which renders Controls directly with
   * no mapView) keeps its byte-identical two-radiogroup card.
   */
  mapView?: MapViewApi;
}

export function Controls({
  state,
  selectRoot,
  selectScale,
  toggleRef,
  orientation = 'horizontal',
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
    </section>
  );
}
