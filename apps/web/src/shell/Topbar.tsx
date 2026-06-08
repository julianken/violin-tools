// The 52px topbar (DESIGN.md §9 tree, §4.2): a breadcrumb on the left and the
// inert "Share scale" ghost button on the right, space-between. The bar carries
// no own fill — it inherits {canvas} from the body. The breadcrumb's active
// segment is the §13 spelled current selection ("Scales / B♭ Major"), driven
// from real `(root, scale)` state — S14 replaced the hard-coded "A Major" with
// the same `spell()`-derived name the H1 and the map labels use.
//
// S16 Phase 3 (U7) drops the mobile off-canvas drawer. The topbar no longer
// carries the hamburger; instead it carries a MOBILE-ONLY search trigger (the
// `.topbar-search` magnifier) that opens the command palette (`onOpenPalette` →
// palette.open()). It is `display:none` at/above the §10 breakpoint and revealed
// only in the narrow media block (the exact `.topbar-menu` precedent it replaces)
// so it NEVER coexists with the retained sidebar search on desktop — keeping the
// single "Search scales and tools" button at the default desktop viewport (and
// the desktop snapshot byte-stable). It carries a 44px hit target and an
// accessible name so it is keyboard-operable and announced (S10 a11y contract).

import { IcSearch } from './icons';

interface TopbarProps {
  /**
   * The §13 spelled current selection (e.g. "A Major", "B♭ Major") — the active
   * breadcrumb segment. Comes from `scaleName(controls.state)` in AppShell so it
   * agrees with the H1 and the map labels (one `spell()` engine).
   */
  scaleName: string;
  /**
   * Open the command palette — the mobile top-bar search trigger calls this
   * (§8.3, §9). On desktop the search is CSS-hidden; the sidebar search stays the
   * desktop palette opener.
   */
  onOpenPalette: () => void;
}

function shareScale(): void {
  // No-op in v1 (DESIGN.md §16): "Share scale" has no defined behavior yet. The
  // button ships visible and inert per §8.4.
}

export function Topbar({ scaleName, onOpenPalette }: TopbarProps) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        {/* Mobile-only search trigger — CSS-hidden at/above the §10 breakpoint, so
            the desktop topbar is unchanged and the sidebar search stays the sole
            "Search scales and tools" button on desktop. Below the breakpoint this
            opens the command palette. Keyboard-operable + announced: the accessible
            name names the action; a 44px hit target meets WCAG 2.5.5 (shell.css). */}
        <button
          type="button"
          className="topbar-search"
          aria-label="Search scales and tools"
          onClick={onOpenPalette}
        >
          <span className="topbar-search-ic" aria-hidden="true">
            <IcSearch />
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
