import { CommandPalette } from '../components/CommandPalette/CommandPalette';
import { usePaletteController } from '../components/CommandPalette/usePaletteController';
import { scaleName } from '../state/controls';
import { useControls } from '../state/useControls';

import { Content } from './Content';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

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
  // The palette open/close lifecycle + the global ⌘K / Ctrl-K toggle (§9).
  const palette = usePaletteController();

  return (
    <div className="app">
      {/* Skip link to the map slot (DESIGN.md §11.3). Visually hidden until
          focused; the UA focus ring is preserved (S10 styles the {mint} ring). */}
      <a className="skip-link" href="#board">
        Skip to note map
      </a>
      <Sidebar onOpenPalette={palette.open} />
      <div className="main">
        {/* The breadcrumb's active segment is the §13 spelled selection, shared
            with the Content H1 + the map labels via one `spell()` engine. */}
        <Topbar scaleName={scaleName(controls.state)} />
        <Content controls={controls} />
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
