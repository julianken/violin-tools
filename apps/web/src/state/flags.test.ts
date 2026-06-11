import { describe, expect, it } from 'vitest';

import {
  coerceRemoteFlags,
  FLAG_DEFAULTS,
  FLAG_NAMES,
  isFlagName,
  mergeFlags,
  parseFfParam,
  type Flags,
} from './flags.ts';

// Pure flag-layer tests (#176) — no React/DOM. These pin the three-layer
// precedence (defaults < remote < override), the `?ff=` parse grammar, the
// remote-object coercion, and — load-bearing — that an unknown flag name is
// IGNORED everywhere rather than throwing. The hook (useFlags.ts) is tested
// separately; this is the impure-edge-free core.

describe('FLAG_DEFAULTS / FLAG_NAMES', () => {
  it('FLAG_NAMES lists exactly the keys of FLAG_DEFAULTS', () => {
    expect([...FLAG_NAMES].sort()).toEqual(Object.keys(FLAG_DEFAULTS).sort());
  });

  it('intonation defaults to import.meta.env.DEV (true under the Vitest dev env)', () => {
    // Vitest runs with `import.meta.env.DEV === true`, so the default is ON here;
    // a `vite build` bundle compiles it to `false` (verified by the e2e prod
    // build hiding the surface).
    expect(FLAG_DEFAULTS.intonation).toBe(import.meta.env.DEV);
  });
});

describe('isFlagName (unknown-flag guard)', () => {
  it('accepts a known flag and rejects an unknown one', () => {
    expect(isFlagName('intonation')).toBe(true);
    expect(isFlagName('tuner')).toBe(false);
    expect(isFlagName('')).toBe(false);
  });
});

describe('parseFfParam (?ff= grammar)', () => {
  it('a bare name forces the flag ON', () => {
    expect(parseFfParam('?ff=intonation')).toEqual({ intonation: true });
  });

  it('a `-` prefix forces the flag OFF', () => {
    expect(parseFfParam('?ff=-intonation')).toEqual({ intonation: false });
  });

  it('parses a comma list with mixed on/off, the `?ff=a,-b` shape', () => {
    // Unknown `foo` is dropped; intonation on, a (hypothetical) second flag off
    // would survive — here only intonation is a real flag, so foo is ignored.
    expect(parseFfParam('?ff=intonation,-foo')).toEqual({ intonation: true });
  });

  it('trims whitespace around tokens and skips empty tokens', () => {
    expect(parseFfParam('?ff= intonation , ')).toEqual({ intonation: true });
  });

  it('ignores unknown flag names (never throws)', () => {
    expect(parseFfParam('?ff=nope,-alsonope')).toEqual({});
  });

  it('returns {} when ff is absent', () => {
    expect(parseFfParam('?r=A&s=major')).toEqual({});
    expect(parseFfParam('')).toEqual({});
  });

  it('reads only ff, leaving other params alone (no cross-contamination)', () => {
    expect(parseFfParam('?motion=spring&ff=intonation')).toEqual({ intonation: true });
  });

  it('a later token wins on a repeated flag (last-write within the list)', () => {
    expect(parseFfParam('?ff=intonation,-intonation')).toEqual({ intonation: false });
    expect(parseFfParam('?ff=-intonation,intonation')).toEqual({ intonation: true });
  });
});

describe('coerceRemoteFlags (untrusted JSON → overrides)', () => {
  it('keeps known boolean flags', () => {
    expect(coerceRemoteFlags({ intonation: true })).toEqual({ intonation: true });
    expect(coerceRemoteFlags({ intonation: false })).toEqual({ intonation: false });
  });

  it('drops unknown keys', () => {
    expect(coerceRemoteFlags({ intonation: true, tuner: true })).toEqual({
      intonation: true,
    });
  });

  it('drops non-boolean values (no truthy coercion)', () => {
    expect(coerceRemoteFlags({ intonation: 'yes' })).toEqual({});
    expect(coerceRemoteFlags({ intonation: 1 })).toEqual({});
    expect(coerceRemoteFlags({ intonation: null })).toEqual({});
  });

  it('returns {} for a non-object, null, or array', () => {
    expect(coerceRemoteFlags(null)).toEqual({});
    expect(coerceRemoteFlags('intonation')).toEqual({});
    expect(coerceRemoteFlags(42)).toEqual({});
    expect(coerceRemoteFlags([{ intonation: true }])).toEqual({});
  });
});

describe('mergeFlags precedence (defaults < remote < override)', () => {
  const offDefaults: Flags = { intonation: false };
  const onDefaults: Flags = { intonation: true };

  it('uses the default when no remote and no override name the flag', () => {
    expect(mergeFlags(offDefaults)).toEqual({ intonation: false });
    expect(mergeFlags(onDefaults)).toEqual({ intonation: true });
  });

  it('remote overrides the default', () => {
    expect(mergeFlags(offDefaults, { intonation: true })).toEqual({ intonation: true });
    expect(mergeFlags(onDefaults, { intonation: false })).toEqual({ intonation: false });
  });

  it('override beats remote AND default (highest precedence)', () => {
    // default off, remote on, override off → off wins.
    expect(mergeFlags(offDefaults, { intonation: true }, { intonation: false })).toEqual({
      intonation: false,
    });
    // default off, remote off, override on → on wins.
    expect(mergeFlags(offDefaults, { intonation: false }, { intonation: true })).toEqual({
      intonation: true,
    });
  });

  it('a layer not naming a flag leaves the lower layer standing', () => {
    // remote names nothing, override names nothing → default stands.
    expect(mergeFlags(onDefaults, {}, {})).toEqual({ intonation: true });
    // remote names it, override empty → remote stands.
    expect(mergeFlags(offDefaults, { intonation: true }, {})).toEqual({ intonation: true });
  });

  it('always returns a full Flags (every FLAG_NAME present, never undefined)', () => {
    const merged = mergeFlags(offDefaults, {}, {});
    for (const name of FLAG_NAMES) {
      expect(typeof merged[name]).toBe('boolean');
    }
  });
});
