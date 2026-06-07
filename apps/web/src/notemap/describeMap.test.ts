import { describe, expect, it } from 'vitest';

import { SCALE_DISPLAY_NAME } from '../state/controls.ts';

import { describeMap } from './describeMap.ts';

// §11.3 map-description suite. `describeMap` builds the string-by-string text the
// polite map-description live region carries — the scale name, then one clause per
// open string (E5 · A4 · D4 · G3) listing its in-scale notes in pitch order, in
// §13 spoken form. These pin the load-bearing properties (key-aware spelling,
// per-string structure, refresh-on-change) without snapshotting the whole prose.

function describe_(root: Parameters<typeof describeMap>[0], scale: Parameters<typeof describeMap>[1]) {
  return describeMap(root, scale, SCALE_DISPLAY_NAME[scale]);
}

describe('§11.3 describeMap — string-by-string text description', () => {
  it('leads with the spoken scale name (A Major)', () => {
    expect(describe_('A', 'major').startsWith('A Major.')).toBe(true);
  });

  it('speaks a flat key with words, never the # / ♯ glyph (B flat Major)', () => {
    const text = describe_('Bb', 'major');
    expect(text.startsWith('B flat Major.')).toBe(true);
    expect(text.includes('♯')).toBe(false);
    expect(text.includes('#')).toBe(false);
    expect(text.includes('sharp')).toBe(false);
  });

  it('names every open string in top-to-bottom order (E5, A4, D4, G3)', () => {
    const text = describe_('A', 'major');
    const e5 = text.indexOf('E5:');
    const a4 = text.indexOf('A4:');
    const d4 = text.indexOf('D4:');
    const g3 = text.indexOf('G3:');
    expect(e5).toBeGreaterThan(-1);
    expect(a4).toBeGreaterThan(e5);
    expect(d4).toBeGreaterThan(a4);
    expect(g3).toBeGreaterThan(d4);
  });

  it('lists a string clause that opens on its own pitch when in scale (A4 → A in A Major)', () => {
    // Open A4 is the root in A Major, so the A4 clause names A first.
    const text = describe_('A', 'major');
    const a4Clause = text.slice(text.indexOf('A4:'));
    expect(a4Clause.startsWith('A4: A')).toBe(true);
  });

  it('refreshes the whole description when the scale changes', () => {
    const major = describe_('A', 'major');
    const minor = describe_('A', 'naturalMinor');
    expect(major).not.toBe(minor);
    expect(minor.startsWith('A Natural Minor.')).toBe(true);
  });

  it('uses the spoken note names from the markers (C sharp, not C♯) in A Major', () => {
    const text = describe_('A', 'major');
    expect(text.includes('C sharp')).toBe(true);
    expect(text.includes('C♯')).toBe(false);
  });
});
