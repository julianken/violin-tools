import { IcScales, IcSearch } from './icons';

// The fixed 248px sticky left rail (DESIGN.md §9 tree, §4.2). Children render in
// the spec's exact order: brand · search · section-heading · nav · spacer ·
// theme-toggle. Everything here is a frame: the search is a no-op trigger stub,
// the three soon tools are inert stubs, and the theme toggle is inert. Later
// steps wire the palette (S9) and controls (S6); this step lays out the chrome.

// The three "soon" tools, in display order, with their Unicode glyph characters
// (DESIGN.md §0 `icon.glyph-char`, §8.2) — set as text, never custom SVG.
const SOON_TOOLS = [
  { label: 'Intonation', glyph: '◴' },
  { label: 'Vibrato', glyph: '∿' },
  { label: 'Tuner', glyph: '◎' },
] as const;

function openCommandPalette(): void {
  // No-op open stub for v1 (DESIGN.md §8.3): the search is a trigger that opens
  // the command palette. The palette overlay/dialog and ⌘K wiring are S9; this
  // step ships the trigger and its ⌘K chip wired to this stub.
}

export function Sidebar() {
  return (
    <header className="side">
      <div className="brand">
        Violin Tools<span className="brand-dot">.</span>
      </div>

      <button type="button" className="search" onClick={openCommandPalette}>
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
