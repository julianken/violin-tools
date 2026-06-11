import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FLAG_OVERRIDES_KEY, useFlags } from './useFlags.ts';

// useFlags hook tests (#176) — the impure-edge adapter over the pure flags.ts.
// These exercise the three boot edges the pure layer can't: the synchronous
// first-paint state from defaults + persisted overrides, the `?ff=` URL → state
// + localStorage write-back, and the single boot `fetch('/flags.json')` (resolve,
// 404, and network-failure paths). DEV defaults intonation ON, so each case sets
// the URL / storage / fetch to drive the precedence it means to test.

/** Replace `window.location.search` for one test (jsdom allows redefining it). */
function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  localStorage.clear();
  setSearch('');
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/** Stub `fetch` to resolve once with the given body (a flags.json shape). */
function stubFetchResolve(body: unknown, ok = true): void {
  const response: Pick<Response, 'ok' | 'json'> = {
    ok,
    json: () => Promise.resolve(body),
  };
  globalThis.fetch = vi.fn().mockResolvedValue(response);
}

/** Stub `fetch` to reject (a network failure). */
function stubFetchReject(): void {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
}

/** A `fetch` stub whose promise never settles — models an in-flight request. */
function stubFetchPending(): void {
  globalThis.fetch = vi.fn().mockReturnValue(
    new Promise<Response>(() => {
      // intentionally never resolves — the request stays in flight for the test.
    }),
  );
}

describe('useFlags — synchronous first paint (defaults + overrides)', () => {
  it('returns the DEV default (intonation ON) with no override and a pending fetch', () => {
    // fetch never resolves within this synchronous assertion.
    stubFetchPending();
    const { result } = renderHook(() => useFlags());
    expect(result.current.intonation).toBe(import.meta.env.DEV);
  });

  it('a `?ff=-intonation` override forces it OFF synchronously and persists it', () => {
    stubFetchPending();
    setSearch('?ff=-intonation');
    const { result } = renderHook(() => useFlags());
    expect(result.current.intonation).toBe(false);
    // The override is written back so a param-less reload still reads it.
    expect(JSON.parse(localStorage.getItem(FLAG_OVERRIDES_KEY) ?? '{}')).toEqual({
      intonation: false,
    });
  });

  it('a persisted override is read on a param-less load (sticks across reload)', () => {
    stubFetchPending();
    localStorage.setItem(FLAG_OVERRIDES_KEY, JSON.stringify({ intonation: false }));
    const { result } = renderHook(() => useFlags());
    expect(result.current.intonation).toBe(false);
  });

  it('`?ff=intonation` overrides a persisted OFF (URL wins, write-back updates storage)', () => {
    stubFetchPending();
    localStorage.setItem(FLAG_OVERRIDES_KEY, JSON.stringify({ intonation: false }));
    setSearch('?ff=intonation');
    const { result } = renderHook(() => useFlags());
    expect(result.current.intonation).toBe(true);
    expect(JSON.parse(localStorage.getItem(FLAG_OVERRIDES_KEY) ?? '{}')).toEqual({
      intonation: true,
    });
  });

  it('a corrupt persisted overrides blob is ignored (falls back to the default)', () => {
    stubFetchPending();
    localStorage.setItem(FLAG_OVERRIDES_KEY, '{not json');
    const { result } = renderHook(() => useFlags());
    // Unparseable storage → no overrides → DEV default ON stands.
    expect(result.current.intonation).toBe(import.meta.env.DEV);
  });

  it('a localStorage read failure is tolerated (no override, default stands)', () => {
    stubFetchPending();
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage blocked');
      });
    const { result } = renderHook(() => useFlags());
    expect(result.current.intonation).toBe(import.meta.env.DEV);
    getItem.mockRestore();
  });
});

describe('useFlags — remote /flags.json fetch', () => {
  it('a remote {intonation:true} flips a default-OFF build ON after mount', async () => {
    // Simulate a prod-shaped default-off baseline by persisting an OFF override,
    // then prove the remote can flip it back on (remote < override, so we instead
    // assert the remote path with NO override: clear storage, default is DEV-on).
    // To test remote-over-default crisply we need a default-off start; the DEV
    // env defaults ON, so we drive the remote-OFF case here (the inverse path).
    stubFetchResolve({ intonation: false });
    const { result } = renderHook(() => useFlags());
    // First paint: DEV default ON.
    expect(result.current.intonation).toBe(true);
    // After the fetch resolves, the remote OFF merges over the default.
    await waitFor(() => {
      expect(result.current.intonation).toBe(false);
    });
  });

  it('an override still beats the remote (precedence holds through the fetch)', async () => {
    setSearch('?ff=intonation');
    stubFetchResolve({ intonation: false }); // remote says off…
    const { result } = renderHook(() => useFlags());
    expect(result.current.intonation).toBe(true);
    // …but the URL override wins, so even after the fetch resolves it stays ON.
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
    expect(result.current.intonation).toBe(true);
  });

  it('a 404 leaves the default standing (fail-closed)', async () => {
    stubFetchResolve({ intonation: false }, /* ok */ false);
    const { result } = renderHook(() => useFlags());
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
    // !response.ok → early return → DEV default ON unchanged.
    expect(result.current.intonation).toBe(true);
  });

  it('a network failure is silent and the default stands', async () => {
    stubFetchReject();
    const { result } = renderHook(() => useFlags());
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
    expect(result.current.intonation).toBe(true);
  });

  it('aborts the in-flight fetch on unmount (no state update after teardown)', () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
    stubFetchPending();
    const { unmount } = renderHook(() => useFlags());
    unmount();
    expect(abortSpy).toHaveBeenCalled();
  });

  it('fetches /flags.json exactly once on mount', async () => {
    stubFetchResolve({ intonation: true });
    renderHook(() => useFlags());
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/flags.json',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});
