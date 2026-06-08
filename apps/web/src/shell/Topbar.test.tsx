import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Topbar } from './Topbar.tsx';

// S16 Phase 3 (U7) — the mobile off-canvas drawer is dropped. The topbar no
// longer carries the hamburger ("Open navigation") trigger; instead it carries a
// mobile-only search trigger (the magnifier) that opens the command palette.
//
// jsdom applies no media queries, so the `.topbar-search { display:none }` /
// `@media(max-width:760px){display:flex}` scope is invisible here — the button is
// always in the tree under jsdom. That is fine: this unit proves the WIRING
// (no hamburger; the search button calls onOpenPalette). The MOBILE-ONLY display
// scope (so the top-bar search never coexists with the retained sidebar search on
// desktop) is verified in the e2e at a real viewport (U9), where Chromium honors
// the media query.

describe('Topbar (U7 — drawer dropped, mobile search trigger)', () => {
  it('has NO "Open navigation" hamburger trigger', () => {
    render(<Topbar scaleName="A Major" onOpenPalette={() => undefined} />);
    expect(
      screen.queryByRole('button', { name: /open navigation/i }),
    ).not.toBeInTheDocument();
  });

  it('renders a search trigger button named "Search scales and tools"', () => {
    render(<Topbar scaleName="A Major" onOpenPalette={() => undefined} />);
    const search = screen.getByRole('button', { name: /search scales and tools/i });
    expect(search).toBeInTheDocument();
    expect(search).toHaveClass('topbar-search');
  });

  it('the search trigger opens the palette (calls onOpenPalette) on click', () => {
    const onOpenPalette = vi.fn();
    render(<Topbar scaleName="A Major" onOpenPalette={onOpenPalette} />);
    fireEvent.click(screen.getByRole('button', { name: /search scales and tools/i }));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  it('still renders the breadcrumb active segment from scaleName', () => {
    render(<Topbar scaleName="B♭ Major" onOpenPalette={() => undefined} />);
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumb).toHaveTextContent('B♭ Major');
  });
});
