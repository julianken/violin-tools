import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePaletteController } from './usePaletteController.ts';

// usePaletteController lifecycle tests (§9 / §7.3 / §7.5). The CommandPalette
// integration suite asserts the `.is-closing` phase but NEVER advances timers to
// the `closed` terminal — so the close-animation COMPLETION (the setTimeout body
// that nulls the timer and sets phase 'closed', dropping isMounted to false) is
// untested. A wrong timeout key would strip `.is-closing` early OR leave the modal
// mounted forever, invisibly. These pin that boundary with fake timers, plus the
// open()-mid-closing cancel that re-opens cleanly without a stale timer firing.
//
// jsdom applies no stylesheet, so `readModalOutMs()` reads no `--modal-out` and
// falls back to 160 — the LONGER (`--modal-out`) close duration the cleanup keys
// to. We advance past 160ms to reach the terminal phase.

describe('usePaletteController — close-animation completion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('close() animates to the terminal closed phase (isMounted drops to false)', () => {
    const { result } = renderHook(() => usePaletteController());
    act(() => {
      result.current.open();
    });
    expect(result.current.phase).toBe('open');
    expect(result.current.isMounted).toBe(true);

    // close() swaps to 'closing' synchronously; the modal stays MOUNTED while the
    // §7.3/§7.5 close timeline runs (so `.is-closing` can animate).
    act(() => {
      result.current.close();
    });
    expect(result.current.phase).toBe('closing');
    expect(result.current.isMounted).toBe(true);

    // The cleanup timeout is keyed to the LONGER close duration (160ms fallback).
    // Just BEFORE it fires, the modal is still mounted (the closing animation runs).
    act(() => {
      vi.advanceTimersByTime(159);
    });
    expect(result.current.phase).toBe('closing');
    expect(result.current.isMounted).toBe(true);

    // At/after 160ms the timeout body runs: phase → 'closed', isMounted → false
    // (the modal unmounts). This is the L81–82 completion the integration suite
    // never reached.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.phase).toBe('closed');
    expect(result.current.isMounted).toBe(false);
  });

  it('open() mid-closing cancels the pending timer and snaps back to open', () => {
    const { result } = renderHook(() => usePaletteController());
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.close();
    });
    expect(result.current.phase).toBe('closing');

    // Re-open BEFORE the cleanup fires: open() clears the in-flight close timer and
    // sets phase straight back to 'open' (the recipe's remove('is-closing')/
    // add('is-open')).
    act(() => {
      vi.advanceTimersByTime(80); // partway through the 160ms close
      result.current.open();
    });
    expect(result.current.phase).toBe('open');
    expect(result.current.isMounted).toBe(true);

    // Run out the wall clock: the CANCELLED timer must NOT fire 'closed' into the
    // now-open modal (the bug a wrong/uncancelled timer would cause).
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.phase).toBe('open');
    expect(result.current.isMounted).toBe(true);
  });

  it('the ⌘K toggle-close path also animates to the terminal closed phase', () => {
    // The chord-close branch (L100–103) is a SECOND close path with its own
    // setTimeout cleanup body; toggling closed via ⌘K must reach 'closed' too.
    const { result } = renderHook(() => usePaletteController());
    act(() => {
      result.current.open();
    });
    expect(result.current.phase).toBe('open');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    });
    expect(result.current.phase).toBe('closing');

    act(() => {
      vi.advanceTimersByTime(160);
    });
    expect(result.current.phase).toBe('closed');
    expect(result.current.isMounted).toBe(false);
  });

  it('close() while already closed is a no-op (no spurious timer)', () => {
    // The close() guard returns early when the phase isn't 'open', so a stray close
    // from a backdrop click after the modal already left never starts a timer.
    const { result } = renderHook(() => usePaletteController());
    expect(result.current.phase).toBe('closed');
    act(() => {
      result.current.close();
    });
    expect(result.current.phase).toBe('closed');
    expect(vi.getTimerCount()).toBe(0); // no cleanup timer was scheduled
  });
});
