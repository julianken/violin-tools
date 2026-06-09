import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type RefsState } from '../state/controls';

import { RefLayers } from './RefLayers';
import { axisOf, xOf } from './geometry';
import { POSITION_LABELS, TAPE_SPECS, tapeOffset } from './refOverlays';

// RefLayers renders an SVG fragment (the §12.3 reference overlays, mounted inside
// `<svg id="board">`), so every test mounts it inside an <svg> host and queries
// that subtree. These are structural assertions against §12.3 / §3 / §7.1 — the
// offset→x table, the variant relabel/hide outcomes, the tnum settings, the
// panel-reveal hook, and the `.hide` group toggles — not snapshots.

const ALL_OFF: RefsState = {
  tapes: false,
  low2: false,
  threeTape: false,
  landmarks: false,
};

function renderRefs(refs: RefsState) {
  const { container } = render(
    <svg>
      <RefLayers refs={refs} />
    </svg>,
  );
  const svg = container.querySelector('svg');
  if (svg === null) throw new Error('no svg host');
  return {
    svg,
    tapeGroup: () => svg.querySelector('g.tape'),
    landGroup: () => svg.querySelector('g.land'),
    // The tape band <g> for a given tape number (1-based), in TAPE_SPECS order.
    tapeBand: (num: number) =>
      Array.from(svg.querySelectorAll('g.tape > g.tape-band'))[num - 1],
  };
}

describe('RefLayers tape bands (§12.3)', () => {
  it('renders the four default tape rects at +2/+4/+5/+7 (x = xOf(off) − 13)', () => {
    const { svg } = renderRefs({ ...ALL_OFF, tapes: true });
    const rects = Array.from(svg.querySelectorAll('g.tape rect.tape-rect'));
    // The default offset table: tape 1 +2, tape 2 +4, tape 3 +5, tape 4 +7.
    const expected = [2, 4, 5, 7];
    expect(rects).toHaveLength(4);
    rects.forEach((rect, index) => {
      const off = expected[index];
      if (off === undefined) throw new Error('missing expected offset');
      expect(rect.getAttribute('x')).toBe(String(xOf(off) - 13));
      expect(rect.getAttribute('y')).toBe('60');
      expect(rect.getAttribute('width')).toBe('26');
      expect(rect.getAttribute('height')).toBe('152');
      expect(rect.getAttribute('rx')).toBe('3');
    });
  });

  it('places each tape-number label at y=48, x=xOf(off) (column center), text N (+M)', () => {
    const { svg } = renderRefs({ ...ALL_OFF, tapes: true });
    const labels = Array.from(svg.querySelectorAll('g.tape text.tape-num'));
    const expected = [
      { off: 2, text: '1 (+2)' },
      { off: 4, text: '2 (+4)' },
      { off: 5, text: '3 (+5)' },
      { off: 7, text: '4 (+7)' },
    ];
    expect(labels).toHaveLength(4);
    labels.forEach((label, index) => {
      const row = expected[index];
      if (row === undefined) throw new Error('missing expected row');
      expect(label.getAttribute('x')).toBe(String(xOf(row.off)));
      expect(label.getAttribute('y')).toBe('48');
      expect(label.getAttribute('text-anchor')).toBe('middle');
      expect(label.textContent).toBe(row.text);
    });
  });

  it('tapeOffset() pins the offset→x mapping for every tape (pure)', () => {
    // Default state — every tape at its default offset.
    const defaults = TAPE_SPECS.map((spec) => tapeOffset(spec, ALL_OFF));
    expect(defaults).toEqual([2, 4, 5, 7]);
    // "low 2" — only tape 2 moves to +3; the rest are unchanged.
    const low2 = TAPE_SPECS.map((spec) =>
      tapeOffset(spec, { ...ALL_OFF, tapes: true, low2: true }),
    );
    expect(low2).toEqual([2, 3, 5, 7]);
  });
});

describe('RefLayers "low 2" variant (§12.3 / §7.5)', () => {
  it('relabels tape 2 to 2 (+3) under low 2 and flips data-open=false (slide driver)', () => {
    const { tapeBand } = renderRefs({ ...ALL_OFF, tapes: true, low2: true });
    const band2 = tapeBand(2);
    const label = band2?.querySelector('text.tape-num');
    // The label NUMBER tracks the active offset (`2 (+3)` under low 2), and
    // `data-open=false` is the panel-reveal end-state S8 drives the +4↔+3 slide
    // from. Per §7.5 the +4↔+3 displacement is owned by the `transform` (S8,
    // motion.css), NOT by rewriting the rect `x` — so the rect/label stay at the
    // tape's DEFAULT column x and the band physically translates (see the rect-x
    // assertion below). A CSS transform tween can't catch an SVG `x`-attribute
    // change, which is why the slide moved to transform.
    expect(label?.textContent).toBe('2 (+3)');
    expect(band2?.getAttribute('data-open')).toBe('false');
  });

  it('keeps tape 2 rect/label at the DEFAULT +4 column x so the transform owns the slide', () => {
    const { svg, tapeBand } = renderRefs({ ...ALL_OFF, tapes: true, low2: true });
    const band2 = tapeBand(2);
    const rect = band2?.querySelector('rect.tape-rect');
    const label = band2?.querySelector('text.tape-num');
    // Rect/label sit at the default +4 x in BOTH states; the -44px transform
    // (motion.css, keyed on data-open=false) moves the band to read as +3.
    expect(rect?.getAttribute('x')).toBe(String(xOf(4) - 13));
    expect(label?.getAttribute('x')).toBe(String(xOf(4)));
    // The other tapes stay put — tape 1 at +2.
    expect(
      svg.querySelector('g.tape rect.tape-rect')?.getAttribute('x'),
    ).toBe(String(xOf(2) - 13));
  });

  it('default state renders tape 2 at +4 with data-open=true (panel-reveal end-state)', () => {
    const { tapeBand } = renderRefs({ ...ALL_OFF, tapes: true });
    const band2 = tapeBand(2);
    expect(band2?.querySelector('rect.tape-rect')?.getAttribute('x')).toBe(
      String(xOf(4) - 13),
    );
    // §7.5 panel-reveal hook: tape 2 carries `t-panel-slide` + `data-open` so S8
    // can drive the +4↔+3 slide; default (+4) is the open end-state.
    expect(band2?.classList.contains('t-panel-slide')).toBe(true);
    expect(band2?.getAttribute('data-open')).toBe('true');
  });

  it('"low 2" flips tape 2 data-open to false (the +3 slide end-state for S8)', () => {
    const { tapeBand } = renderRefs({ ...ALL_OFF, tapes: true, low2: true });
    expect(tapeBand(2)?.getAttribute('data-open')).toBe('false');
  });

  it('only tape 2 carries the panel-reveal hook (the lone sliding band)', () => {
    const { tapeBand } = renderRefs({ ...ALL_OFF, tapes: true });
    for (const num of [1, 3, 4]) {
      expect(tapeBand(num)?.classList.contains('t-panel-slide')).toBe(false);
    }
  });
});

describe('RefLayers "3-tape" variant (§12.3 / §7.1)', () => {
  it('hides tape 2 via .hide but keeps it MOUNTED, with 1/3/4 still at +2/+5/+7', () => {
    const { svg, tapeBand } = renderRefs({
      ...ALL_OFF,
      tapes: true,
      threeTape: true,
    });
    // Tape 2 is still in the DOM (mounted-but-hidden) — NOT removed.
    const band2 = tapeBand(2);
    expect(band2).not.toBeUndefined();
    expect(band2?.classList.contains('hide')).toBe(true);
    // All four band <g>s are still rendered (nothing unmounted).
    expect(svg.querySelectorAll('g.tape > g.tape-band')).toHaveLength(4);
    // Tapes 1, 3, 4 remain mounted, NOT hidden, at their default offsets.
    for (const num of [1, 3, 4]) {
      const band = tapeBand(num);
      expect(band?.classList.contains('hide')).toBe(false);
    }
    const visibleOffsets = [1, 3, 4].map(
      (num) =>
        tapeBand(num)?.querySelector('rect.tape-rect')?.getAttribute('x'),
    );
    expect(visibleOffsets).toEqual([
      String(xOf(2) - 13),
      String(xOf(5) - 13),
      String(xOf(7) - 13),
    ]);
  });
});

describe('RefLayers landmark bands (§12.3)', () => {
  it('renders the heel band at column offset 9 (x = xOf(9) − 14, width 28)', () => {
    const { svg } = renderRefs({ ...ALL_OFF, landmarks: true });
    const rect = svg.querySelector('g.land rect.heel-rect');
    expect(rect?.getAttribute('x')).toBe(String(xOf(9) - 14));
    expect(rect?.getAttribute('y')).toBe('60');
    expect(rect?.getAttribute('width')).toBe('28');
    expect(rect?.getAttribute('height')).toBe('152');
    expect(rect?.getAttribute('rx')).toBe('3');
  });

  it('renders the heel dashed underline at y=212 from xOf(9)−14 to xOf(9)+14', () => {
    const { svg } = renderRefs({ ...ALL_OFF, landmarks: true });
    const line = svg.querySelector('g.land line.heel-dash');
    expect(line?.getAttribute('x1')).toBe(String(xOf(9) - 14));
    expect(line?.getAttribute('x2')).toBe(String(xOf(9) + 14));
    expect(line?.getAttribute('y1')).toBe('212');
    expect(line?.getAttribute('y2')).toBe('212');
  });

  it('renders the italic "heel ⌄" label at y=226, column center', () => {
    const { svg } = renderRefs({ ...ALL_OFF, landmarks: true });
    const label = svg.querySelector('g.land text.heel-label');
    expect(label?.textContent).toBe('heel ⌄');
    expect(label?.getAttribute('x')).toBe(String(xOf(9)));
    expect(label?.getAttribute('y')).toBe('226');
    expect(label?.getAttribute('text-anchor')).toBe('middle');
  });

  it('renders the octave band at column offset 12 (x = xOf(12) − 15, width 30)', () => {
    const { svg } = renderRefs({ ...ALL_OFF, landmarks: true });
    const rect = svg.querySelector('g.land rect.octave-rect');
    expect(rect?.getAttribute('x')).toBe(String(xOf(12) - 15));
    expect(rect?.getAttribute('y')).toBe('60');
    expect(rect?.getAttribute('width')).toBe('30');
    expect(rect?.getAttribute('height')).toBe('152');
    expect(rect?.getAttribute('rx')).toBe('3');
  });

  it('stacks the two octave labels: "octave ◈" at y=48, "½ string" at y=226', () => {
    const { svg } = renderRefs({ ...ALL_OFF, landmarks: true });
    const top = svg.querySelector('g.land text.octave-top');
    const bottom = svg.querySelector('g.land text.octave-bottom');
    expect(top?.textContent).toBe('octave ◈');
    expect(top?.getAttribute('y')).toBe('48');
    expect(top?.getAttribute('x')).toBe(String(xOf(12)));
    expect(bottom?.textContent).toBe('½ string');
    expect(bottom?.getAttribute('y')).toBe('226');
    expect(bottom?.getAttribute('x')).toBe(String(xOf(12)));
  });
});

describe('RefLayers position labels (§12.3)', () => {
  it('renders the four position labels inside .land at y=252, column centers', () => {
    const { svg } = renderRefs({ ...ALL_OFF, landmarks: true });
    const labels = Array.from(svg.querySelectorAll('g.land text.pos-label'));
    expect(labels).toHaveLength(4);
    const expected = [
      { text: '3rd pos', offset: 5 },
      { text: '4th pos', offset: 7 },
      { text: '5th pos', offset: 9 },
      { text: '7th pos', offset: 12 },
    ];
    expect(POSITION_LABELS).toEqual(expected);
    labels.forEach((label, index) => {
      const row = expected[index];
      if (row === undefined) throw new Error('missing expected row');
      expect(label.textContent).toBe(row.text);
      expect(label.getAttribute('x')).toBe(String(xOf(row.offset)));
      expect(label.getAttribute('y')).toBe('252');
    });
  });

  it('keeps position labels as children of the .land group (not .tape, not always-on)', () => {
    const { landGroup, svg } = renderRefs({ ...ALL_OFF, landmarks: true });
    const land = landGroup();
    // Every pos-label is a descendant of .land, and none sits in .tape.
    const posInLand = land?.querySelectorAll('text.pos-label') ?? [];
    expect(posInLand).toHaveLength(4);
    expect(svg.querySelectorAll('g.tape text.pos-label')).toHaveLength(0);
  });
});

describe('RefLayers visibility (the §7.1 .hide contract)', () => {
  it('mounts both groups even when every layer is off (never unmounted)', () => {
    const { tapeGroup, landGroup } = renderRefs(ALL_OFF);
    expect(tapeGroup()).not.toBeNull();
    expect(landGroup()).not.toBeNull();
    // Both groups carry `.hide` — present in the DOM, hidden via the class.
    expect(tapeGroup()?.classList.contains('hide')).toBe(true);
    expect(landGroup()?.classList.contains('hide')).toBe(true);
  });

  it('the Tapes pill toggles .hide on the tape group (kept mounted)', () => {
    const off = renderRefs(ALL_OFF);
    expect(off.tapeGroup()?.classList.contains('hide')).toBe(true);
    const on = renderRefs({ ...ALL_OFF, tapes: true });
    expect(on.tapeGroup()?.classList.contains('hide')).toBe(false);
    // The tape group does not affect the land group.
    expect(on.landGroup()?.classList.contains('hide')).toBe(true);
  });

  it('the Landmarks pill toggles .hide on the land group together (kept mounted)', () => {
    const on = renderRefs({ ...ALL_OFF, landmarks: true });
    expect(on.landGroup()?.classList.contains('hide')).toBe(false);
    // Heel band, octave band, and all four position labels are present together.
    expect(on.svg.querySelector('g.land rect.heel-rect')).not.toBeNull();
    expect(on.svg.querySelector('g.land rect.octave-rect')).not.toBeNull();
    expect(on.svg.querySelectorAll('g.land text.pos-label')).toHaveLength(4);
    // Landmarks does not affect the tape group.
    expect(on.tapeGroup()?.classList.contains('hide')).toBe(true);
  });
});

// S17 ph B (#84): the §12.3 overlays projected through axisOf onto the VERTICAL
// render. RefLayers consumes a resolved `layout` (axisOf({vertical,right,comfort}))
// + the orientation; the band rects span the cross field centered on their neck
// column, the heel dash is a neck-aligned segment at the cross-end, and every
// label is upright (pure x/y + text-anchor, never rotated).
describe('RefLayers vertical render (§12.3 projected through axisOf)', () => {
  const config = { orientation: 'vertical', handedness: 'right', density: 'comfort' } as const;
  const layout = axisOf(config);

  function renderVertical(refs: RefsState) {
    const { container } = render(
      <svg>
        <RefLayers refs={refs} layout={layout} orientation="vertical" />
      </svg>,
    );
    const svg = container.querySelector('svg');
    if (svg === null) throw new Error('no svg host');
    return { svg };
  }

  it('each tape band rect spans the cross axis and centers on its neck column', () => {
    const { svg } = renderVertical({ ...ALL_OFF, tapes: true });
    const rects = Array.from(svg.querySelectorAll('g.tape rect.tape-rect'));
    expect(rects).toHaveLength(4);
    const defaults = [2, 4, 5, 7];
    rects.forEach((rect, index) => {
      const off = defaults[index];
      if (off === undefined) throw new Error('missing offset');
      const band = layout.bandRect(off, 26);
      // Vertical: the band is wide on the cross axis (across the strings) and
      // thin on the neck axis — width is the cross span, not the 26 tape width.
      expect(rect.getAttribute('x')).toBe(String(band.x));
      expect(rect.getAttribute('y')).toBe(String(band.y));
      expect(rect.getAttribute('width')).toBe(String(band.width));
      expect(rect.getAttribute('height')).toBe(String(band.height));
      expect(band.width).toBeGreaterThan(band.height); // spans across, thin along neck
    });
  });

  it('a toggled tape band sits over the correct vertical dot column (centers on neckPos)', () => {
    const { svg } = renderVertical({ ...ALL_OFF, tapes: true });
    // Tape 3 is at +5; its band must center (on the neck axis = y) on the dot
    // column at offset 5 for every string.
    const band = layout.bandRect(5, 26);
    const bandCenterY = band.y + band.height / 2;
    // The dot at column 5 (any string) shares that neck-axis (cy) position.
    expect(layout.dotCenter(0, 5).cy).toBe(bandCenterY);
    const rect = Array.from(svg.querySelectorAll('g.tape rect.tape-rect'))[2];
    expect(rect?.getAttribute('y')).toBe(String(band.y));
  });

  it('renders the heel band + a neck-aligned heel dash at the cross-end', () => {
    const { svg } = renderVertical({ ...ALL_OFF, landmarks: true });
    const heel = layout.bandRect(9, 28);
    const rect = svg.querySelector('g.land rect.heel-rect');
    expect(rect?.getAttribute('x')).toBe(String(heel.x));
    expect(rect?.getAttribute('y')).toBe(String(heel.y));
    expect(rect?.getAttribute('width')).toBe(String(heel.width));
    expect(rect?.getAttribute('height')).toBe(String(heel.height));
    // The heel dash is a neck-aligned segment (constant x at the cross-end edge,
    // varying y over the band's neck width) — NOT a line across the strings.
    const dash = layout.heelDash(9, 28);
    const line = svg.querySelector('g.land line.heel-dash');
    expect(line?.getAttribute('x1')).toBe(String(dash.x1));
    expect(line?.getAttribute('x2')).toBe(String(dash.x2));
    expect(line?.getAttribute('y1')).toBe(String(dash.y1));
    expect(line?.getAttribute('y2')).toBe(String(dash.y2));
    expect(dash.x1).toBe(dash.x2); // vertical segment: x constant
    expect(dash.y2).toBeGreaterThan(dash.y1); // runs along the neck
  });

  it('places the heel/octave/tape labels upright in the left gutter (no rotation)', () => {
    const { svg } = renderVertical({ ...ALL_OFF, tapes: true, landmarks: true });
    const tapeNum = svg.querySelector('g.tape text.tape-num');
    const heelLabel = svg.querySelector('g.land text.heel-label');
    const octaveTop = svg.querySelector('g.land text.octave-top');
    // No element carries a rotate/transform — pure {x,y}+anchor.
    for (const el of [tapeNum, heelLabel, octaveTop]) {
      expect(el?.getAttribute('transform')).toBeNull();
    }
    // Lead labels (tape #, octave name, AND heel name on vertical) anchor in the
    // left gutter — text-anchor:start, x in the cross-start gutter (small inset).
    const lead = layout.overlayLeadLabel(9);
    expect(heelLabel?.getAttribute('text-anchor')).toBe('start');
    expect(heelLabel?.getAttribute('x')).toBe(String(lead.x));
    expect(heelLabel?.getAttribute('y')).toBe(String(lead.y));
    expect(octaveTop?.getAttribute('text-anchor')).toBe('start');
  });

  it('omits the "½ string" octave-bottom label on vertical, abbreviates position labels to the ordinal', () => {
    const { svg } = renderVertical({ ...ALL_OFF, landmarks: true });
    // "½ string" is dropped on vertical (the right gutter holds the position ordinal).
    expect(svg.querySelector('g.land text.octave-bottom')).toBeNull();
    // Position labels render abbreviated to the leading ordinal, end-anchored in
    // the right gutter.
    const posLabels = Array.from(svg.querySelectorAll('g.land text.pos-label'));
    expect(posLabels.map((l) => l.textContent)).toEqual(['3rd', '4th', '5th', '7th']);
    const pos = layout.overlayPosLabel(5);
    expect(posLabels[0]?.getAttribute('text-anchor')).toBe('end');
    expect(posLabels[0]?.getAttribute('x')).toBe(String(pos.x));
    expect(posLabels[0]?.getAttribute('y')).toBe(String(pos.y));
  });

  it('sets the low2 shift vector on tape 2 as a neck-axis (dy) translate, dx 0', () => {
    const { svg } = renderVertical({ ...ALL_OFF, tapes: true });
    const band2 = Array.from(svg.querySelectorAll('g.tape > g.tape-band'))[1];
    // Vertical: the +4↔+3 slide runs along the neck (y) — dx must be 0, dy the
    // neckPos(3)−neckPos(4) displacement on this axis.
    const dy = layout.dotCenter(0, 3).cy - layout.dotCenter(0, 4).cy;
    const style = band2?.getAttribute('style') ?? '';
    expect(style).toContain('--low2-dx: 0px');
    expect(style).toContain(`--low2-dy: ${String(dy)}px`);
  });
});

// S17 ph B (#84): the HORIZONTAL low2 shift vector must be byte-identical to the
// pre-existing translateX(-44px) — dx = neckPos(3)−neckPos(4) = -44, dy = 0.
describe('RefLayers horizontal low2 shift vector (§7.5 — byte-identical to -44px)', () => {
  const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });

  it('sets --low2-dx: -44px and --low2-dy: 0px on tape 2', () => {
    const { container } = render(
      <svg>
        <RefLayers refs={{ ...ALL_OFF, tapes: true }} layout={layout} orientation="horizontal" />
      </svg>,
    );
    const band2 = Array.from(container.querySelectorAll('g.tape > g.tape-band'))[1];
    const style = band2?.getAttribute('style') ?? '';
    expect(layout.dotCenter(0, 3).cx - layout.dotCenter(0, 4).cx).toBe(-44);
    expect(style).toContain('--low2-dx: -44px');
    expect(style).toContain('--low2-dy: 0px');
  });
});
