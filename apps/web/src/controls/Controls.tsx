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

import { type ControlsApi } from '../state/useControls.ts';

import './controls.css';
import { RefsRow } from './RefsRow.tsx';
import { RootRow } from './RootRow.tsx';
import { ScaleRow } from './ScaleRow.tsx';

type ControlsProps = ControlsApi;

export function Controls({
  state,
  selectRoot,
  selectScale,
  toggleRef,
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
          <RefsRow refs={state.refs} onToggle={toggleRef} />
        </div>
      </div>
    </section>
  );
}
