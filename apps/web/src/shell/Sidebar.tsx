import { type View } from '../state/useView';

import { IcScales, IcSearch } from './icons';

// The 248px sticky left rail (DESIGN.md §9 tree, §4.2). Children render in the
// spec's exact order: brand · search · section-heading · nav · spacer ·
// theme-toggle. S6 wired the controls and S9 wires the palette: the search is a
// LIVE trigger that opens the command palette (§8.3 — a button that opens the
// palette, not an inline text input).
//
// S18 ph6 (§17.1): the **Tuner** is now an ACTIVE nav item — it left the `soon`
// stubs and renders like Scales (§8.2 active treatment, mint dot + label when
// selected). Clicking Scales / Tuner sets the §17.1 view seam (the `onSelectView`
// callback), swapping the `.main` content. Vibrato stays a `soon` stub.
//
// C9 (intonation epic): **Intonation** is now a LIVE nav item — it left the `soon`
// stubs and renders like Tuner (§8.2 active treatment). Clicking it sets the view
// seam to `'intonation'`, swapping `.main` to `<IntonationView />`.
//
// S16 Phase 3 (U7) drops the mobile off-canvas drawer: this element is now the
// desktop rail only (no off-canvas drawer chrome). Below the §10 breakpoint the
// rail is hidden (shell.css) and the mobile surfaces — the top-bar search trigger
// and the controls bottom sheet — take over. The sidebar search KEEPS its label
// and stays the desktop palette opener.

// The remaining "soon" tools, in display order, with their Unicode glyph
// characters (DESIGN.md §0 `icon.glyph-char`, §8.2) — set as text, never custom
// SVG. Tuner left this list in S18 ph6 (live view). Intonation left in C9 (live view).
const SOON_TOOLS = [{ label: 'Vibrato', glyph: '∿' }] as const;

interface SidebarProps {
  /** Open the command palette — the search trigger calls this (§8.3, §9). */
  onOpenPalette: () => void;
  /** The active view (§17.1) — drives which nav item carries the active treatment. */
  view: View;
  /** Switch the §17.1 view seam — the Scales / Tuner nav items call this. */
  onSelectView: (view: View) => void;
}

export function Sidebar({ onOpenPalette, view, onSelectView }: SidebarProps) {
  const scalesActive = view === 'scale-map';
  const tunerActive = view === 'tuner';
  const intonationActive = view === 'intonation';

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
        {/* Scales — the note-map view. An anchor to `#board` (the map slot) that
            ALSO sets the view seam, so it works as both a skip target and a view
            switch. aria-current marks the active view (§8.2). */}
        <a
          className={`ni${scalesActive ? ' active' : ''}`}
          href="#board"
          aria-current={scalesActive ? 'page' : undefined}
          onClick={() => {
            onSelectView('scale-map');
          }}
        >
          <span className="ic">
            <IcScales />
          </span>
          <span className="ni-label">Scales</span>
        </a>

        {/* Tuner — the live §17.1 view (S18 ph6). A button (it swaps content, it is
            not a hash target) styled like the active nav item, mint dot + label when
            selected (§8.2). */}
        <button
          type="button"
          className={`ni ni-button${tunerActive ? ' active' : ''}`}
          aria-current={tunerActive ? 'page' : undefined}
          onClick={() => {
            onSelectView('tuner');
          }}
        >
          <span className="ic" aria-hidden="true">
            ◎
          </span>
          <span className="ni-label">Tuner</span>
        </button>

        {/* Intonation — the live C9 view. A button (it swaps content, it is not a
            hash target) styled like the active nav item, mint dot + label when
            selected (§8.2). Glyph ◴ per DESIGN.md §0 `nav-intonation`. */}
        <button
          type="button"
          className={`ni ni-button${intonationActive ? ' active' : ''}`}
          aria-current={intonationActive ? 'page' : undefined}
          onClick={() => {
            onSelectView('intonation');
          }}
        >
          <span className="ic" aria-hidden="true">
            ◴
          </span>
          <span className="ni-label">Intonation</span>
        </button>

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
