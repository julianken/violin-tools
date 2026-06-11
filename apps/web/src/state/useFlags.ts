// useFlags — the React adapter over the pure flag layer (flags.ts), mirroring the
// repo's pure+hook split (`controls.ts` / `useControls.ts`). The pure module owns
// precedence, parsing, and remote coercion; this hook owns the three impure
// edges — `localStorage`, `window.location.search`, and the one `fetch` — and
// composes them through the pure `mergeFlags`.
//
// Boot sequence (no async gate — first paint never waits on the network, #176):
//   1. Read the persisted overrides from localStorage (a prior `?ff=` that stuck).
//   2. Apply any `?ff=` in the live URL OVER them, and persist the result back —
//      so `?ff=intonation` sticks across a param-less reload and `?ff=-intonation`
//      clears it. This runs ONCE, synchronously, in the lazy `useState` init.
//   3. Initial state = `mergeFlags(defaults, {}, overrides)` — remote is empty at
//      first paint; gated UI renders from defaults + overrides immediately.
//   4. On mount, fetch `/flags.json` ONCE (AbortController-cancelled on unmount).
//      On resolve, re-merge `defaults < remote < overrides` and re-render. On
//      404 / network failure / malformed body, the catch is SILENT and the
//      current (default+override) state stands — fail-closed for unreleased
//      features. A flag appearing ~100ms after first paint is acceptable (#176);
//      there is deliberately no loading state.

import { useEffect, useState } from 'react';

import {
  coerceRemoteFlags,
  FLAG_DEFAULTS,
  mergeFlags,
  parseFfParam,
  type FlagOverrides,
  type Flags,
} from './flags.ts';

/** localStorage key for the persisted `?ff=` overrides (the `vt:` repo prefix). */
export const FLAG_OVERRIDES_KEY = 'vt:flag-overrides';

/** The same-origin path the remote flag object is fetched from at boot (#176). */
const REMOTE_FLAGS_PATH = '/flags.json';

/** Read the persisted overrides, tolerating absent/corrupt storage (returns {}). */
function loadOverrides(): FlagOverrides {
  let raw: string | null;
  try {
    raw = localStorage.getItem(FLAG_OVERRIDES_KEY);
  } catch {
    return {};
  }
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  // Reuse the remote coercer: it keeps only known flags with boolean values, so a
  // stale/hand-edited blob can only ever name real flags with real booleans.
  return coerceRemoteFlags(parsed);
}

/** Persist the overrides, tolerating storage failure (persistence is a nicety). */
function storeOverrides(overrides: FlagOverrides): void {
  try {
    localStorage.setItem(FLAG_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // ignore — a private-mode / quota failure must never break flag resolution.
  }
}

/**
 * Resolve, then persist, the device overrides: the persisted map with any `?ff=`
 * from the live URL applied over it. A `?ff=intonation` upserts `intonation:true`
 * (sticks), `?ff=-intonation` upserts `intonation:false` (clears the ON). The
 * merged map is written back so the override survives a param-less reload. Reads
 * `window.location.search` once; SSR-safe (jsdom has a search, so this is fine in
 * tests, but guarding keeps it honest if ever run without a `window`).
 */
function resolveAndPersistOverrides(): FlagOverrides {
  const persisted = loadOverrides();
  const fromUrl =
    typeof window === 'undefined' ? {} : parseFfParam(window.location.search);
  const merged: FlagOverrides = { ...persisted, ...fromUrl };
  // Only rewrite storage when the URL actually named a flag — a param-less load
  // must not churn (or resurrect) storage it didn't change.
  if (Object.keys(fromUrl).length > 0) storeOverrides(merged);
  return merged;
}

/**
 * The flag hook. Construct ONCE in AppShell and thread `flags` down to the gated
 * surfaces (the Sidebar nav item, the palette catalogue, the AppShell view
 * branch). Returns the resolved `Flags` — a full, readonly map (every `FlagName`
 * present). The device overrides are captured once at init (a `?ff=` change needs
 * a reload to take effect, which is the intended per-device-flip ergonomics).
 */
export function useFlags(): Flags {
  // Captured ONCE in a lazy `useState` initializer (runs exactly once, before
  // first render — never re-runs, so the URL write-back fires once). The device
  // overrides are STATE, not a ref: a lazy initializer is the sanctioned
  // run-once seam (reading a ref during render is forbidden, react-hooks/refs).
  const [overrides] = useState<FlagOverrides>(resolveAndPersistOverrides);

  // First paint: defaults + overrides only (remote is still in flight).
  const [flags, setFlags] = useState<Flags>(() =>
    mergeFlags(FLAG_DEFAULTS, {}, overrides),
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(REMOTE_FLAGS_PATH, {
          signal: controller.signal,
          // The object is served `no-cache`, but ask the browser not to reuse a
          // stale cached copy either — a flip should be visible on the next load.
          cache: 'no-store',
        });
        if (!response.ok) return; // 404 / 5xx → defaults win (fail-closed).
        const body: unknown = await response.json();
        const remote = coerceRemoteFlags(body);
        setFlags(mergeFlags(FLAG_DEFAULTS, remote, overrides));
      } catch {
        // AbortError on unmount, a network failure, or a malformed body — all
        // SILENT: the current default+override state stands (fail-closed).
      }
    })();
    return () => {
      controller.abort();
    };
  }, [overrides]);

  return flags;
}
