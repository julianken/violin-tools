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

describe('axisOf (orientation/handedness/density projection)', () => {
  it('horizontal+right+fit dot center === (xOf(offset), STRINGS[i].y) — today, byte-identical', () => {
    const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });
    for (let i = 0; i < STRINGS.length; i++) {
      for (const offset of COLUMN_OFFSETS) {
        expect(layout.dotCenter(i, offset)).toEqual({ cx: xOf(offset), cy: STRINGS[i]!.y });
      }
    }
  });
  it('horizontal preserves the §12.1 cross-axis height (264)', () => {
    const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });
    expect(layout.viewBoxHeight).toBe(264);
  });
  it('vertical swaps the axes: the neck runs down (taller than wide)', () => {
    const layout = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    expect(layout.viewBoxHeight).toBeGreaterThan(layout.viewBoxWidth);
  });
  it('vertical+right puts G (index 3) at the smallest cx (left), E (0) at the largest', () => {
    const layout = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    expect(layout.dotCenter(3, 0).cx).toBeLessThan(layout.dotCenter(0, 0).cx);
  });
  it('left handedness mirrors the cross axis vs right (same orientation/density)', () => {
    const right = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    const left = axisOf({ orientation: 'vertical', handedness: 'left', density: 'comfort' });
    expect(right.dotCenter(0, 0).cx).not.toBe(left.dotCenter(0, 0).cx);
  });
  it('comfort spaces columns wider than fit along the neck', () => {
    const fit = axisOf({ orientation: 'vertical', handedness: 'right', density: 'fit' });
    const comfort = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    const fitGap = fit.dotCenter(0, 2).cy - fit.dotCenter(0, 1).cy;
    const comfortGap = comfort.dotCenter(0, 2).cy - comfort.dotCenter(0, 1).cy;
    expect(comfortGap).toBeGreaterThan(fitGap);
  });

  // U0 (S16 ph2): horizontal+fit is the shipped desktop render — its viewBox is
  // the §12.1 '0 0 760 264' literal Content.tsx hardcodes, NOT 704. The neck's
  // right margin must be wide enough that the 668 last-column + a real margin
  // reaches 760 and the STRING_X2=724 string-line end sits 36px inside the box.
  it('horizontal+right+fit viewBox is the §12.1 desktop literal (0 0 760 264)', () => {
    const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });
    expect(layout.viewBox).toBe('0 0 760 264');
    expect(layout.viewBoxWidth).toBe(760);
  });
  it('horizontal+right+fit keeps the 724 string-line end inside the box (≥ 724 + 36)', () => {
    const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });
    expect(layout.viewBoxWidth).toBeGreaterThanOrEqual(724 + 36);
  });
  it('VIEWBOX constant equals axisOf horizontal+right+fit viewBox', () => {
    const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });
    expect(VIEWBOX).toBe(layout.viewBox);
  });
  // Pin the OTHER extents so the horizontal-fit margin change did not perturb them.
  it('horizontal+right+comfort extent is unperturbed (0 0 850 264)', () => {
    expect(axisOf({ orientation: 'horizontal', handedness: 'right', density: 'comfort' }).viewBox).toBe(
      '0 0 850 264',
    );
  });
  it('vertical+right+comfort extent is unperturbed (0 0 352 850)', () => {
    expect(axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' }).viewBox).toBe(
      '0 0 352 850',
    );
  });
  it('vertical+right+fit extent is unperturbed (0 0 352 704)', () => {
    expect(axisOf({ orientation: 'vertical', handedness: 'right', density: 'fit' }).viewBox).toBe(
      '0 0 352 704',
    );
  });
});

// #79 carry-forward: crossPos derives the cross-axis slot via order.indexOf(stringIndex).
// For any stringIndex outside 0..3 indexOf returns −1, which used to yield a silent
// off-board coordinate (cross.base − cross.step) with no throw and no NaN — corrupting
// the dot, the string line, and the string label together (all three consume crossPos).
// The guard fails fast on the programmer error instead. The valid 0..3 paths stay
// byte-identical — the §12.1 horizontal+right+fit pin at line 90-97 above re-runs green.
describe('crossPos out-of-range guard (§12.1 / #79)', () => {
  const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });

  it('dotCenter throws RangeError above the valid range', () => {
    expect(() => layout.dotCenter(4, 0)).toThrow(RangeError);
  });
  it('dotCenter throws below the valid range', () => {
    expect(() => layout.dotCenter(-1, 0)).toThrow();
  });
  it('stringLine throws RangeError out of range', () => {
    expect(() => layout.stringLine(4)).toThrow(RangeError);
  });
  it('valid string indices still resolve (no throw at the 0 and 3 extremes)', () => {
    expect(() => layout.dotCenter(0, 0)).not.toThrow();
    expect(() => layout.dotCenter(3, 0)).not.toThrow();
  });
});

// §12.1 / issue #78 Phase-2 density AC — "Density Fit shows all 15 positions with
// no scroll; Comfort scrolls vertically only (no horizontal scroll in either)."
// The pre-existing `axisOf` spacing test (comfort gap > fit gap) only proves the
// columns are spaced wider; it does NOT prove the AC's two scroll claims. These
// pin them at the geometry level (the only resolved surface Phase 2 ships — there
// is no Fit-vertical USER toggle until Phase 3, so this is the verifiable layer):
//   • FIT fits all 15 — every column's dot sits inside the vertical+fit neck
//     extent, so the whole neck shows with no scroll.
//   • COMFORT scrolls VERTICALLY ONLY — its neck extent (the scroll axis = the
//     viewBox HEIGHT) exceeds fit's, while the cross extent (the viewBox WIDTH) is
//     byte-identical between the two densities, so the extra extent is purely
//     vertical (nothing widens → no horizontal scroll is introduced by density).
describe('density scroll behavior (§12.1 / #78 Phase-2 AC)', () => {
  // The largest dot radius (§12.2 root dot = 15px, the §12.2 max the renderer
  // draws; mirrored from NoteMap.tsx DOT_RADIUS.root). A column "fits" when its
  // dot's far edge sits inside the neck extent. Kept as a documented literal so
  // this pure-geometry test takes no React/DOM dependency.
  const MAX_DOT_RADIUS = 15;

  it('FIT (vertical) fits all 15 positions inside the neck extent — no scroll', () => {
    const layout = axisOf({ orientation: 'vertical', handedness: 'right', density: 'fit' });
    // Vertical: the neck runs DOWN, so the neck axis is cy and the extent is the
    // viewBox HEIGHT. Every one of the 15 columns (its dot's far edge) must sit
    // inside that height — i.e. the full neck is visible without scrolling.
    const offenders: { columnOffset: number; dotBottom: number }[] = [];
    for (const offset of COLUMN_OFFSETS) {
      const dotBottom = layout.dotCenter(0, offset).cy + MAX_DOT_RADIUS;
      if (dotBottom > layout.viewBoxHeight) offenders.push({ columnOffset: offset, dotBottom });
    }
    expect(offenders).toEqual([]);
    // And the open column (offset 0) sits at the top, inside the box too.
    expect(layout.dotCenter(0, 0).cy - MAX_DOT_RADIUS).toBeGreaterThanOrEqual(0);
  });

  it('COMFORT (vertical) is taller than FIT on the neck axis — the vertical-scroll axis grows', () => {
    const fit = axisOf({ orientation: 'vertical', handedness: 'right', density: 'fit' });
    const comfort = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    // The neck axis (the scrollable one) is the viewBox HEIGHT in vertical, so a
    // longer comfort neck means a taller box that scrolls vertically (704 → 850).
    expect(comfort.viewBoxHeight).toBeGreaterThan(fit.viewBoxHeight);
  });

  it('COMFORT scrolls VERTICALLY ONLY — the cross axis (width) is identical to FIT', () => {
    const fit = axisOf({ orientation: 'vertical', handedness: 'right', density: 'fit' });
    const comfort = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    // The cross axis is the viewBox WIDTH in vertical. If density only stretched
    // the NECK, the width must NOT change between fit and comfort — that is the
    // geometric proof "no horizontal scroll in either" (the §10/responsive.spec.ts
    // live check covers the rendered page; this pins the source-of-truth geometry).
    expect(comfort.viewBoxWidth).toBe(fit.viewBoxWidth);
    // All 15 comfort columns also fit inside the (taller) comfort extent — comfort
    // scrolls but is never clipped.
    const offenders = COLUMN_OFFSETS.filter(
      (offset) => comfort.dotCenter(0, offset).cy + MAX_DOT_RADIUS > comfort.viewBoxHeight,
    );
    expect(offenders).toEqual([]);
  });
});

// U3 (S16 ph2): the static chrome — string lines, position guides, the nut, and
// the string-name / open labels — projected through the layout so it follows the
// render axis. HORIZONTAL must reproduce today's §12.1 literals byte-identically;
// VERTICAL swaps the axes and keeps every label clear of the dots.
describe('chrome helpers (§12.1 — string lines / guides / nut / labels)', () => {
  const COLUMN_COUNT = COLUMN_OFFSETS.length; // 15

  describe('horizontal+right+fit reproduces the §12.1 literals byte-identically', () => {
    const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });

    it('stringLine(i) === {x1:60, y1:STRINGS[i].y, x2:724, y2:STRINGS[i].y}', () => {
      for (let i = 0; i < STRINGS.length; i++) {
        expect(layout.stringLine(i)).toEqual({
          x1: 60,
          y1: STRINGS[i]!.y,
          x2: 724,
          y2: STRINGS[i]!.y,
        });
      }
    });

    it('guideLine(offset) === {x1:xOf(offset), y1:62, x2:xOf(offset), y2:212}', () => {
      for (const offset of STOPPED_OFFSETS) {
        expect(layout.guideLine(offset)).toEqual({
          x1: xOf(offset),
          y1: 62,
          x2: xOf(offset),
          y2: 212,
        });
      }
    });

    it('nutRect() === {x:58, y:62, width:5, height:150}', () => {
      expect(layout.nutRect()).toEqual({ x: 58, y: 62, width: 5, height: 150 });
    });

    it('openLabelPos() === {x:42, y:252}', () => {
      expect(layout.openLabelPos()).toEqual({ x: 42, y: 252 });
    });
  });

  describe('vertical+right+comfort swaps the axes, labels clear of dots', () => {
    const config = { orientation: 'vertical', handedness: 'right', density: 'comfort' } as const;
    const layout = axisOf(config);

    it('stringLine runs ALONG the neck — constant cross coord (x), varying along (y)', () => {
      for (let i = 0; i < STRINGS.length; i++) {
        const line = layout.stringLine(i);
        // x is the string's cross position and is constant; y spans the neck.
        expect(line.x1).toBe(line.x2);
        expect(line.x1).toBe(layout.dotCenter(i, 0).cx);
        expect(line.y2).toBeGreaterThan(line.y1);
      }
    });

    it("string 3 (G) sits at the smaller cross coord (56), string 0 (E) at the larger (302)", () => {
      expect(layout.stringLine(3).x1).toBe(56);
      expect(layout.stringLine(0).x1).toBe(302);
      expect(layout.stringLine(3).x1).toBeLessThan(layout.stringLine(0).x1);
    });

    it('guideLine crosses the strings — constant along (y), varying cross (x)', () => {
      const guide = layout.guideLine(1);
      expect(guide.y1).toBe(guide.y2);
      expect(guide.y1).toBe(layout.dotCenter(0, 1).cy);
      expect(guide.x2).toBeGreaterThan(guide.x1);
    });

    it('nutRect is a bar across the strings at the open end (wide, thin)', () => {
      const nut = layout.nutRect();
      expect(nut.width).toBeGreaterThan(nut.height); // bars across, not down
    });

    it('keeps ALL <text> labels upright by carrying NO rotation — they are pure {x,y}', () => {
      // The helpers return only coordinates (no rotate/transform field): the
      // renderer places upright <text> at these points (§3, §8).
      const sample = { ...layout.openLabelPos() };
      expect(Object.keys(sample).sort()).toEqual(['x', 'y']);
    });
  });

  // The dot center is unchanged by adding chrome helpers — guard the U1 contract.
  it('dotCenter is unchanged by the chrome helpers (horizontal+right+fit)', () => {
    const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });
    for (const offset of COLUMN_OFFSETS) {
      expect(layout.dotCenter(0, offset)).toEqual({ cx: xOf(offset), cy: STRINGS[0]!.y });
    }
    expect(COLUMN_COUNT).toBe(15);
  });
});

// §12.2 column-0 name slot — BOX-AWARE overlap guard (issue #180, AC8).
// The string name renders inside the open slot (dotCenter(i, 0)) and only when
// that slot holds no dot, so the guard asserts the NAME BOX clears every slot
// that CAN hold one: the same string's stopped columns and the other strings'
// open slots. Box model: name box 16×13 centered on the anchor (the measured
// Inter 11/600 box of the widest 2-char name); a dot's worst-case reach is
// 20.5px (root glow r=19 + stroke 3/2 — §12.2). The historical >15px
// center-distance check PASSED while prod hard-overlapped, because text boxes
// and the glow extend past their centers — this guard measures the boxes.
describe('§12.2 column-0 name slot — box-aware overlap guard (issue #180)', () => {
  const NAME_HALF_W = 16 / 2;
  const NAME_HALF_H = 13 / 2;
  const DOT_REACH = 20.5; // root glow r 19 + strokeWidth 3 / 2 — worst case

  interface Box {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }
  const nameBox = (cx: number, cy: number): Box => ({
    x0: cx - NAME_HALF_W,
    y0: cy - NAME_HALF_H,
    x1: cx + NAME_HALF_W,
    y1: cy + NAME_HALF_H,
  });
  const dotBox = (cx: number, cy: number): Box => ({
    x0: cx - DOT_REACH,
    y0: cy - DOT_REACH,
    x1: cx + DOT_REACH,
    y1: cy + DOT_REACH,
  });
  const intersects = (a: Box, b: Box): boolean =>
    a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

  const CONFIGS = [
    { orientation: 'horizontal', handedness: 'right', density: 'fit' },
    { orientation: 'horizontal', handedness: 'right', density: 'comfort' },
    { orientation: 'vertical', handedness: 'right', density: 'comfort' },
    { orientation: 'vertical', handedness: 'right', density: 'fit' },
    { orientation: 'vertical', handedness: 'left', density: 'comfort' },
  ] as const;

  for (const config of CONFIGS) {
    const label = `${config.orientation}+${config.handedness}+${config.density}`;
    it(`name box at dotCenter(i,0) clears every occupiable slot (${label})`, () => {
      const layout = axisOf(config);
      const offenders: { stringIndex: number; against: string }[] = [];
      for (let i = 0; i < STRINGS.length; i++) {
        const anchor = layout.dotCenter(i, 0);
        const name = nameBox(anchor.cx, anchor.cy);
        // Same string, every stopped column (the nearest dot the name can face).
        for (const offset of STOPPED_OFFSETS) {
          const dot = layout.dotCenter(i, offset);
          if (intersects(name, dotBox(dot.cx, dot.cy))) {
            offenders.push({ stringIndex: i, against: `col ${String(offset)}` });
          }
        }
        // Every OTHER string's open slot (which can hold an in-scale/root dot).
        for (let j = 0; j < STRINGS.length; j++) {
          if (j === i) continue;
          const dot = layout.dotCenter(j, 0);
          if (intersects(name, dotBox(dot.cx, dot.cy))) {
            offenders.push({ stringIndex: i, against: `string ${String(j)} open` });
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  }

  it('REGRESSION: the deleted x=24 chrome anchor fails this box math against the open dot', () => {
    // The pre-#180 horizontal label row anchored at {x:24, y:S.y+4}. Its name
    // box DOES intersect the open slot's worst-case dot box — the exact prod
    // overlap (A4 label over the open-A root glow) the old >15px center test
    // never saw. This pins that the box model actually catches the failure the
    // guard exists for; if the box constants ever loosen enough to pass the
    // historical geometry, this test fails first.
    const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });
    for (let i = 0; i < STRINGS.length; i++) {
      const oldAnchor = nameBox(24, STRINGS[i]!.y + 4);
      const openDot = layout.dotCenter(i, 0);
      expect(intersects(oldAnchor, dotBox(openDot.cx, openDot.cy))).toBe(true);
    }
  });
});

// S17 ph B (#84): the §12.3 reference overlays — tape/heel/octave bands, the heel
// dash, and the overlay label anchors — projected through the SAME axis as the
// dots and static chrome. HORIZONTAL must reproduce the §12.3 horizontal literals
// (BAND_Y 60, BAND_HEIGHT 152, HEEL_DASH_Y 212, LABEL_TOP_Y 48, LABEL_BOTTOM_Y
// 226, POS_LABEL_Y 252) byte-identically; VERTICAL swaps the axes — bands span the
// CROSS field centered on the neck column, the heel dash is a neck-aligned segment
// at the cross-end, and labels move to the cross-start / cross-end gutters.
describe('overlay helpers (§12.3 — bands / heel dash / overlay labels)', () => {
  // §12.3 band widths, mirrored from refOverlays.ts so this pure-geometry test
  // takes no React dependency (the renderer passes these as neckWidth).
  const TAPE_WIDTH = 26;
  const HEEL_WIDTH = 28;
  const OCTAVE_WIDTH = 30;

  describe('horizontal+right+fit reproduces the §12.3 horizontal literals byte-identically', () => {
    const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });

    it('bandRect(off,w) === {x:xOf(off)−w/2, y:60, width:w, height:152} for tape +4', () => {
      expect(layout.bandRect(4, TAPE_WIDTH)).toEqual({
        x: xOf(4) - TAPE_WIDTH / 2,
        y: 60,
        width: TAPE_WIDTH,
        height: 152,
      });
    });

    it('bandRect heel (off 9, w 28) and octave (off 12, w 30) match the §12.3 literals', () => {
      expect(layout.bandRect(9, HEEL_WIDTH)).toEqual({
        x: xOf(9) - HEEL_WIDTH / 2,
        y: 60,
        width: HEEL_WIDTH,
        height: 152,
      });
      expect(layout.bandRect(12, OCTAVE_WIDTH)).toEqual({
        x: xOf(12) - OCTAVE_WIDTH / 2,
        y: 60,
        width: OCTAVE_WIDTH,
        height: 152,
      });
    });

    it('heelDash(9,28) === a segment along the neck at y=212 (xOf(9)±14)', () => {
      expect(layout.heelDash(9, HEEL_WIDTH)).toEqual({
        x1: xOf(9) - HEEL_WIDTH / 2,
        y1: 212,
        x2: xOf(9) + HEEL_WIDTH / 2,
        y2: 212,
      });
    });

    it('overlayLeadLabel(off) === {x:xOf(off), y:48, anchor:middle} (the y=48 lead margin)', () => {
      expect(layout.overlayLeadLabel(4)).toEqual({ x: xOf(4), y: 48, anchor: 'middle' });
      expect(layout.overlayLeadLabel(12)).toEqual({ x: xOf(12), y: 48, anchor: 'middle' });
    });

    it('overlayTrailLabel(off) === {x:xOf(off), y:226, anchor:middle} (the y=226 trail margin)', () => {
      expect(layout.overlayTrailLabel(9)).toEqual({ x: xOf(9), y: 226, anchor: 'middle' });
      expect(layout.overlayTrailLabel(12)).toEqual({ x: xOf(12), y: 226, anchor: 'middle' });
    });

    it('overlayPosLabel(off) === {x:xOf(off), y:252, anchor:middle} (the y=252 pos margin)', () => {
      for (const off of [5, 7, 9, 12]) {
        expect(layout.overlayPosLabel(off)).toEqual({ x: xOf(off), y: 252, anchor: 'middle' });
      }
    });
  });

  describe('vertical+right+comfort swaps the axes (the literal pins from the derived relations)', () => {
    const layout = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    // Verified relations from the issue, with vertical+comfort numbers:
    //   cross = {base:56, step:82}; crossExtent = 56 + 3×82 + 50 = 352
    //   bandCrossStart = 56 − 8 = 48; bandCrossEnd = 56 + 246 + 6 = 308; span = 260
    //   neckPos(4)=254, neckPos(9)=534, neckPos(12)=702 (comfort: open 30, base 86, step 56)
    const BAND_CROSS_START = 48;
    const BAND_CROSS_SPAN = 260;
    const BAND_CROSS_END = 308; // = HEEL_DASH cross-end edge

    it('bandRect spans the cross field, centered on the neck column (tape +4)', () => {
      // Vertical: band is { x: bandCrossStart, y: neckPos(4)−w/2, width: span, height: w }.
      expect(layout.bandRect(4, TAPE_WIDTH)).toEqual({
        x: BAND_CROSS_START,
        y: 254 - TAPE_WIDTH / 2,
        width: BAND_CROSS_SPAN,
        height: TAPE_WIDTH,
      });
    });

    it('bandRect heel (off 9) and octave (off 12) span the cross field on their neck columns', () => {
      expect(layout.bandRect(9, HEEL_WIDTH)).toEqual({
        x: BAND_CROSS_START,
        y: 534 - HEEL_WIDTH / 2,
        width: BAND_CROSS_SPAN,
        height: HEEL_WIDTH,
      });
      expect(layout.bandRect(12, OCTAVE_WIDTH)).toEqual({
        x: BAND_CROSS_START,
        y: 702 - OCTAVE_WIDTH / 2,
        width: BAND_CROSS_SPAN,
        height: OCTAVE_WIDTH,
      });
    });

    it('heelDash is a neck-aligned segment at the cross-end (x = bandCrossEnd, y = neckPos(9)±14)', () => {
      expect(layout.heelDash(9, HEEL_WIDTH)).toEqual({
        x1: BAND_CROSS_END,
        y1: 534 - HEEL_WIDTH / 2,
        x2: BAND_CROSS_END,
        y2: 534 + HEEL_WIDTH / 2,
      });
    });

    it('overlayLeadLabel sits in the cross-start (left) gutter, start-anchored, level with the neck column', () => {
      // lead-margin (vertical) = a small left-gutter inset; y = neckPos(off).
      const lead = layout.overlayLeadLabel(9);
      expect(lead.y).toBe(534);
      expect(lead.anchor).toBe('start');
      expect(lead.x).toBeLessThan(BAND_CROSS_START); // inside the left gutter, before the bands
    });

    it('overlayPosLabel sits in the cross-end (right) gutter, end-anchored, level with the neck column', () => {
      // pos-margin (vertical) = crossExtent − CROSS_END_LABEL_MARGIN = 352 − 12 = 340.
      const pos = layout.overlayPosLabel(12);
      expect(pos).toEqual({ x: 340, y: 702, anchor: 'end' });
    });

    it('keeps every overlay anchor upright — pure {x,y,anchor}, NO rotation field', () => {
      const keys = Object.keys(layout.overlayLeadLabel(4)).sort();
      expect(keys).toEqual(['anchor', 'x', 'y']);
    });
  });
});
