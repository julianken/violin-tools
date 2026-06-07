import { describe, expect, it } from 'vitest';

import {
  axisOf,
  COLUMN_COUNT,
  COLUMN_OFFSETS,
  crossOrder,
  OPEN_X,
  STOPPED_OFFSETS,
  STRINGS,
  VIEWBOX,
  xOf,
} from './geometry';

// Geometry is the §12.1 coordinate system: pure arithmetic, so it gets a pure
// table test. These pin the exact spec literals (a regression in any one shifts
// every dot / guide / S7 band that keys off `xOf`).
describe('notemap geometry (§12.1)', () => {
  it('uses the §12.1 viewBox', () => {
    expect(VIEWBOX).toBe('0 0 760 264');
  });

  it('has 15 columns (1 open + 14 stopped) and 4 strings → 60 nodes', () => {
    expect(COLUMN_COUNT).toBe(15);
    expect(COLUMN_OFFSETS).toHaveLength(15);
    expect(STOPPED_OFFSETS).toHaveLength(14);
    expect(STRINGS).toHaveLength(4);
    expect(STRINGS.length * COLUMN_COUNT).toBe(60);
  });

  it('places the strings at the §12.1 y-values (E5 68, A4 114, D4 160, G3 206)', () => {
    expect(STRINGS.map((s) => [s.name, s.y])).toEqual([
      ['E5', 68],
      ['A4', 114],
      ['D4', 160],
      ['G3', 206],
    ]);
  });

  it('carries the §12.1 open-string pitch classes (E5 4, A4 9, D4 2, G3 7)', () => {
    expect(STRINGS.map((s) => [s.name, s.pc])).toEqual([
      ['E5', 4],
      ['A4', 9],
      ['D4', 2],
      ['G3', 7],
    ]);
  });

  // The load-bearing §12.1 column formula: open at 42, stopped at 96+(o−1)×44.
  // S7's tape/landmark bands center on xOf(offset), so this table is the
  // contract S7 consumes — it must stay exact.
  it.each([
    [0, OPEN_X], // open string
    [0, 42],
    [1, 96], // first stopped: 96 + 0×44
    [2, 140], // 96 + 1×44
    [3, 184],
    [4, 228],
    [5, 272],
    [9, 448], // 5th-position landmark column (S7)
    [12, 580], // octave landmark column (S7)
    [14, 668], // last stopped: 96 + 13×44
  ])('xOf(%i) === %i', (offset, x) => {
    expect(xOf(offset)).toBe(x);
  });

  it('exposes only stopped columns (1…14) for guide lines', () => {
    expect([...STOPPED_OFFSETS]).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
  });
});

describe('crossOrder (§12.5 string ordering)', () => {
  it('horizontal + right → E,A,D,G top→bottom (today)', () => {
    expect(crossOrder('horizontal', 'right')).toEqual([0, 1, 2, 3]);
  });
  it("vertical + right → G,D,A,E left→right (player's-eye)", () => {
    expect(crossOrder('vertical', 'right')).toEqual([3, 2, 1, 0]);
  });
  it('horizontal + left mirrors the rows', () => {
    expect(crossOrder('horizontal', 'left')).toEqual([3, 2, 1, 0]);
  });
  it('vertical + left mirrors to E,A,D,G left→right', () => {
    expect(crossOrder('vertical', 'left')).toEqual([0, 1, 2, 3]);
  });
});
