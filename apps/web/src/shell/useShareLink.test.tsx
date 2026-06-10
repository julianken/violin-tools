import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useShareLink } from './useShareLink.ts';

// useShareLink — the call-time adaptive share/copy branch + its feedback machine.
// The honesty contract (§11.3 / AC 7): the SHARE branch announces NOTHING on a
// bare resolve and is SILENT on an AbortError; only the COPY branch announces.
//
// jsdom ships none of `navigator.share` / `canShare` / `clipboard`, so each test
// installs exactly the surface it needs via `Object.defineProperty(navigator, …,
// { configurable: true })` and `afterEach` restores the descriptor — no global
// leaks across tests.

const URL = 'https://strings-solo.com/?r=A&s=major';
const buildUrl = () => URL;

/** Remember a navigator key's original descriptor; restore it in afterEach. */
const saved = new Map<string, PropertyDescriptor | undefined>();
function stubNavigator(key: string, value: unknown): void {
  if (!saved.has(key)) {
    saved.set(key, Object.getOwnPropertyDescriptor(navigator, key));
  }
  Object.defineProperty(navigator, key, { value, configurable: true });
}

afterEach(() => {
  for (const [key, descriptor] of saved) {
    if (descriptor === undefined) {
      // It did not exist before — delete the stub we added.
      Reflect.deleteProperty(navigator, key);
    } else {
      Object.defineProperty(navigator, key, descriptor);
    }
  }
  saved.clear();
  vi.restoreAllMocks();
});

describe('useShareLink — share branch (navigator.share available)', () => {
  it('takes the share branch and announces NOTHING on a bare resolve (cannot confirm a share)', async () => {
    const share = vi.fn(() => Promise.resolve());
    stubNavigator('share', share);
    // No canShare → `?? true` keeps the share branch.

    const { result } = renderHook(() => useShareLink(buildUrl));
    await act(async () => {
      result.current.share();
      await Promise.resolve();
    });

    expect(share).toHaveBeenCalledWith({ url: URL });
    // The honesty rule: a resolved share() is unconfirmable → no announcement,
    // no caption, phase stays idle.
    expect(result.current.announcement).toBe('');
    expect(result.current.caption).toBe('');
    expect(result.current.phase).toBe('idle');
  });

  it('is a SILENT no-op when the user dismisses the sheet (AbortError)', async () => {
    const abort = new DOMException('dismissed', 'AbortError');
    const share = vi.fn(() => Promise.reject(abort));
    stubNavigator('share', share);

    const { result } = renderHook(() => useShareLink(buildUrl));
    await act(async () => {
      result.current.share();
      await Promise.resolve();
    });

    expect(result.current.announcement).toBe('');
    expect(result.current.caption).toBe('');
    expect(result.current.phase).toBe('idle');
  });

  it('shows the neutral {text2} caption on a NON-Abort share rejection (still no announcement)', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('nope', 'NotAllowedError')));
    stubNavigator('share', share);

    const { result } = renderHook(() => useShareLink(buildUrl));
    await act(async () => {
      result.current.share();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('error');
    });
    expect(result.current.caption).toBe("Couldn't share — link is in the address bar");
    // The share branch NEVER announces — even on failure the caption is the only cue.
    expect(result.current.announcement).toBe('');
  });

  it('respects canShare?.({url}) — a veto falls through to the copy branch', async () => {
    const share = vi.fn(() => Promise.resolve());
    stubNavigator('share', share);
    stubNavigator('canShare', () => false); // veto
    const writeText = vi.fn(() => Promise.resolve());
    stubNavigator('clipboard', { writeText });

    const { result } = renderHook(() => useShareLink(buildUrl));
    await act(async () => {
      result.current.share();
      await Promise.resolve();
    });

    expect(share).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(URL);
  });
});

describe('useShareLink — copy branch (no navigator.share)', () => {
  it('copies the URL and announces "Link copied to clipboard" + shows the ✓ caption', async () => {
    // No share stub → typeof navigator.share !== 'function' → copy branch.
    const writeText = vi.fn(() => Promise.resolve());
    stubNavigator('clipboard', { writeText });

    const { result } = renderHook(() => useShareLink(buildUrl));
    await act(async () => {
      result.current.share();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('copied');
    });
    expect(writeText).toHaveBeenCalledWith(URL);
    expect(result.current.announcement).toBe('Link copied to clipboard');
    expect(result.current.caption).toBe('Link copied');
  });

  it('shows the failure caption on a clipboard rejection (no announcement)', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    stubNavigator('clipboard', { writeText });

    const { result } = renderHook(() => useShareLink(buildUrl));
    await act(async () => {
      result.current.share();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('error');
    });
    expect(result.current.caption).toBe("Couldn't copy — link is in the address bar");
    expect(result.current.announcement).toBe('');
  });

  it('default buildUrl shares the live window.location.href (the actual production URL)', async () => {
    // Every other test injects a stub buildUrl, so the DEFAULT param
    // (`() => window.location.href`, the real shared URL) is never exercised.
    // Stub window.location.href, call useShareLink() with NO arg, and assert the
    // copy branch writes that live href.
    const liveHref = 'https://strings-solo.com/?r=D&s=harmonic-minor';
    const savedLocation = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: { href: liveHref },
      configurable: true,
    });
    const writeText = vi.fn(() => Promise.resolve());
    stubNavigator('clipboard', { writeText });

    try {
      const { result } = renderHook(() => useShareLink()); // DEFAULT buildUrl
      await act(async () => {
        result.current.share();
        await Promise.resolve();
      });
      expect(writeText).toHaveBeenCalledWith(liveHref);
    } finally {
      if (savedLocation !== undefined) {
        Object.defineProperty(window, 'location', savedLocation);
      }
    }
  });

  it('reverts phase/caption/announcement after the revert delay; announcement returns to ""', async () => {
    // The revert-timer body (setPhase('idle') / setCaption('') / setAnnouncement(''))
    // is 0-hit on main. The blank announcement is a real a11y contract: a polite
    // region only re-speaks on text CHANGE, so the one-shot message must clear so a
    // later copy of the SAME text re-announces. Fake timers advance past REVERT_MS.
    vi.useFakeTimers();
    try {
      const writeText = vi.fn(() => Promise.resolve());
      stubNavigator('clipboard', { writeText });

      const { result } = renderHook(() => useShareLink(buildUrl));
      await act(async () => {
        result.current.share();
        await Promise.resolve();
      });
      // Mid-feedback: copied + caption + announcement are all set.
      expect(result.current.phase).toBe('copied');
      expect(result.current.caption).toBe('Link copied');
      expect(result.current.announcement).toBe('Link copied to clipboard');

      // Advance past the 1500ms (REVERT_MS) revert delay: everything reverts.
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(result.current.phase).toBe('idle');
      expect(result.current.caption).toBe('');
      // The load-bearing a11y assertion: the announcement blanks so the polite
      // region will re-speak the same message on a later copy.
      expect(result.current.announcement).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('routes an ABSENT clipboard API to the failure caption (never stuck on "copying")', () => {
    // Neither share NOR clipboard — an insecure/old context. A bare
    // navigator.clipboard.writeText() would throw synchronously; the guard must
    // route to the §8.4 caption instead of stranding phase on 'copying'.
    stubNavigator('clipboard', undefined);

    const { result } = renderHook(() => useShareLink(buildUrl));
    act(() => {
      result.current.share();
    });

    // Synchronous: the guard sets 'error' before any await, so the button never
    // shows the busy "Copying…" label on a context that can't copy.
    expect(result.current.phase).toBe('error');
    expect(result.current.caption).toBe("Couldn't copy — link is in the address bar");
    expect(result.current.announcement).toBe('');
  });
});
