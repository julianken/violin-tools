import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Sidebar } from './Sidebar.tsx';

// Sidebar nav tests — proves the §8.2 active treatment wiring for both live
// nav items (Tuner and Intonation) after S18 ph6 and C9. The Vibrato item is the
// sole remaining `soon` stub.
//
// jsdom applies no CSS (so `.soon` styling is invisible here), but the structural
// ARIA attributes (`aria-current`, `aria-disabled`, element type) are fully
// testable and are the contract this suite pins.

function renderSidebar(
  view: 'scale-map' | 'tuner' | 'intonation',
  onSelectView = vi.fn(),
) {
  return render(
    <Sidebar
      onOpenPalette={() => undefined}
      view={view}
      onSelectView={onSelectView}
    />,
  );
}

describe('Sidebar — Intonation live nav item (C9)', () => {
  it('renders the Intonation item as a <button> (not a <span aria-disabled>)', () => {
    renderSidebar('scale-map');
    const btn = screen.getByRole('button', { name: 'Intonation' });
    expect(btn).toBeInTheDocument();
    // Structural check: it is a button, not a span (a disabled soon-span would not
    // have role="button").
    expect(btn.tagName).toBe('BUTTON');
  });

  it('Intonation button has NO aria-disabled attribute', () => {
    renderSidebar('scale-map');
    const btn = screen.getByRole('button', { name: 'Intonation' });
    expect(btn).not.toHaveAttribute('aria-disabled');
  });

  it('Intonation button carries NO "soon" badge text', () => {
    renderSidebar('scale-map');
    const btn = screen.getByRole('button', { name: 'Intonation' });
    expect(btn).not.toHaveTextContent('soon');
  });

  it('Intonation button carries aria-current="page" when the Intonation view is active', () => {
    renderSidebar('intonation');
    const btn = screen.getByRole('button', { name: 'Intonation' });
    expect(btn).toHaveAttribute('aria-current', 'page');
  });

  it('Intonation button has NO aria-current when the scale-map view is active', () => {
    renderSidebar('scale-map');
    const btn = screen.getByRole('button', { name: 'Intonation' });
    expect(btn).not.toHaveAttribute('aria-current');
  });

  it('Intonation button has NO aria-current when the Tuner view is active', () => {
    renderSidebar('tuner');
    const btn = screen.getByRole('button', { name: 'Intonation' });
    expect(btn).not.toHaveAttribute('aria-current');
  });

  it('clicking the Intonation button calls onSelectView("intonation")', () => {
    const onSelectView = vi.fn();
    renderSidebar('scale-map', onSelectView);
    fireEvent.click(screen.getByRole('button', { name: 'Intonation' }));
    expect(onSelectView).toHaveBeenCalledWith('intonation');
    expect(onSelectView).toHaveBeenCalledTimes(1);
  });
});

describe('Sidebar — Vibrato remains the sole soon stub', () => {
  it('Vibrato is NOT rendered as a button (stays aria-disabled)', () => {
    renderSidebar('scale-map');
    // Vibrato is a `soon` span, not a button — it has no role="button".
    expect(screen.queryByRole('button', { name: 'Vibrato' })).toBeNull();
  });

  it('Vibrato span carries aria-disabled="true"', () => {
    const { container } = renderSidebar('scale-map');
    // Find the Vibrato soon span — it is the only `.ni.soon` element in the sidebar.
    const vibrato = container.querySelector('.nav .soon');
    expect(vibrato).not.toBeNull();
    expect(vibrato?.textContent).toContain('Vibrato');
    expect(vibrato?.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('Sidebar — existing live items remain unchanged', () => {
  it('Tuner button still renders and calls onSelectView("tuner")', () => {
    const onSelectView = vi.fn();
    renderSidebar('scale-map', onSelectView);
    fireEvent.click(screen.getByRole('button', { name: 'Tuner' }));
    expect(onSelectView).toHaveBeenCalledWith('tuner');
  });

  it('Tuner button carries aria-current="page" when the tuner view is active', () => {
    renderSidebar('tuner');
    expect(screen.getByRole('button', { name: 'Tuner' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
