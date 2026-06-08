import { useState } from 'react';

import { CommandPalette } from '../components/CommandPalette/CommandPalette';
import { usePaletteController } from '../components/CommandPalette/usePaletteController';
import { describeMap } from '../notemap/describeMap';
import { type Density } from '../notemap/mapView';
import { useMapView } from '../notemap/useMapView';
import { scaleName, SCALE_DISPLAY_NAME } from '../state/controls';
import { useControls } from '../state/useControls';

import { Content } from './Content';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useDrawer } from './useDrawer';

// The §9 app shell: a flex row of `.side` (the fixed rail) and `.main` (the
// fluid column). The DOM matches the §9 tree exactly — `.app` → `.side` /
// `.main`, with `.main` → `.topbar` / `.content` (DESIGN.md §9). No CSS grid is
// used anywhere in the layout (§4); the only `inline-grid` in the product is the
// theme toggle's single-glyph icon slot (`.t-icon-swap`, see shell.css).
//
// S9 wires the command palette here, where the sidebar trigger and the modal can
// share one controller, and where the single `(root, scale, refs)` state (lifted
// from Content) is reachable by BOTH the controls card and the palette: choosing
// a Scales row sets `(root, scale)` and the note map re-renders from the same
// state (§9). The palette overlay is a sibling of `.app` so its `z-index 50`
// scrim sits above the whole shell (§9 tree, §7.3).

export function AppShell() {
  // The single app state every control AND the palette writes; the map renders
  // from it (§9.1). Lifted to the shell so the palette (a sidebar/global surface)
  // and the controls card (in Content) drive one source of truth.
  const controls = useControls();
  // §12.1 — the resolved note-map view. useMapView reads matchMedia at first paint
  // (no flash), so `mapView.orientation` is already concrete ('horizontal' on a
  // desktop-like landscape viewport, 'vertical' on portrait/mobile — and 'vertical'
  // under jsdom, which has no matchMedia). Phase 2 is AUTO-only — no toggle UI yet
  // (Phase 3) — so DERIVE density from the resolved orientation rather than reading
  // mapView.density (which defaults to 'comfort'): horizontal stays 'fit' to keep
  // the §12.1 desktop-horizontal regression invariant byte-identical, vertical is
  // 'comfort'. We do NOT pass mapView.mode (it can be 'auto', which axisOf rejects
  // and dotCenter needs resolved). The resolved {orientation, handedness, density}
  // flows into <Content>, which forwards the SAME config to the board <svg> and
  // <NoteMap> so the parent box and the dot centers never disagree.
  const mapView = useMapView();
  const density: Density = mapView.orientation === 'horizontal' ? 'fit' : 'comfort';
  // The palette open/close lifecycle + the global ⌘K / Ctrl-K toggle (§9).
  const palette = usePaletteController();
  // The mobile navigation drawer (§10): below the narrow breakpoint the 248px
  // sidebar collapses to an off-canvas drawer the topbar hamburger toggles. The
  // hook owns the open/close state, Esc-to-close, and the focus contract (focus
  // into the panel on open, back to the trigger on close). It is inert on desktop
  // where CSS keeps the rail always visible.
  const drawer = useDrawer();

  // §11.3 polite live regions: one announces the current sounding note name
  // (Enter/Space over a map marker), one carries the string-by-string map text
  // description, refreshed whenever (root, scale) changes. Both live in EXTERNAL
  // DOM elements (not the SVG), as §11.3 requires — SVG `<desc>` doesn't update
  // reliably across screen-reader/browser pairs.
  const [soundingNote, setSoundingNote] = useState('');
  const mapDescription = describeMap(
    controls.state.root,
    controls.state.scale,
    SCALE_DISPLAY_NAME[controls.state.scale],
  );

  return (
    <div className="app">
      {/* Skip link to the map slot (DESIGN.md §11.3). Visually hidden until
          focused; S10 styles the {mint} :focus-visible ring (§8). */}
      <a className="skip-link" href="#board">
        Skip to note map
      </a>
      {/* The mobile drawer scrim — a backdrop behind the open drawer that dims
          the content and closes the drawer on click/tap (§10). It is rendered
          only below the §10 breakpoint (CSS `display:none` on desktop) and only
          painted while the drawer is open (`.is-open`); above the breakpoint it
          never shows, so the desktop shell is unchanged. `aria-hidden` — it is
          pure chrome; the Esc key and the trigger carry the a11y affordance. */}
      <div
        className={`drawer-scrim${drawer.isOpen ? ' is-open' : ''}`}
        aria-hidden="true"
        onClick={drawer.close}
      />
      <Sidebar
        onOpenPalette={palette.open}
        onNavigate={drawer.close}
        panelRef={drawer.panelRef}
        drawerOpen={drawer.isOpen}
      />
      <div className="main">
        {/* The breadcrumb's active segment is the §13 spelled selection, shared
            with the Content H1 + the map labels via one `spell()` engine. The
            topbar also carries the mobile drawer trigger (§10). */}
        <Topbar
          scaleName={scaleName(controls.state)}
          drawerOpen={drawer.isOpen}
          onToggleDrawer={drawer.toggle}
        />
        <Content
          controls={controls}
          orientation={mapView.orientation}
          handedness={mapView.handedness}
          density={density}
          onSoundNote={setSoundingNote}
        />
      </div>

      {/* §11.3 live regions — both `polite`, never `assertive`. Visually hidden
          (`.sr-only`) but read by assistive tech. The sounding region speaks the
          last sounded note; the description region re-reads the scale layout. */}
      <div className="sr-only" aria-live="polite" data-live="sounding">
        {soundingNote === '' ? '' : `Sounding ${soundingNote}`}
      </div>
      <div className="sr-only" aria-live="polite" data-live="map-description">
        {mapDescription}
      </div>

      {/* The command palette overlay — mounted only while open or animating
          closed (the `.is-open`/`.is-closing` lifecycle, §7.3/§7.5). Choosing a
          Scales row sets `(root, scale)` on the shared state and closes (§9). */}
      {palette.isMounted && (
        <CommandPalette
          phase={palette.phase}
          onClose={palette.close}
          onSelectScale={(root, scale) => {
            controls.selectRoot(root);
            controls.selectScale(scale);
          }}
        />
      )}
    </div>
  );
}
