// MobileControls — the §10/§16 mobile (<760px) controls surface: ONE bottom-anchored,
// NON-MODAL sheet whose PEEK state IS the summary. DESIGN.md §10/§16/§9.1 win on any
// conflict (AGENTS.md).
//
// Why one sheet (not a summary bar PLUS a sheet): on a phone the three-row desktop
// card is too tall to sit above the map, so §10 collapses it to a bottom sheet whose
// always-visible PEEK band IS the summary — a header row pinned at the bottom edge
// showing the drag-grip, the summary text (scale name + active refs), and an expand
// chevron. Activating that header expands the sheet UPWARD to reveal the body. There
// is NO separate in-flow summary bar (a third "A Major" under the H1 + breadcrumb was
// redundant and off-design); the peek header is the single trigger.
//
// The body holds the SAME widgets as the desktop card — RootRow (presented as a 4×3
// grid in the sheet, U5 CSS; still ONE `role="radiogroup"`, no new a11y), ScaleRow,
// RefsRow (its §12.3 vertical-lock preserved, #80 unchanged) — then the View row
// (orientation/density/handedness toggles) that the desktop card does not yet carry
// (the desktop View row is Phase 4).
//
// Open/close reuses `useDrawer` (open/close/toggle + Esc + focus-return to the peek
// header via panelRef) — NO focus trap and NO body-scroll-lock: the sheet is
// NON-MODAL, so it has no `role="dialog"` / `aria-modal`, no full overlay scrim, and
// the map behind it stays interactive. Dismissal is the peek-header toggle + Esc +
// the explicit Close button.
//
// Hide mechanism is PINNED to display:none (FINDINGS 3, 6): the WHOLE MobileControls
// subtree is `display:none` ≥760px (U6 CSS) so its radiogroups/checkboxes leave the
// a11y tree at desktop (the strict desktop e2e counts hold). The sheet's scrollable
// BODY region is ALSO `display:none` while at peek — applied INLINE here so (a) the
// peek sheet's pills are out of the tab order + a11y tree, and (b) the jsdom unit
// (which applies no CSS media queries) still sees the rows appear only after expand.
// `data-open` on the sheet drives the U6 CSS translateY transform (peek↔expand).

import { type Orientation } from '../notemap/mapView.ts';
import { type MapViewApi } from '../notemap/useMapView.ts';
import { useDrawer } from '../shell/useDrawer.ts';
import { type ControlsApi } from '../state/useControls.ts';

import './controls.css';
import { RefsRow } from './RefsRow.tsx';
import { RootRow } from './RootRow.tsx';
import { ScaleRow } from './ScaleRow.tsx';
import { ViewRow } from './ViewRow.tsx';

// The DOM id the peek header's `aria-controls` points at and the sheet carries, so
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
   * The §10 summary text — the scale name + active refs (e.g. "A Major · Tapes"),
   * computed in Content from the same `controls.state` AppShell's describeMap reads.
   * It is the peek header's visible label AND its accessible name's leading content.
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
  // focus-return to the peek header (panelRef). No trap, no scroll-lock.
  const { isOpen, toggle, close, panelRef } = useDrawer();

  return (
    <div className="mobile-controls">
      {/* The non-modal bottom sheet. NOT a dialog and carries no aria-modal — the
          map behind it stays live. panelRef receives focus on open (useDrawer) so
          the next Tab lands inside; it is tabIndex={-1} so it can hold focus.
          data-open drives the U6 translateY transform (peek↔expand). */}
      <section
        id={SHEET_ID}
        ref={panelRef}
        className="mc-sheet controls-sheet"
        data-open={isOpen}
        tabIndex={-1}
        aria-label="Scale controls"
      >
        {/* The PEEK HEADER — the SINGLE trigger and the always-visible peek band.
            It IS the summary: a bottom-pinned header showing the drag-grip, the live
            summary text, and an expand chevron. Its accessible name leads with the
            control purpose ("Scale controls,") then the live summary, so AT
            announces what it opens AND the current selection; aria-expanded mirrors
            the sheet state; aria-controls ties it to the sheet region. Tapping it
            toggles the sheet (peek↔expand) — it is also part of the non-modal
            dismissal set (header toggle + Esc + Close). It fills the §0 peek band
            (--sheet-peek-h ≥ 44px) so it is a real WCAG 2.5.5 tap target (U7 CSS). */}
        <button
          type="button"
          className="mc-header"
          aria-expanded={isOpen}
          aria-controls={SHEET_ID}
          aria-label={`Scale controls, ${summaryText}`}
          onClick={toggle}
        >
          {/* The drag-grip pip — purely decorative (the whole header is the target). */}
          <span className="mc-grip" aria-hidden="true" />
          <span className="mc-header-text">{summaryText}</span>
          {/* The expand affordance — a chevron that points up at peek (expands up)
              and flips down when expanded. Decorative; the button conveys state via
              aria-expanded. */}
          <span className="mc-chevron" aria-hidden="true">
            ▴
          </span>
        </button>

        {/* The scrollable BODY region — display:none while at peek so the sheet's
            rows are out of the tab order + a11y tree until expanded (FINDINGS 3, 6).
            Inline style so jsdom (no CSS media queries) reflects it; the U6 transform
            is keyed off data-open on the sheet, separately. */}
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
