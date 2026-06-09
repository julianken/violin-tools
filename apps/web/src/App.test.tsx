import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App.tsx';

// Shell smoke test (S3). Asserts the structural contract the later steps depend
// on: real landmarks, the single active nav item, and the four desktop controls-row
// roles — Root/Scale as radiogroups, Refs as an ARIA `group` (NOT a radiogroup —
// the §9.1 prose calls all radiogroups, but Refs is multi-select; S6 reconciles the
// DESIGN lines), and the View row's three radiogroups (Orientation/Density/
// Handedness, S16 ph4). The full App supplies a real mapView via AppShell, so the
// desktop card mounts <ViewRow> → five radiogroups total (Root + Scale + the View
// row's three). The count is five and NOT eight because the App's mobile sheet body
// is `display:none` at peek (MobileControls.tsx) — jsdom honors inline display:none
// in getComputedStyle, so the sheet's same-named View groups are out of the a11y
// tree. These are behaviour-level assertions, not snapshots, so they survive
// cosmetic change while pinning the load-bearing structure.
describe('App shell', () => {
  it('renders the header / nav / main landmarks', () => {
    render(<App />);
    // The sidebar is the <header> landmark; the topbar breadcrumb and the
    // sidebar tool list are <nav> landmarks; the content column is <main>.
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });

  it('exposes a skip link to the note map', () => {
    render(<App />);
    const skip = screen.getByRole('link', { name: 'Skip to note map' });
    expect(skip).toHaveAttribute('href', '#board');
  });

  it('has exactly one active nav item — Scales', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Tools' });
    // The active item is a real link with aria-current="page"; the three soon
    // stubs are aria-disabled spans, not links/actions.
    const active = within(nav).getByRole('link', { name: 'Scales' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getAllByRole('link')).toHaveLength(1);
  });

  it('renders the three soon stubs as inert, non-focusable affordances', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Tools' });
    for (const label of ['Intonation', 'Vibrato', 'Tuner']) {
      const stub = within(nav).getByText(label).closest('.ni');
      expect(stub).toHaveAttribute('aria-disabled', 'true');
      expect(stub).not.toHaveAttribute('href');
      expect(stub).not.toHaveAttribute('tabindex');
    }
  });

  it('exposes the four desktop controls rows: Root/Scale + View (Orientation/Density/Handedness) as radiogroups, Refs as a group', () => {
    render(<App />);
    expect(screen.getByRole('radiogroup', { name: 'Root note' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Scale type' })).toBeInTheDocument();
    // Refs is a `group`, NOT a radiogroup (multi-select; §9.1 reconciled by S6).
    expect(screen.getByRole('group', { name: 'Reference layers' })).toBeInTheDocument();
    expect(
      screen.queryByRole('radiogroup', { name: 'Reference layers' }),
    ).not.toBeInTheDocument();
    // S16 ph4 — the desktop card now carries the View row, so its three segmented
    // controls join Root + Scale as radiogroups. The single-match getByRole holds
    // (despite the mobile sheet carrying same-named View groups) ONLY because the
    // sheet's body is display:none at peek and so out of the jsdom a11y tree.
    expect(screen.getByRole('radiogroup', { name: 'Orientation' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Density' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Handedness' })).toBeInTheDocument();
    // Five — NOT eight — radiogroups: Root + Scale + the desktop View row's three.
    // The App's mobile sheet body is display:none at peek (MobileControls.tsx), so
    // its three same-named View radiogroups (and Root/Scale) are out of the a11y
    // tree (jsdom honors inline display:none in getComputedStyle), making the count
    // exact at the desktop card's five.
    expect(screen.getAllByRole('radiogroup')).toHaveLength(5);
  });

  it('renders the sidebar search trigger as a button with a ⌘K chip and the theme toggle inert', () => {
    render(<App />);
    // S16 ph3 (U7): the mobile top-bar search ALSO carries "Search scales and
    // tools", and jsdom applies no media query (so both are in the tree). Scope to
    // the sidebar (<header> banner) — the desktop palette opener with the ⌘K chip.
    const banner = screen.getByRole('banner');
    const search = within(banner).getByRole('button', { name: /search scales and tools/i });
    expect(search).toBeInTheDocument();
    expect(within(search).getByText('⌘K')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

// S16 ph3 (U7) — the mobile off-canvas drawer is dropped. The hamburger ("Open
// navigation") trigger and the `#mobile-drawer` panel chrome are gone; the mobile
// search relocates to a top-bar trigger that opens the palette, and the sidebar is
// the desktop rail only. The former `App §10 responsive drawer (S11)` describe
// block was removed wholesale (the behavior it pinned no longer exists). The
// mobile sheet + top-bar search are exercised at a real viewport in the e2e (U9).

// S10 — the cross-cutting a11y wiring at the shell level: the three §11.3 polite
// live regions (sounding + map description + the §16 Share-scale copy outcome),
// live-region politeness, and that the map description refreshes on a scale change
// and the sounding region announces a sounded marker. These mount the whole app so
// the NoteMap → AppShell live-region plumbing is exercised end-to-end. (The third
// region — `data-live="share"` — was added with the §16 Share-scale wiring; it
// stays empty until a copy succeeds and never speaks on a share-branch outcome.)
describe('App §11.3 live regions + sounding (S10)', () => {
  it('renders exactly three live regions, all aria-live="polite" (never assertive)', () => {
    const { container } = render(<App />);
    const live = Array.from(container.querySelectorAll('[aria-live]'));
    expect(live).toHaveLength(3);
    for (const region of live) {
      expect(region.getAttribute('aria-live')).toBe('polite');
    }
    // The three specified regions exist and are distinct elements (§11.3 / §16).
    expect(container.querySelector('[data-live="sounding"]')).not.toBeNull();
    expect(container.querySelector('[data-live="map-description"]')).not.toBeNull();
    const share = container.querySelector('[data-live="share"]');
    expect(share).not.toBeNull();
    expect(share?.getAttribute('aria-live')).toBe('polite');
  });

  it('the map-description region lives OUTSIDE the SVG (§11.3 — not in <desc>)', () => {
    const { container } = render(<App />);
    const desc = container.querySelector('[data-live="map-description"]');
    expect(desc).not.toBeNull();
    // It must not be inside the board SVG (SVG <desc> does not update reliably).
    expect(desc?.closest('svg')).toBeNull();
  });

  it('the map description names the scale and refreshes on a scale change', () => {
    const { container } = render(<App />);
    const desc = () => container.querySelector('[data-live="map-description"]')?.textContent ?? '';
    expect(desc().startsWith('A Major.')).toBe(true);
    const scaleRow = screen.getByRole('radiogroup', { name: 'Scale type' });
    fireEvent.click(within(scaleRow).getByRole('radio', { name: 'Harm. minor' }));
    expect(desc().startsWith('A Harmonic Minor.')).toBe(true);
  });

  it('the sounding region is empty until a marker is sounded, then announces it', () => {
    const { container } = render(<App />);
    const sounding = () => container.querySelector('[data-live="sounding"]')?.textContent ?? '';
    expect(sounding()).toBe('');
    // The board's single tab stop is the root marker; Enter sounds it.
    const tabStop = container.querySelector('g.note[tabindex="0"]');
    if (tabStop === null) throw new Error('no map tab stop');
    fireEvent.keyDown(tabStop, { key: 'Enter' });
    expect(sounding()).toBe('Sounding A'); // A Major default → root A
  });

  it('the board is a group named "Full fingerboard note map" with focusable markers', () => {
    const { container } = render(<App />);
    const board = document.getElementById('board');
    expect(board?.getAttribute('role')).toBe('group');
    expect(board?.getAttribute('aria-label')).toBe('Full fingerboard note map');
    // The markers are exposed (img role) with spoken accessible names.
    const markers = container.querySelectorAll('g.note[role="img"][aria-label]');
    expect(markers).toHaveLength(60);
  });
});

// S16 ph2 U4 — the live app mounts useMapView in AppShell and renders the map from
// the RESOLVED view config. jsdom has no matchMedia → useIsLandscape=false → 'auto'
// resolves to 'vertical', so these assert the vertical (mobile) render path: the
// board viewBox is driven by the layout (not a literal) and carries
// data-orientation='vertical'. The 60-node/one-tab-stop invariant, the three polite
// live regions (sounding + map description + the §16 Share-scale copy outcome), and
// the value-pure 'A Major.' description (the re-announce-trap mitigation is
// value-identity — describeMap stays a pure (root,scale,name) call, NOT keyed on
// orientation) must all survive the live wiring.
describe('App §12.1 resolved-view wiring (S16 ph2 U4)', () => {
  it('drives the board viewBox from the layout (parses to 4 numbers, not a literal)', () => {
    render(<App />);
    const board = document.getElementById('board');
    const viewBox = board?.getAttribute('viewBox');
    expect(viewBox).not.toBeNull();
    const parts = (viewBox ?? '').trim().split(/\s+/).map(Number);
    expect(parts).toHaveLength(4);
    for (const n of parts) expect(Number.isFinite(n)).toBe(true);
  });

  it('resolves to the vertical render in jsdom (no matchMedia → portrait)', () => {
    render(<App />);
    const board = document.getElementById('board');
    expect(board?.getAttribute('data-orientation')).toBe('vertical');
  });

  it('still exposes 60 map markers with exactly one tab stop', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('g.note')).toHaveLength(60);
    expect(container.querySelectorAll('g.note[tabindex="0"]')).toHaveLength(1);
  });

  it('keeps exactly three polite live regions and a value-pure "A Major." description', () => {
    const { container } = render(<App />);
    const live = Array.from(container.querySelectorAll('[aria-live]'));
    expect(live).toHaveLength(3);
    for (const region of live) {
      expect(region.getAttribute('aria-live')).toBe('polite');
    }
    const desc = container.querySelector('[data-live="map-description"]')?.textContent ?? '';
    expect(desc.startsWith('A Major.')).toBe(true);
  });
});

// S14 — the H1 heading and the breadcrumb active segment are §13 scale-aware: they
// spell the selected key letter-correct (the same `spell()` engine the map labels
// use). These mount the WHOLE app, change the selection, and assert all three
// surfaces agree — the integration guard for the original B♭→A♯ defect.
describe('App §13 scale-aware heading + breadcrumb (S14)', () => {
  function activeCrumb(): string {
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const active = crumb.querySelector('[aria-current="page"]');
    if (active === null) throw new Error('no active breadcrumb segment');
    return active.textContent;
  }

  it('defaults to the A Major selection in both the H1 and the breadcrumb', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A Major');
    expect(activeCrumb()).toBe('A Major');
  });

  it('selecting B♭ Major spells B♭ (not A♯) in the H1 and the breadcrumb', () => {
    render(<App />);
    const rootRow = screen.getByRole('radiogroup', { name: 'Root note' });
    fireEvent.click(within(rootRow).getByRole('radio', { name: 'Bb' }));

    const h1 = screen.getByRole('heading', { level: 1 });
    // The §13 root glyph is B♭ — never the sharp-only A♯ the old table produced.
    expect(h1).toHaveTextContent('B♭ Major');
    expect(h1.textContent).not.toContain('A♯');
    expect(activeCrumb()).toBe('B♭ Major');
  });

  it('uses the full scale name (Harmonic Minor), not the truncated pill label', () => {
    render(<App />);
    const scaleRow = screen.getByRole('radiogroup', { name: 'Scale type' });
    // The pill label is truncated "Harm. minor"; the heading uses the full §13
    // form "Harmonic Minor".
    fireEvent.click(within(scaleRow).getByRole('radio', { name: 'Harm. minor' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A Harmonic Minor');
    expect(activeCrumb()).toBe('A Harmonic Minor');
  });
});
