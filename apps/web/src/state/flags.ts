// flags.ts — the pure feature-flag layer (#176). No React, no DOM, no network:
// this module is the data + reducers the `useFlags` hook (flags.ts's hook
// counterpart, useFlags.ts) adapts to component state — the same pure+hook split
// as `controls.ts` / `useControls.ts`. DESIGN.md wins on any conflict (AGENTS.md).
//
// A flag gates a not-yet-public surface (today only the §18 Intonation drill,
// gated post-launch while it gets polish — #176). The precedence is three layers,
// lowest to highest:
//
//   built-in defaults  <  remote /flags.json  <  ?ff= URL override (persisted)
//
//   • Defaults are SYNCHRONOUS (`intonation: import.meta.env.DEV`) so first paint
//     never waits on the network: a dev build defaults ON, a prod build OFF.
//   • The remote object (fetched once at boot from the same origin — Cloudflare →
//     the GCS bucket — by the hook) merges OVER defaults; on 404/network failure
//     defaults win (fail-closed for unreleased features).
//   • A `?ff=intonation` URL override turns a flag on for this device (the hook
//     persists it to localStorage); `?ff=-intonation` clears it. Highest
//     precedence, so the owner (and e2e) can use a feature regardless of the
//     public default.
//
// Unknown flag names are IGNORED everywhere (parse, remote, override) — never a
// throw — so a stale `?ff=` link or a remote object naming a retired flag is
// harmless. `FlagName` is the closed set of live flags; everything keys off it.

/** The closed set of feature-flag names. One entry today (#176). */
export type FlagName = 'intonation';

/** The full flag state: every `FlagName` resolved to a boolean. */
export type Flags = Readonly<Record<FlagName, boolean>>;

/**
 * The every-`FlagName` order used to iterate the closed set without naming the
 * union inline (the flags analogue of `ROOT_PILLS`). `mergeFlags` walks this so a
 * new flag is picked up by adding exactly one entry here + to `FLAG_DEFAULTS`.
 */
export const FLAG_NAMES: readonly FlagName[] = ['intonation'];

/** Narrow an arbitrary string to a known `FlagName` (the unknown-flag guard). */
export function isFlagName(name: string): name is FlagName {
  return (FLAG_NAMES as readonly string[]).includes(name);
}

/**
 * Built-in defaults — the synchronous first-paint baseline. `import.meta.env.DEV`
 * is Vite's compile-time dev/prod boolean (true under `vite dev`, false in a
 * `vite build` bundle), so a dev build shows every gated surface and a prod build
 * hides it until the remote object or a `?ff=` override turns it on.
 */
export const FLAG_DEFAULTS: Flags = {
  intonation: import.meta.env.DEV,
};

/**
 * A parsed `?ff=` override map: each named flag mapped to the boolean it forces.
 * `intonation` → on, `-intonation` → off. A `Partial` (only the named flags
 * appear), so layering it over the merged remote-and-defaults state in
 * `mergeFlags` only touches the flags the URL actually named.
 */
export type FlagOverrides = Partial<Record<FlagName, boolean>>;

/**
 * Parse the `?ff=` query param into an overrides map. The value is a
 * comma-separated list of flag tokens: a bare name (`intonation`) forces it ON,
 * a `-` prefix (`-intonation`) forces it OFF. Whitespace around a token is
 * trimmed; an empty token is skipped; an unknown flag name is IGNORED (never a
 * throw) so a stale link can't break the app. Takes the live `search` string
 * (e.g. `?ff=intonation,-foo`) and reads only its `ff` param via
 * `URLSearchParams`, leaving every other query param untouched.
 *
 * Returns an empty map when `ff` is absent or names nothing valid — the caller
 * then has no overrides to layer, so the remote-and-defaults state stands.
 */
export function parseFfParam(search: string): FlagOverrides {
  const raw = new URLSearchParams(search).get('ff');
  if (raw === null) return {};
  const out: FlagOverrides = {};
  for (const token of raw.split(',')) {
    const trimmed = token.trim();
    if (trimmed === '') continue;
    const off = trimmed.startsWith('-');
    const name = off ? trimmed.slice(1) : trimmed;
    if (isFlagName(name)) out[name] = !off;
  }
  return out;
}

/**
 * Coerce an untrusted parsed-JSON value (the fetched `/flags.json`) into a
 * `FlagOverrides` map, keeping only known `FlagName` keys with boolean values.
 * A non-object (null, array, string), an unknown key, or a non-boolean value is
 * dropped — so a malformed or hostile remote object can only ever set known
 * flags to real booleans, never inject a key or a truthy non-boolean. Used by
 * the hook after `await response.json()`; pure here so it is unit-testable.
 */
export function coerceRemoteFlags(value: unknown): FlagOverrides {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const out: FlagOverrides = {};
  for (const name of FLAG_NAMES) {
    const v = record[name];
    if (typeof v === 'boolean') out[name] = v;
  }
  return out;
}

/**
 * Merge the three precedence layers into the resolved flag state:
 * `defaults < remote < overrides`. Walks the closed `FLAG_NAMES` set, so the
 * result is always a full `Flags` (every flag present, never `undefined` —
 * `noUncheckedIndexedAccess`-safe). `remote` and `overrides` are `Partial`, so a
 * layer that doesn't name a flag leaves the lower layer's value standing; a
 * higher layer naming a flag wins. Pure: same inputs, same output, no globals.
 */
export function mergeFlags(
  defaults: Flags,
  remote: FlagOverrides = {},
  overrides: FlagOverrides = {},
): Flags {
  const out = {} as Record<FlagName, boolean>;
  for (const name of FLAG_NAMES) {
    out[name] = overrides[name] ?? remote[name] ?? defaults[name];
  }
  return out;
}
