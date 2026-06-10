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
  resolveWindowAdvance,
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

// ── window advance logic (pure function) ───────────────────────────────────
describe('drillWindow — windowStartFor', () => {
  it('initial position (offset 0) → windowStart 0', () => {
    expect(windowStartFor(0)).toBe(0);
  });

  it('still in position 1 (offset 4) → windowStart 0', () => {
    expect(windowStartFor(4)).toBe(0);
  });

  it('entering position 2 (offset 5) → windowStart 5', () => {
    expect(windowStartFor(5)).toBe(5);
  });

  it('mid position 2 (offset 7) → windowStart 5', () => {
    expect(windowStartFor(7)).toBe(5);
  });

  it('entering position 3 (offset 9) → windowStart 9', () => {
    expect(windowStartFor(9)).toBe(9);
  });

  it('entering position 4 (offset 13) → windowStart 10 (clamped to TOTAL-WINDOW_SIZE)', () => {
    // maxStart = 15 - 5 = 10, boundary 13 > maxStart so clamps to 10.
    expect(windowStartFor(13)).toBe(10);
  });

  it('offset 14 (last column) → windowStart 10 (clamped)', () => {
    expect(windowStartFor(14)).toBe(10);
  });
});

describe('drillWindow — resolveWindowAdvance', () => {
  it('returns null when activeOffset stays in the same window', () => {
    expect(resolveWindowAdvance(0, 2, 0)).toBeNull();
    expect(resolveWindowAdvance(2, 4, 0)).toBeNull();
  });

  it('returns new windowStart when crossing a forward boundary', () => {
    // Crossing boundary at offset 5: prev in position 1 (windowStart 0), next in position 2.
    const newStart = resolveWindowAdvance(4, 5, 0);
    expect(newStart).toBe(5);
  });

  it('returns new windowStart for the middle advance (position 2→3)', () => {
    const newStart = resolveWindowAdvance(8, 9, 5);
    expect(newStart).toBe(9);
  });

  it('reverse: returns new windowStart when dropping back below a boundary', () => {
    // Player retreats from position 2 back into position 1.
    const newStart = resolveWindowAdvance(5, 4, 5);
    expect(newStart).toBe(0);
  });

  it('no jitter: same boundary not re-fired from same direction', () => {
    // Already at windowStart 5, staying above boundary 5 — no re-frame.
    expect(resolveWindowAdvance(6, 7, 5)).toBeNull();
  });
});

describe('drillWindow — isColumnVisible', () => {
  it('column inside the window is visible', () => {
    expect(isColumnVisible(2, 0)).toBe(true);
    expect(isColumnVisible(5, 5)).toBe(true);
    expect(isColumnVisible(9, 9)).toBe(true);
  });

  it('column outside the window is not visible', () => {
    expect(isColumnVisible(5, 0)).toBe(false); // window [0,4]
    expect(isColumnVisible(0, 5)).toBe(false); // window [5,9]
    expect(isColumnVisible(15, 10)).toBe(false); // out of range
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

  it('mid-range window returns the correct slice', () => {
    const offsets = visibleOffsets(5);
    expect(offsets).toHaveLength(DRILL_WINDOW_SIZE);
    expect(offsets[0]).toBe(5);
    expect(offsets[DRILL_WINDOW_SIZE - 1]).toBe(5 + DRILL_WINDOW_SIZE - 1);
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
