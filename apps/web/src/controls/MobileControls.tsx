// MobileControls — the §10/§16 mobile (<760px) controls surface: a one-tap SUMMARY
// BAR that opens a NON-MODAL bottom sheet (peek→expand) hosting the same controls
// the desktop card carries, plus the View row. DESIGN.md §10/§16/§9.1 win on any
// conflict (AGENTS.md).
//
// Why a separate surface (not a responsive variant of the desktop card): on a phone
// the three-row card is too tall to sit above the map, so §10 collapses it to a
// summary bar (scale name + active refs) that expands a bottom sheet on demand. The
// sheet holds the SAME widgets as the desktop card — RootRow (presented as a 4×3
// grid in the sheet, U5 CSS; still ONE `role="radiogroup"`, no new a11y), ScaleRow,
// RefsRow (its §12.3 vertical-lock preserved, #80 unchanged) — then the View row
// (orientation/density/handedness toggles) that the desktop card does not yet carry
// (the desktop View row is Phase 4).
//
// Open/close reuses `useDrawer` (open/close/toggle + Esc + focus-return via
// panelRef) — NO focus trap and NO body-scroll-lock: the sheet is NON-MODAL, so it
// has no `role="dialog"` / `aria-modal`, no full overlay scrim, and the page behind
// it stays scrollable. Dismissal is the close button + Esc + tapping the handle.
//
// Hide mechanism is PINNED to display:none (FINDINGS 3, 6): the WHOLE MobileControls
// subtree is `display:none` ≥760px (U6 CSS) so its radiogroups/checkboxes leave the
// a11y tree at desktop (the strict desktop e2e counts hold). The sheet's scrollable
// CONTENT region is ALSO `display:none` while closed/peek — applied INLINE here so
// (a) the closed sheet's pills are out of the tab order + a11y tree, and (b) the
// jsdom unit (which applies no CSS media queries) still sees the rows appear only
// after expand. `data-open` on the sheet drives the U6 CSS translateY transform.

import { type Orientation } from '../notemap/mapView.ts';
import { type MapViewApi } from '../notemap/useMapView.ts';
import { useDrawer } from '../shell/useDrawer.ts';
import { type ControlsApi } from '../state/useControls.ts';

import './controls.css';
import { RefsRow } from './RefsRow.tsx';
import { RootRow } from './RootRow.tsx';
import { ScaleRow } from './ScaleRow.tsx';
import { ViewRow } from './ViewRow.tsx';

// The DOM id the summary bar's `aria-controls` points at and the sheet carries, so
// AT (and the unit) can tie the trigger to its expandable region.
const SHEET_ID = 'mobile-controls-sheet';

interface MobileControlsProps {
  /** The shared controls api — the sheet's Root/Scale/Refs rows read+write it. */
  controls: ControlsApi;
  /** The whole map-view api — the sheet's View row reads the stored modes + setters. */
  mapView: MapViewApi;
  /**
   * The resolved render orientation (§12.1) — forwarded to RefsRow so the §12.3
   * vertical-lock (#80) is preserved on the mobile map exactly as on the desktop
   * card (Refs disabled while vertical until the U3b projection lands).
   */
  orientation: Orientation;
  /**
   * The §10 summary-bar text — the scale name + active refs (e.g. "A Major · Tapes"),
   * computed in Content from the same `controls.state` AppShell's describeMap reads.
   * It is the summary bar's visible label AND its accessible name's leading content.
   */
  summaryText: string;
}

export function MobileControls({
  controls,
  mapView,
  orientation,
  summaryText,
}: MobileControlsProps) {
  const { state, selectRoot, selectScale, toggleRef } = controls;
  // Reuse the drawer lifecycle for the sheet: open/close/toggle + Esc-to-close +
  // focus-return to the summary trigger (panelRef). No trap, no scroll-lock.
  const { isOpen, toggle, close, panelRef } = useDrawer();

  return (
    <div className="mobile-controls">
      {/* Summary bar — the one-tap trigger. Its accessible name leads with "Scale
          controls" then the live summary so AT announces what it opens AND the
          current selection; aria-expanded mirrors the sheet state; aria-controls
          ties it to the sheet region. The 44px hit target is U6 CSS. */}
      <button
        type="button"
        className="mc-summary"
        aria-expanded={isOpen}
        aria-controls={SHEET_ID}
        aria-label={`Scale controls: ${summaryText}`}
        onClick={toggle}
      >
        <span className="mc-summary-text">{summaryText}</span>
      </button>

      {/* The non-modal bottom sheet. NOT a dialog and carries no aria-modal — the
          page behind it stays live. panelRef receives focus on open (useDrawer) so
          the next Tab lands inside; it is tabIndex={-1} so it can hold focus.
          data-open drives the U6 translateY transform (peek↔expand). */}
      <section
        id={SHEET_ID}
        ref={panelRef}
        className="mc-sheet"
        data-open={isOpen}
        tabIndex={-1}
        aria-label="Scale controls"
      >
        {/* Drag handle — a tap target that also dismisses the sheet (the handle is
            part of the non-modal dismissal set: close button + Esc + handle). It is
            in the always-visible peek band, so it is OUTSIDE the display:none
            content region below. */}
        <button
          type="button"
          className="mc-handle"
          aria-label="Dismiss scale controls"
          onClick={close}
        />

        {/* The scrollable content region — display:none while closed/peek so the
            sheet's rows are out of the tab order + a11y tree until expanded
            (FINDINGS 3, 6). Inline style so jsdom (no CSS media queries) reflects
            it; the U6 transform is keyed off data-open on the sheet, separately. */}
        <div className="mc-sheet-body" style={{ display: isOpen ? undefined : 'none' }}>
          <button type="button" className="mc-close" onClick={close}>
            Close
          </button>

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

          <div className="ctrl-row">
            <div className="lab">View</div>
            <div className="ctrl-slot">
              <ViewRow mapView={mapView} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
