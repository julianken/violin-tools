import { describe, expect, it } from 'vitest';

import { cssVar } from './tokens.ts';

// cssVar — the runtime helper that emits a CSS `var()` reference for a DECLARED
// token name (the type-level guard is the framework's job; #149 deliberately skips
// a compile-time tsc type-test). Two runtime branches: no fallback → `var(--x)`;
// a fallback → `var(--x, <fallback>)`. The const-tuple token tables above it are
// non-executable, so this function was the file's only un-pinned runtime logic.

describe('cssVar', () => {
  it('emits a bare var() reference when no fallback is given', () => {
    expect(cssVar('--mint')).toBe('var(--mint)');
  });

  it('appends the fallback as the var() second argument when one is given', () => {
    expect(cssVar('--mint', '#00ff88')).toBe('var(--mint, #00ff88)');
  });
});
