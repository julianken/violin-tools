import { describe, expect, it } from 'vitest';

import { type View } from './useView.ts';

// useView — type-level tests. The three valid View values are pinned here so
// that a future rename/removal of a value causes a compile error in this test
// rather than a silent runtime failure elsewhere. These are compile-time checks
// (TypeScript assignability) expressed as runtime assertions so they run in CI.

describe('View type shape', () => {
  it("'scale-map' is a valid View", () => {
    const v: View = 'scale-map';
    expect(v).toBe('scale-map');
  });

  it("'tuner' is a valid View", () => {
    const v: View = 'tuner';
    expect(v).toBe('tuner');
  });

  it("'intonation' is a valid View (C9 — third live view)", () => {
    const v: View = 'intonation';
    expect(v).toBe('intonation');
  });
});
