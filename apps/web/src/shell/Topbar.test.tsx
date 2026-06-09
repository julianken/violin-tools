import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Topbar } from './Topbar.tsx';
import type { ShareLink } from './useShareLink.ts';

/** An idle ShareLink stub; override fields per test. */
function shareLinkStub(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    phase: 'idle',
    caption: '',
    announcement: '',
    share: () => undefined,
    ...overrides,
  };
}

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
    render(
      <Topbar
        scaleName="A Major"
        onOpenPalette={() => undefined}
        shareLink={shareLinkStub()}
        isTuner={false}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /open navigation/i }),
    ).not.toBeInTheDocument();
  });

  it('renders a search trigger button named "Search scales and tools"', () => {
    render(
      <Topbar
        scaleName="A Major"
        onOpenPalette={() => undefined}
        shareLink={shareLinkStub()}
        isTuner={false}
      />,
    );
    const search = screen.getByRole('button', { name: /search scales and tools/i });
    expect(search).toBeInTheDocument();
    expect(search).toHaveClass('topbar-search');
  });

  it('the search trigger opens the palette (calls onOpenPalette) on click', () => {
    const onOpenPalette = vi.fn();
    render(
      <Topbar
        scaleName="A Major"
        onOpenPalette={onOpenPalette}
        shareLink={shareLinkStub()}
        isTuner={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /search scales and tools/i }));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  it('still renders the breadcrumb active segment from scaleName', () => {
    render(
      <Topbar
        scaleName="B♭ Major"
        onOpenPalette={() => undefined}
        shareLink={shareLinkStub()}
        isTuner={false}
      />,
    );
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumb).toHaveTextContent('B♭ Major');
  });
});

// §17.1 — the topbar is view-aware: the Tuner is a SIBLING of the note map on the
// view seam, not a pane under Scales. On the Tuner view the breadcrumb collapses to
// JUST the tool name (no leading "Scales /" segment), and the Scales-only "Share
// scale" cluster (nothing to share in the Tuner) is suppressed entirely. The
// note-map view's topbar is unchanged (proven by the suite above + the cases below).
describe('Topbar — view-aware breadcrumb + Share suppression (§17.1)', () => {
  it('scale-map view: breadcrumb reads "Scales / <selection>" and the Share button is present', () => {
    render(
      <Topbar
        scaleName="B♭ Major"
        onOpenPalette={() => undefined}
        shareLink={shareLinkStub()}
        isTuner={false}
      />,
    );
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    // The leading "Scales" tool segment + separator are present on the note map.
    expect(crumb).toHaveTextContent('Scales');
    expect(crumb.querySelector('.crumb-sep')).not.toBeNull();
    expect(crumb).toHaveTextContent('B♭ Major');
    // The Scales-only Share action is rendered.
    expect(screen.getByRole('button', { name: 'Share scale' })).toBeInTheDocument();
  });

  it('Tuner view: breadcrumb is JUST "Tuner" (no leading "Scales" segment, no separator)', () => {
    render(
      <Topbar
        scaleName="Tuner"
        onOpenPalette={() => undefined}
        shareLink={shareLinkStub()}
        isTuner
      />,
    );
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    // Only the active tool-name segment — no "Scales", no "/" separator.
    expect(crumb).toHaveTextContent('Tuner');
    expect(crumb).not.toHaveTextContent('Scales');
    expect(crumb.querySelector('.crumb-sep')).toBeNull();
  });

  it('Tuner view: the "Share scale" cluster is suppressed entirely', () => {
    const { container } = render(
      <Topbar
        scaleName="Tuner"
        onOpenPalette={() => undefined}
        shareLink={shareLinkStub()}
        isTuner
      />,
    );
    // No ghost button, no .topbar-right cluster, no ghost-status caption.
    expect(screen.queryByRole('button', { name: 'Share scale' })).not.toBeInTheDocument();
    expect(container.querySelector('.topbar-right')).toBeNull();
    expect(container.querySelector('.ghost-status')).toBeNull();
  });
});

// §16 — the "Share scale" ghost button is wired to useShareLink. These unit tests
// prove the WIRING (the button calls share(); the label swaps to "Copying…" while
// busy; the caption renders from shareLink.caption; both caption + ✓ are
// aria-hidden so the single spoken source is AppShell's polite live region).
describe('Topbar — Share scale ghost button (§16)', () => {
  it('renders the resting "Share scale" ghost button that calls share() on click', () => {
    const share = vi.fn();
    render(
      <Topbar
        scaleName="A Major"
        onOpenPalette={() => undefined}
        shareLink={shareLinkStub({ share })}
        isTuner={false}
      />,
    );
    const ghost = screen.getByRole('button', { name: 'Share scale' });
    expect(ghost).toHaveClass('ghost');
    fireEvent.click(ghost);
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('swaps the label to "Copying…" while the copy branch is busy', () => {
    render(
      <Topbar
        scaleName="A Major"
        onOpenPalette={() => undefined}
        shareLink={shareLinkStub({ phase: 'copying' })}
        isTuner={false}
      />,
    );
    // The accessible name flips too, so the button is announced as the busy action.
    const ghost = screen.getByRole('button', { name: 'Copying link' });
    expect(ghost).toHaveTextContent('Copying…');
  });

  it('shows the copy-success caption beside the button, aria-hidden (live region is the spoken source)', () => {
    const { container } = render(
      <Topbar
        scaleName="A Major"
        onOpenPalette={() => undefined}
        shareLink={shareLinkStub({ phase: 'copied', caption: 'Link copied' })}
        isTuner={false}
      />,
    );
    const status = container.querySelector('.ghost-status');
    expect(status).not.toBeNull();
    expect(status).toHaveTextContent('Link copied');
    // The visible caption + ✓ are hidden from AT — exactly one spoken source.
    expect(status?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.ghost-check')?.getAttribute('data-state')).toBe('in');
  });

  it('shows the failure caption ({text2} neutral, no status-color change) beside the button', () => {
    const { container } = render(
      <Topbar
        scaleName="A Major"
        onOpenPalette={() => undefined}
        shareLink={shareLinkStub({
          phase: 'error',
          caption: "Couldn't copy — link is in the address bar",
        })}
        isTuner={false}
      />,
    );
    expect(container.querySelector('.ghost-status')).toHaveTextContent(
      "Couldn't copy — link is in the address bar",
    );
    // Failure shows NO ✓ (the check stays 'out').
    expect(container.querySelector('.ghost-check')?.getAttribute('data-state')).toBe('out');
  });
});
