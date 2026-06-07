// The 52px topbar (DESIGN.md §9 tree, §4.2): a breadcrumb on the left and the
// inert "Share scale" ghost button on the right, space-between. The bar carries
// no own fill — it inherits {canvas} from the body. The breadcrumb's active
// segment is the §13 spelled current selection ("Scales / B♭ Major"), driven
// from real `(root, scale)` state — S14 replaced the hard-coded "A Major" with
// the same `spell()`-derived name the H1 and the map labels use.
//
// S11 adds the mobile drawer trigger: a hamburger button that, BELOW the §10
// narrow breakpoint, opens the off-canvas navigation drawer (the collapsed
// sidebar). It is `.topbar-menu` — hidden at/above the breakpoint via CSS so the
// desktop topbar is unchanged, shown only on narrow viewports. It carries
// `aria-expanded` (drawer state), `aria-controls` (the drawer panel id), and an
// accessible label so it is keyboard-operable and announced (S10 a11y contract).

import { IcMenu } from './icons';

interface TopbarProps {
  /**
   * The §13 spelled current selection (e.g. "A Major", "B♭ Major") — the active
   * breadcrumb segment. Comes from `scaleName(controls.state)` in AppShell so it
   * agrees with the H1 and the map labels (one `spell()` engine).
   */
  scaleName: string;
  /** Whether the mobile drawer is open — drives the trigger's `aria-expanded`. */
  drawerOpen: boolean;
  /** Toggle the mobile navigation drawer (the hamburger trigger calls this). */
  onToggleDrawer: () => void;
}

function shareScale(): void {
  // No-op in v1 (DESIGN.md §16): "Share scale" has no defined behavior yet. The
  // button ships visible and inert per §8.4.
}

export function Topbar({ scaleName, drawerOpen, onToggleDrawer }: TopbarProps) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        {/* Mobile drawer trigger — CSS-hidden at/above the §10 breakpoint, so the
            desktop topbar is unchanged. Below it, this opens the off-canvas nav
            drawer (the collapsed 248px sidebar). Keyboard-operable + announced:
            `aria-expanded` tracks the drawer, `aria-controls` points at the panel
            (`mobile-drawer`), and the accessible name names the action (S10). */}
        <button
          type="button"
          className="topbar-menu"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          aria-controls="mobile-drawer"
          onClick={onToggleDrawer}
        >
          <span className="topbar-menu-ic" aria-hidden="true">
            <IcMenu />
          </span>
        </button>

        <nav className="crumb" aria-label="Breadcrumb">
          <span className="crumb-seg">Scales</span>
          <span className="crumb-sep" aria-hidden="true">
            /
          </span>
          <span className="crumb-seg crumb-active" aria-current="page">
            {scaleName}
          </span>
        </nav>
      </div>

      <button type="button" className="ghost" onClick={shareScale}>
        Share scale
      </button>
    </div>
  );
}
