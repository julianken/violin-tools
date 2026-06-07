import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App.tsx';

// Shell smoke test (S3). Asserts the structural contract the later steps depend
// on: real landmarks, the single active nav item, and the three controls-row
// roles — including that Refs is an ARIA `group`, NOT a radiogroup (the §9.1
// prose calls all three radiogroups, but Refs is multi-select; S6 reconciles the
// DESIGN lines). These are behaviour-level assertions, not snapshots, so they
// survive cosmetic change while pinning the load-bearing structure.
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

  it('exposes the three controls rows with Root/Scale as radiogroups and Refs as a group', () => {
    render(<App />);
    expect(screen.getByRole('radiogroup', { name: 'Root note' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Scale type' })).toBeInTheDocument();
    // Refs is a `group`, NOT a radiogroup (multi-select; §9.1 reconciled by S6).
    expect(screen.getByRole('group', { name: 'Reference layers' })).toBeInTheDocument();
    expect(
      screen.queryByRole('radiogroup', { name: 'Reference layers' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2);
  });

  it('renders the search trigger as a button with a ⌘K chip and the theme toggle inert', () => {
    render(<App />);
    const search = screen.getByRole('button', { name: /search scales and tools/i });
    expect(search).toBeInTheDocument();
    expect(within(search).getByText('⌘K')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

// S11 — the responsive shell wiring at the App level: the topbar drawer trigger
// (the hamburger), its ARIA contract (aria-expanded / aria-controls / accessible
// name), that toggling it opens/closes the sidebar drawer (the `.side.is-open`
// class the CSS slide keys off), and that a nav action inside the drawer closes
// it. These mount the whole App so the Topbar → AppShell → Sidebar drawer plumbing
// is exercised end-to-end. jsdom can't compute the media query or the slide, so
// these assert the STATE + ARIA the CSS reflow keys off, not pixel geometry.
describe('App §10 responsive drawer (S11)', () => {
  it('exposes a labeled drawer trigger with aria-controls pointing at the drawer panel', () => {
    render(<App />);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    expect(trigger).toHaveAttribute('aria-controls', 'mobile-drawer');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // The panel it controls exists and carries that id (the sidebar <header>).
    const banner = screen.getByRole('banner');
    expect(banner).toHaveAttribute('id', 'mobile-drawer');
  });

  it('toggling the trigger opens then closes the drawer (the .is-open slide state)', () => {
    render(<App />);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    const banner = screen.getByRole('banner');
    // Closed at rest — no `.is-open` on the rail, aria-expanded false.
    expect(banner.classList.contains('is-open')).toBe(false);

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(banner.classList.contains('is-open')).toBe(true);

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(banner.classList.contains('is-open')).toBe(false);
  });

  it('Escape closes an open drawer', () => {
    render(<App />);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    const banner = screen.getByRole('banner');
    fireEvent.click(trigger);
    expect(banner.classList.contains('is-open')).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(banner.classList.contains('is-open')).toBe(false);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('activating the in-drawer Scales nav link closes the drawer', () => {
    render(<App />);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    const banner = screen.getByRole('banner');
    fireEvent.click(trigger);
    expect(banner.classList.contains('is-open')).toBe(true);
    // The Scales link lives inside the drawer; clicking it dismisses the drawer.
    const scales = within(banner).getByRole('link', { name: 'Scales' });
    fireEvent.click(scales);
    expect(banner.classList.contains('is-open')).toBe(false);
  });
});

// S10 — the cross-cutting a11y wiring at the shell level: the two §11.3 polite
// live regions (sounding + map description), live-region politeness, and that the
// map description refreshes on a scale change and the sounding region announces a
// sounded marker. These mount the whole app so the NoteMap → AppShell live-region
// plumbing is exercised end-to-end.
describe('App §11.3 live regions + sounding (S10)', () => {
  it('renders exactly two live regions, both aria-live="polite" (never assertive)', () => {
    const { container } = render(<App />);
    const live = Array.from(container.querySelectorAll('[aria-live]'));
    expect(live).toHaveLength(2);
    for (const region of live) {
      expect(region.getAttribute('aria-live')).toBe('polite');
    }
    // The two specified regions exist and are distinct elements (§11.3).
    expect(container.querySelector('[data-live="sounding"]')).not.toBeNull();
    expect(container.querySelector('[data-live="map-description"]')).not.toBeNull();
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
