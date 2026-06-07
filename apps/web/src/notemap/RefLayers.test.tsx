import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type RefsState } from '../state/controls';

import { RefLayers } from './RefLayers';
import { xOf } from './geometry';
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
