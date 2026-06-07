import { type Ref } from 'react';

import { IcScales, IcSearch } from './icons';

// The 248px sticky left rail (DESIGN.md §9 tree, §4.2). Children render in the
// spec's exact order: brand · search · section-heading · nav · spacer ·
// theme-toggle. The three soon tools are inert stubs and the theme toggle is
// inert; S6 wired the controls and S9 wires the palette: the search is now a
// LIVE trigger that opens the command palette (§8.3 — a button that opens the
// palette, not an inline text input).
//
// S11 responsive role: this SAME element is BOTH the desktop rail (sticky 248px)
// AND the mobile off-canvas drawer (DESIGN.md §10). Above the §10 breakpoint it
// renders unchanged (no drawer chrome applies); below it, CSS transforms it
// off-canvas and `.is-open` slides it in. The shell passes a `panelRef` (so the
// drawer hook can move focus into it on open), `tabIndex={-1}` (so it can receive
// that focus), and `onNavigate` (so activating the search or the Scales link
// dismisses the drawer on mobile). None of this changes the desktop rendering.

// The three "soon" tools, in display order, with their Unicode glyph characters
// (DESIGN.md §0 `icon.glyph-char`, §8.2) — set as text, never custom SVG.
const SOON_TOOLS = [
  { label: 'Intonation', glyph: '◴' },
  { label: 'Vibrato', glyph: '∿' },
  { label: 'Tuner', glyph: '◎' },
] as const;

interface SidebarProps {
  /** Open the command palette — the search trigger calls this (§8.3, §9). */
  onOpenPalette: () => void;
  /**
   * Dismiss the mobile drawer after a navigation action (search opened, Scales
   * chosen). A no-op on desktop where the rail is always visible (§10).
   */
  onNavigate: () => void;
  /**
   * Ref to the rail root, attached so the drawer hook can move focus into the
   * panel on open (the panel is `tabIndex={-1}`) (§10 / S10 focus contract).
   */
  panelRef: Ref<HTMLElement>;
  /** Whether the drawer is currently open — drives the `.is-open` slide (§10). */
  drawerOpen: boolean;
}

export function Sidebar({ onOpenPalette, onNavigate, panelRef, drawerOpen }: SidebarProps) {
  return (
    <header
      ref={panelRef}
      id="mobile-drawer"
      // tabIndex -1 so the drawer hook can move focus to the panel on open
      // (focus then steps INTO the drawer on the next Tab) without making the
      // rail a tab stop in the normal desktop flow (§10 / S10).
      tabIndex={-1}
      className={`side${drawerOpen ? ' is-open' : ''}`}
    >
      <div className="brand">
        Violin Tools<span className="brand-dot">.</span>
      </div>

      <button
        type="button"
        className="search"
        onClick={() => {
          onOpenPalette();
          onNavigate();
        }}
      >
        <span className="search-ic">
          <IcSearch />
        </span>
        <span className="search-label">Search scales and tools</span>
        <kbd className="kbd">⌘K</kbd>
      </button>

      <div className="sec-h">Tools</div>

      <nav className="nav" aria-label="Tools">
        <a className="ni active" href="#board" aria-current="page" onClick={onNavigate}>
          <span className="ic">
            <IcScales />
          </span>
          <span className="ni-label">Scales</span>
        </a>

        {SOON_TOOLS.map(({ label, glyph }) => (
          <span
            key={label}
            className="ni soon"
            aria-disabled="true"
            title={`${label} — coming soon`}
          >
            <span className="ic" aria-hidden="true">
              {glyph}
            </span>
            <span className="ni-label">{label}</span>
            <span className="soon-badge">soon</span>
          </span>
        ))}
      </nav>

      <div className="spacer" />

      <button
        type="button"
        className="theme"
        aria-disabled="true"
        title="Light mode isn't available — Violin Tools is dark-native"
      >
        {/* Single fixed icon slot, structured for a future same-slot icon swap
            (transitions-dev 09): one `t-icon-swap` cell that can later hold two
            stacked `t-icon` glyphs. In S3 it holds exactly one glyph and ships
            static — no swap CSS, no JS, no second (sun) icon (DESIGN.md §8.8). */}
        <span className="t-icon-swap" data-state="dark" aria-hidden="true">
          <span className="t-icon">☾</span>
        </span>
        <span className="theme-label">Dark</span>
      </button>
    </header>
  );
}
