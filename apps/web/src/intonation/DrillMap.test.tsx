// DrillMap.test.tsx — C6 Vitest unit tests (issue #136).
//
// Covers the C6 acceptance criteria:
//   - Drill dots placed via axisOf dotCenter (no hardcoded coords)
//   - 'played' dots use ramp fill; 'active' dot has pulse ring (in normal motion)
//   - No red in any drill dot state
//   - Pulse ring is absent under prefers-reduced-motion: reduce
//   - Fingerboard window advance logic (pure function spot-checks)
//   - Orientation correctness (horizontal + vertical geometry assertions)
//   - No-red assertion

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { axisOf } from '../notemap/geometry';

import { DrillMap } from './DrillMap';
import type { DrillDot } from './drillTypes';
import {
  DRILL_WINDOW_SIZE,
  isColumnVisible,
  visibleOffsets,
  windowStartFor,
} from './drillWindow';
import { rampColor } from './rampColor';

// ── test helpers ───────────────────────────────────────────────────────────

function makeDot(
  overrides: Partial<DrillDot> & Pick<DrillDot, 'stringIndex' | 'columnOffset'>,
): DrillDot {
  return {
    letter: 'A',
    rampColor: rampColor(10),
    state: 'pending',
    ...overrides,
  };
}

function renderDrillMap(dots: readonly DrillDot[], props?: Partial<Parameters<typeof DrillMap>[0]>) {
  const { container } = render(
    <svg>
      <DrillMap dots={dots} {...props} />
    </svg>,
  );
  const svg = container.querySelector('svg');
  if (svg === null) throw new Error('no svg host');
  return svg;
}

// ── dot-placement spot-check ───────────────────────────────────────────────
describe('DrillMap — dot placement (axisOf)', () => {
  it('places dots at coordinates matching axisOf.dotCenter for horizontal+fit', () => {
    const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });
    const dots: DrillDot[] = [
      makeDot({ stringIndex: 0, columnOffset: 0 }),
      makeDot({ stringIndex: 1, columnOffset: 4 }),
      makeDot({ stringIndex: 3, columnOffset: 7 }),
    ];
    const svg = renderDrillMap(dots);
    const circles = Array.from(svg.querySelectorAll('circle.drill-dot-circle'));
    expect(circles).toHaveLength(dots.length);

    dots.forEach((dot, i) => {
      const { cx, cy } = layout.dotCenter(dot.stringIndex, dot.columnOffset);
      const circle = circles[i]!;
      expect(Number(circle.getAttribute('cx'))).toBeCloseTo(cx, 0);
      expect(Number(circle.getAttribute('cy'))).toBeCloseTo(cy, 0);
    });
  });

  it('places dots at coordinates matching axisOf.dotCenter for vertical+comfort', () => {
    const layout = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    const dots: DrillDot[] = [
      makeDot({ stringIndex: 2, columnOffset: 3 }),
      makeDot({ stringIndex: 0, columnOffset: 9 }),
    ];
    const svg = renderDrillMap(dots, { orientation: 'vertical', density: 'comfort' });
    const circles = Array.from(svg.querySelectorAll('circle.drill-dot-circle'));

    dots.forEach((dot, i) => {
      const { cx, cy } = layout.dotCenter(dot.stringIndex, dot.columnOffset);
      const circle = circles[i]!;
      expect(Number(circle.getAttribute('cx'))).toBeCloseTo(cx, 0);
      expect(Number(circle.getAttribute('cy'))).toBeCloseTo(cy, 0);
    });
  });
});

// ── fill colors ────────────────────────────────────────────────────────────
describe('DrillMap — fill colors', () => {
  it('played dots use the dot.rampColor fill', () => {
    const playedColor = rampColor(15);
    const dots: DrillDot[] = [
      makeDot({ stringIndex: 0, columnOffset: 2, state: 'played', rampColor: playedColor }),
    ];
    const svg = renderDrillMap(dots);
    const circle = svg.querySelector('circle.drill-dot-circle');
    expect(circle?.getAttribute('fill')).toBe(playedColor);
  });

  it('pending dots use the default pendingFill (var(--in-scale-fill))', () => {
    const dots: DrillDot[] = [
      makeDot({ stringIndex: 0, columnOffset: 1, state: 'pending' }),
    ];
    const svg = renderDrillMap(dots);
    const circle = svg.querySelector('circle.drill-dot-circle');
    expect(circle?.getAttribute('fill')).toBe('var(--in-scale-fill)');
  });

  it('active dots use the pendingFill (the pulse ring distinguishes it)', () => {
    const dots: DrillDot[] = [
      makeDot({ stringIndex: 1, columnOffset: 3, state: 'active' }),
    ];
    const svg = renderDrillMap(dots);
    const circle = svg.querySelector('circle.drill-dot-circle');
    // Active dots also use pendingFill — the pulse ring is the visual distinction.
    expect(circle?.getAttribute('fill')).toBe('var(--in-scale-fill)');
  });
});

// ── no-red assertion ───────────────────────────────────────────────────────
describe('DrillMap — no red in any dot state', () => {
  /** Parse a CSS color string and return the red channel, or null if not rgb(). */
  function redChannel(color: string | null | undefined): number | null {
    if (!color) return null;
    const m = /^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)/.exec(color);
    return m ? parseInt(m[1]!, 10) : null;
  }

  it('no drill-dot-circle fill is a red-hue hex or danger token', () => {
    // Build dots with all states and a range of ramp colors.
    const dots: DrillDot[] = [
      makeDot({ stringIndex: 0, columnOffset: 0, state: 'pending' }),
      makeDot({ stringIndex: 1, columnOffset: 1, state: 'active' }),
      makeDot({ stringIndex: 2, columnOffset: 2, state: 'played', rampColor: rampColor(0) }),
      makeDot({ stringIndex: 3, columnOffset: 3, state: 'played', rampColor: rampColor(15) }),
      makeDot({ stringIndex: 0, columnOffset: 4, state: 'played', rampColor: rampColor(30) }),
    ];
    const svg = renderDrillMap(dots);
    const circles = Array.from(svg.querySelectorAll('circle.drill-dot-circle'));
    for (const circle of circles) {
      const fill = circle.getAttribute('fill') ?? '';
      // Must not be the danger token.
      expect(fill).not.toContain('danger');
      // Must not be a raw red hex (#ff...).
      expect(fill.toLowerCase()).not.toMatch(/^#[ef][0-9a-f]{5}$/);
      // If it is an rgb() value, the red channel must be ≤ 202 (amber-400 red max).
      // Use 203 as the upper bound (> 202 fails); non-rgb fills return null → 0.
      const r = redChannel(fill) ?? 0;
      expect(r).toBeLessThanOrEqual(202);
    }
  });
});

// ── pulse ring ────────────────────────────────────────────────────────────
// jsdom does not implement window.matchMedia; we define it on window before
// rendering the component so the guard in DrillMap reads the mock value.
describe('DrillMap — pulse ring', () => {
  it('renders a drill-pulse ring on the active dot in normal motion', () => {
    // matchMedia → not-reduced.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    const dots: DrillDot[] = [
      makeDot({ stringIndex: 0, columnOffset: 0, state: 'active' }),
    ];
    const svg = renderDrillMap(dots);
    const pulseRing = svg.querySelector('.is-active .drill-pulse');
    expect(pulseRing).not.toBeNull();
    // Reset.
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: undefined });
  });

  it('omits the drill-pulse element under prefers-reduced-motion: reduce', () => {
    // matchMedia → reduced.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    const dots: DrillDot[] = [
      makeDot({ stringIndex: 0, columnOffset: 0, state: 'active' }),
    ];
    const svg = renderDrillMap(dots);
    const pulseRings = svg.querySelectorAll('.drill-pulse');
    // The element must be absent (not just invisible).
    expect(pulseRings).toHaveLength(0);
    // Reset.
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: undefined });
  });
});

// ── window-start logic (pure function) ──────────────────────────────────────
// The window is anchored at the open end through first position and advances to
// the upper neck only when the active target climbs to col ≥ 9. With a 9-column
// window the only two discrete positions are windowStart 0 (cols 0–8) and the
// clamped upper anchor windowStart 6 (cols 6–14).
describe('drillWindow — windowStartFor', () => {
  it('open (offset 0) → windowStart 0', () => {
    expect(windowStartFor(0)).toBe(0);
  });

  it('first position (offset 4) → windowStart 0', () => {
    expect(windowStartFor(4)).toBe(0);
  });

  it('3rd-finger reach (offset 5) stays open-anchored → windowStart 0', () => {
    // The regression: C4 (3rd finger on G) sits at columnOffset 5 and must NOT
    // shove the window off the open end — the nut stays visible (issue: the
    // drill re-framed on the very first target and overlapped the open chrome).
    expect(windowStartFor(5)).toBe(0);
  });

  it('4th-finger reach (offset 8, last first-position column) → windowStart 0', () => {
    expect(windowStartFor(8)).toBe(0);
  });

  it('entering the upper neck (offset 9) → windowStart 6 (clamped)', () => {
    // anchor 9, maxStart = 15 - 9 = 6, so the upper window clamps to 6 → cols 6–14.
    expect(windowStartFor(9)).toBe(6);
  });

  it('high on the E string (offset 12, e.g. E6) → windowStart 6', () => {
    expect(windowStartFor(12)).toBe(6);
  });

  it('offset 14 (last column) → windowStart 6 (clamped)', () => {
    expect(windowStartFor(14)).toBe(6);
  });
});

describe('drillWindow — isColumnVisible', () => {
  it('column inside the window is visible', () => {
    expect(isColumnVisible(2, 0)).toBe(true); // open window [0,8]
    expect(isColumnVisible(8, 0)).toBe(true); // last of the open window
    expect(isColumnVisible(14, 6)).toBe(true); // last of the upper window [6,14]
  });

  it('column outside the window is not visible', () => {
    expect(isColumnVisible(9, 0)).toBe(false); // window [0,8]
    expect(isColumnVisible(5, 6)).toBe(false); // window [6,14]
    expect(isColumnVisible(15, 6)).toBe(false); // out of range
  });

  it('edge cases: first and last column in window', () => {
    expect(isColumnVisible(0, 0)).toBe(true);
    expect(isColumnVisible(DRILL_WINDOW_SIZE - 1, 0)).toBe(true);
    expect(isColumnVisible(DRILL_WINDOW_SIZE, 0)).toBe(false);
  });
});

describe('drillWindow — visibleOffsets', () => {
  it('returns exactly DRILL_WINDOW_SIZE offsets starting from windowStart', () => {
    const offsets = visibleOffsets(0);
    expect(offsets).toHaveLength(DRILL_WINDOW_SIZE);
    expect(offsets[0]).toBe(0);
    expect(offsets[DRILL_WINDOW_SIZE - 1]).toBe(DRILL_WINDOW_SIZE - 1);
  });

  it('upper-neck window returns the correct slice', () => {
    const offsets = visibleOffsets(6);
    expect(offsets).toHaveLength(DRILL_WINDOW_SIZE);
    expect(offsets[0]).toBe(6);
    expect(offsets[DRILL_WINDOW_SIZE - 1]).toBe(6 + DRILL_WINDOW_SIZE - 1);
  });
});

// ── orientation correctness ────────────────────────────────────────────────
describe('DrillMap — orientation correctness', () => {
  it('horizontal + vertical renders produce geometry consistent with axisOf', () => {
    const dot: DrillDot = makeDot({ stringIndex: 1, columnOffset: 3 });

    // Horizontal
    const hLayout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });
    const hSvg = renderDrillMap([dot], { orientation: 'horizontal', handedness: 'right', density: 'fit' });
    const hCircle = hSvg.querySelector('circle.drill-dot-circle');
    const { cx: hCx, cy: hCy } = hLayout.dotCenter(1, 3);
    expect(Number(hCircle?.getAttribute('cx'))).toBeCloseTo(hCx, 0);
    expect(Number(hCircle?.getAttribute('cy'))).toBeCloseTo(hCy, 0);

    // Vertical
    const vLayout = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    const vSvg = renderDrillMap([dot], { orientation: 'vertical', handedness: 'right', density: 'comfort' });
    const vCircle = vSvg.querySelector('circle.drill-dot-circle');
    const { cx: vCx, cy: vCy } = vLayout.dotCenter(1, 3);
    expect(Number(vCircle?.getAttribute('cx'))).toBeCloseTo(vCx, 0);
    expect(Number(vCircle?.getAttribute('cy'))).toBeCloseTo(vCy, 0);

    // The two placements must differ (the axes have different coordinate systems).
    expect(hCx).not.toBeCloseTo(vCx, 0);
  });
});

// ── §12.2 column-0 string-name scheme (issue #180) ──────────────────────────
// The string name renders at the open slot iff no dot occupies it. DrillMap
// draws no open dots of its own, so occupancy is a PLAN-LEVEL test over the
// whole `dots` array (never window visibility): a string whose plan includes a
// columnOffset-0 target shows that target dot and NO name; every other string
// shows its name pinned in the fixed chrome (outside the .drill-window group).
describe('DrillMap — column-0 string-name scheme (§12.2, issue #180)', () => {
  it('renders all four names when no target sits at column 0', () => {
    const svg = renderDrillMap([
      makeDot({ stringIndex: 1, columnOffset: 4 }),
      makeDot({ stringIndex: 2, columnOffset: 7 }),
    ]);
    const names = Array.from(svg.querySelectorAll('text.string-name'));
    expect(names.map((n) => n.textContent).sort()).toEqual(['A4', 'D4', 'E5', 'G3']);
  });

  it('suppresses ONLY the occupied string name when the plan holds a column-0 target', () => {
    // A-major-drill shape: the open-A target occupies (string A4 = index 1, col 0).
    const svg = renderDrillMap([
      makeDot({ stringIndex: 1, columnOffset: 0 }),
      makeDot({ stringIndex: 1, columnOffset: 2 }),
    ]);
    const names = Array.from(svg.querySelectorAll('text.string-name'));
    expect(names.map((n) => n.textContent).sort()).toEqual(['D4', 'E5', 'G3']);
  });

  it('anchors each name at dotCenter(i, 0) + the 4px label baseline (vertical comfort)', () => {
    const layout = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    const svg = renderDrillMap([], { orientation: 'vertical', density: 'comfort' });
    const byText = new Map(
      Array.from(svg.querySelectorAll('text.string-name')).map((n) => [n.textContent, n]),
    );
    // STRINGS order is E5/A4/D4/G3 (index 0..3); spot-check the two extremes.
    const e5 = layout.dotCenter(0, 0);
    expect(byText.get('E5')?.getAttribute('x')).toBe(String(e5.cx));
    expect(byText.get('E5')?.getAttribute('y')).toBe(String(e5.cy + 4));
    const g3 = layout.dotCenter(3, 0);
    expect(byText.get('G3')?.getAttribute('x')).toBe(String(g3.cx));
    expect(byText.get('G3')?.getAttribute('y')).toBe(String(g3.cy + 4));
  });

  it('open-end chrome is absent once the window advances off the open column', () => {
    // Active target at column 12 (high on the E string) advances the window into
    // the upper neck (windowStart 6) — the open column scrolls off screen, so the
    // string names, nut, and "open" label are absent rather than mislabeling the
    // scrolled dots. (Which strings would carry a name is the SEPARATE plan-level
    // rule above; this is the rule that the open-end chrome shows only while the
    // open column is on screen — §18.2.)
    const svg = renderDrillMap([
      makeDot({ stringIndex: 1, columnOffset: 0, state: 'played' }),
      makeDot({ stringIndex: 1, columnOffset: 12, state: 'active' }),
    ]);
    expect(svg.querySelectorAll('text.string-name')).toHaveLength(0);
    expect(svg.querySelector('rect.nut')).toBeNull();
    expect(svg.querySelector('text.open-label')).toBeNull();
  });

  it('names live in the fixed chrome group, never the translated .drill-window group', () => {
    // Low active target → window anchored at the open end → names render; assert
    // they are pinned in the fixed chrome group, outside the translated window.
    const svg = renderDrillMap([
      makeDot({ stringIndex: 1, columnOffset: 4, state: 'active' }),
    ]);
    const names = Array.from(svg.querySelectorAll('text.string-name'));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.closest('g.chrome')).not.toBeNull();
      expect(name.closest('g.drill-window')).toBeNull();
    }
  });
});

// ── fingerboard window — rendered geometry (regression for the open-string ───
// overlap + left-edge cutoff). These render the component and assert the RESOLVED
// dot positions (cx/cy plus the .drill-window translate) — the gap the original
// tests missed by checking only the untranslated circle attribute or pure window
// math, never the rendered geometry through the translate.

/** Parse a `translate(tx, ty)` transform attribute → {tx, ty} (identity if absent). */
function parseTranslate(transform: string | null): { tx: number; ty: number } {
  if (transform === null) return { tx: 0, ty: 0 };
  const m = /translate\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/.exec(transform);
  if (m === null) return { tx: 0, ty: 0 };
  return { tx: Number(m[1] ?? '0'), ty: Number(m[2] ?? '0') };
}

/** Resolved (translated) centers of every drill dot circle in the rendered SVG. */
function resolvedDotCenters(svg: SVGSVGElement): { cx: number; cy: number }[] {
  const windowG = svg.querySelector('g.drill-window');
  const { tx, ty } = parseTranslate(windowG?.getAttribute('transform') ?? null);
  return Array.from(svg.querySelectorAll('circle.drill-dot-circle'), (c) => ({
    cx: Number(c.getAttribute('cx')) + tx,
    cy: Number(c.getAttribute('cy')) + ty,
  }));
}

/** Assert a real clipPath exists and a group references it. */
function expectWindowClip(svg: SVGSVGElement): void {
  const clipEl = svg.querySelector('[id^="drill-window-clip"]');
  expect(clipEl).not.toBeNull();
  const clipId = clipEl?.getAttribute('id') ?? '';
  expect(svg.querySelector(`[clip-path="url(#${clipId})"]`)).not.toBeNull();
}

describe('DrillMap — fingerboard window regression (rendered geometry)', () => {
  it('a first-position active target does not translate, overlap the open chrome, or clip a dot off-canvas', () => {
    // Mirrors the reported bug: C harmonic minor at target 1 — active C4 sits at
    // columnOffset 5 (3rd finger on the G string), the open D4 occupies column 0,
    // plus a spread of pending dots. Pre-fix the window translated −230px, sliding
    // the column-5 dots onto the pinned open-string names (overlap) and a column-4
    // dot off the left edge (cutoff). Post-fix the window stays open-anchored.
    const dots: DrillDot[] = [
      makeDot({ stringIndex: 2, columnOffset: 0, state: 'pending' }), // open D4
      makeDot({ stringIndex: 3, columnOffset: 5, state: 'active' }), // C4 (active)
      makeDot({ stringIndex: 2, columnOffset: 6, state: 'pending' }),
      makeDot({ stringIndex: 0, columnOffset: 4, state: 'pending' }), // the pre-fix cutoff dot
      makeDot({ stringIndex: 0, columnOffset: 8, state: 'pending' }),
    ];
    const svg = renderDrillMap(dots);

    // The window stays anchored at the open end → identity translate.
    const windowG = svg.querySelector('g.drill-window');
    expect(parseTranslate(windowG?.getAttribute('transform') ?? null)).toEqual({ tx: 0, ty: 0 });

    // No dot resolves onto a pinned open-string name (no open-string overlap).
    // Names sit at dotCenter(i,0) + a 4px label baseline, so compare against cy+4.
    const names = Array.from(svg.querySelectorAll('text.string-name'), (n) => ({
      x: Number(n.getAttribute('x')),
      y: Number(n.getAttribute('y')),
    }));
    const dotCenters = resolvedDotCenters(svg);
    for (const d of dotCenters) {
      for (const n of names) {
        const coincides = Math.abs(d.cx - n.x) < 1 && Math.abs(d.cy + 4 - n.y) < 1;
        expect(coincides).toBe(false);
      }
    }

    // No dot is clipped off the left edge (every resolved cx ≥ 0).
    for (const d of dotCenters) {
      expect(d.cx).toBeGreaterThanOrEqual(0);
    }

    // A real clipPath bounds the window.
    expectWindowClip(svg);
  });

  it('an upper-neck active target advances the window, hides the open-end chrome, and keeps the active dot in view', () => {
    const dots: DrillDot[] = [
      makeDot({ stringIndex: 1, columnOffset: 0, state: 'played' }), // open A4 (off-window)
      makeDot({ stringIndex: 0, columnOffset: 11, state: 'active' }), // high on the E string
    ];
    const svg = renderDrillMap(dots);

    // Window advanced into the upper neck (windowStart 6) → non-identity translate.
    const windowG = svg.querySelector('g.drill-window');
    const { tx } = parseTranslate(windowG?.getAttribute('transform') ?? null);
    expect(tx).toBeLessThan(0);

    // Open-end chrome is absent (no open column on screen).
    expect(svg.querySelectorAll('text.string-name')).toHaveLength(0);
    expect(svg.querySelector('rect.nut')).toBeNull();
    expect(svg.querySelector('text.open-label')).toBeNull();

    // The clip is present and the active dot resolves into the visible band.
    expectWindowClip(svg);
    const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });
    const activeRaw = layout.dotCenter(0, 11);
    expect(activeRaw.cx + tx).toBeGreaterThanOrEqual(0);
  });
});
