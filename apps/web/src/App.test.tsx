import { render, screen, within } from '@testing-library/react';
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
