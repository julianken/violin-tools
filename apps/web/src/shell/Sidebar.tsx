import { IcScales, IcSearch } from './icons';

// The 248px sticky left rail (DESIGN.md §9 tree, §4.2). Children render in the
// spec's exact order: brand · search · section-heading · nav · spacer ·
// theme-toggle. The three soon tools are inert stubs and the theme toggle is
// inert; S6 wired the controls and S9 wires the palette: the search is now a
// LIVE trigger that opens the command palette (§8.3 — a button that opens the
// palette, not an inline text input).
//
// S16 Phase 3 (U7) drops the mobile off-canvas drawer: this element is now the
// desktop rail only (no off-canvas drawer chrome). Below the §10 breakpoint the
// rail is hidden (shell.css) and the mobile surfaces — the top-bar search trigger
// and the controls bottom sheet — take over. The sidebar search KEEPS its label
// and stays the desktop palette opener.

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
}

export function Sidebar({ onOpenPalette }: SidebarProps) {
  return (
    <header className="side">
      <div className="brand">
        Violin Tools<span className="brand-dot">.</span>
      </div>

      <button type="button" className="search" onClick={onOpenPalette}>
        <span className="search-ic">
          <IcSearch />
        </span>
        <span className="search-label">Search scales and tools</span>
        <kbd className="kbd">⌘K</kbd>
      </button>

      <div className="sec-h">Tools</div>

      <nav className="nav" aria-label="Tools">
        <a className="ni active" href="#board" aria-current="page">
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
