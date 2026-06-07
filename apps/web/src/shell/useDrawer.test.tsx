import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDrawer } from './useDrawer';

// useDrawer unit tests (S11). The hook owns the mobile drawer's STATE and its
// focus / keyboard contract (DESIGN.md §10 reflow; S10 a11y). jsdom can't compute
// the CSS slide, so these assert the BEHAVIOR the CSS keys off: the boolean
// open/close, the Esc-to-close, and the focus contract (focus into the panel on
// open, back to the opener on close). Non-vacuous: each test would fail if the
// open/close/focus wiring regressed.

describe('useDrawer — open / close / toggle state', () => {
  it('starts closed and opens, closes, and toggles', () => {
    const { result } = renderHook(() => useDrawer());
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('closes on Escape only while open (does not shadow Esc when shut)', () => {
    const { result } = renderHook(() => useDrawer());
    // Esc while closed is a no-op (no listener attached) — stays closed.
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
    // Esc while open closes it.
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(result.current.isOpen).toBe(false);
  });
});

// A tiny harness that mounts a real trigger + a panel wired to the hook, so the
// focus contract (a genuine DOM side effect) is exercised end-to-end.
function DrawerHarness() {
  const { isOpen, toggle, panelRef } = useDrawer();
  return (
    <div>
      <button type="button" data-testid="trigger" aria-expanded={isOpen} onClick={toggle}>
        menu
      </button>
      <aside ref={panelRef} tabIndex={-1} data-testid="panel">
        <button type="button" data-testid="inside">
          nav item
        </button>
      </aside>
    </div>
  );
}

describe('useDrawer — focus contract', () => {
  it('moves focus into the panel on open and returns it to the trigger on close', () => {
    render(<DrawerHarness />);
    const trigger = screen.getByTestId('trigger');
    const panel = screen.getByTestId('panel');

    // Focus the trigger, then open: focus moves into the panel.
    act(() => {
      trigger.focus();
    });
    expect(document.activeElement).toBe(trigger);

    act(() => {
      fireEvent.click(trigger);
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).toBe(panel);

    // Close (Esc): focus returns to the opener (the trigger).
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(trigger);
  });
});
