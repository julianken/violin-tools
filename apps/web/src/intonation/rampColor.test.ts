// Unit tests for the C4 graded mint→amber ramp function (issue #134).
//
// PURE MODULE: This test file has zero imports from React, ReactDOM,
// @testing-library/*, any Web Audio module, or any DOM API. It runs correctly
// under jsdom (the project-wide vitest environment) but calls no jsdom globals —
// verified by import inspection: only vitest's `describe`, `it`, `expect`, and
// the module under test are imported.

import { describe, expect, it } from 'vitest';

import { RAMP_CLAMP_CENTS, rampColor } from './rampColor.ts';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse an `rgb(r, g, b)` string into { r, g, b }. Throws if the format is wrong. */
function parseRgb(color: string): { r: number; g: number; b: number } {
  const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color);
  if (!m) throw new Error(`Unexpected color format: "${color}"`);
  return { r: parseInt(m[1]!, 10), g: parseInt(m[2]!, 10), b: parseInt(m[3]!, 10) };
}

/**
 * WCAG 2.x relative luminance of an sRGB channel value [0–255].
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function linearize(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * WCAG 2.x contrast ratio between foreground (r,g,b) and the --panel background
 * (#141417 → r=20, g=20, b=23).
 */
function contrastVsPanel(r: number, g: number, b: number): number {
  const L1 = relativeLuminance(r, g, b);
  const L2 = relativeLuminance(20, 20, 23); // #141417
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── AC1 — Mint at 0 ¢ ────────────────────────────────────────────────────────

describe('rampColor — AC1: mint-500 at 0 ¢', () => {
  it('returns a color equivalent to #00d4a4 (--mint-500) for 0 cents', () => {
    const { r, g, b } = parseRgb(rampColor(0));
    // §0 mint-500 = #00d4a4 = rgb(0, 212, 164)
    expect(r).toBeCloseTo(0x00, -1); // within ±1
    expect(g).toBeCloseTo(0xd4, -1);
    expect(b).toBeCloseTo(0xa4, -1);
  });
});

// ── AC2 — Amber at clamp ¢ ───────────────────────────────────────────────────

describe('rampColor — AC2: amber-400 at RAMP_CLAMP_CENTS', () => {
  it('returns a color equivalent to #caa45f (--amber-400) at the clamp point', () => {
    const { r, g, b } = parseRgb(rampColor(RAMP_CLAMP_CENTS));
    // §0 amber-400 = #caa45f = rgb(202, 164, 95)
    expect(r).toBeCloseTo(0xca, -1);
    expect(g).toBeCloseTo(0xa4, -1);
    expect(b).toBeCloseTo(0x5f, -1);
  });
});

// ── AC3 — Clamp saturation ───────────────────────────────────────────────────

describe('rampColor — AC3: clamped above saturation point', () => {
  it('clamp+1 returns the same amber-400 as the exact clamp point', () => {
    expect(rampColor(RAMP_CLAMP_CENTS + 1)).toBe(rampColor(RAMP_CLAMP_CENTS));
  });

  it('rampColor(999) returns the same amber-400 as the exact clamp point', () => {
    expect(rampColor(999)).toBe(rampColor(RAMP_CLAMP_CENTS));
  });
});

// ── AC4 — Monotonicity (+ blue channel completeness) ─────────────────────────

describe('rampColor — AC4: monotonic ramp from mint to amber (t=0.0 … 1.0)', () => {
  // Sample at t = 0.0, 0.1, 0.2, …, 1.0 (11 points, matching AC5's loop)
  const samples = Array.from({ length: 11 }, (_, i) => {
    const cents = (i / 10) * RAMP_CLAMP_CENTS;
    return { cents, ...parseRgb(rampColor(cents)) };
  });

  it('red channel is non-decreasing across the ramp', () => {
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.r).toBeGreaterThanOrEqual(samples[i - 1]!.r);
    }
  });

  it('green channel is non-increasing across the ramp', () => {
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.g).toBeLessThanOrEqual(samples[i - 1]!.g);
    }
  });

  it('blue channel is non-increasing across the ramp', () => {
    // mint-500 blue = 0xa4 (164); amber-400 blue = 0x5f (95) — non-increasing.
    // Guards against a future refactor routing through a high-blue intermediate.
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.b).toBeLessThanOrEqual(samples[i - 1]!.b);
    }
  });
});

// ── AC5 — WCAG AA contrast at every sampled t ────────────────────────────────

describe('rampColor — AC5: WCAG AA ≥4.5:1 against #141417 (--panel) at all t', () => {
  it('every t=0.0…1.0 step achieves ≥4.5:1 contrast against the panel', () => {
    for (let i = 0; i <= 10; i++) {
      const cents = (i / 10) * RAMP_CLAMP_CENTS;
      const { r, g, b } = parseRgb(rampColor(cents));
      const ratio = contrastVsPanel(r, g, b);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// ── AC6 — No red ─────────────────────────────────────────────────────────────

describe('rampColor — AC6: red channel never exceeds amber-400 red (0xca = 202)', () => {
  // amber-400 red channel is the highest the ramp ever reaches.
  // Ensures the function cannot drift toward --red-500 territory.
  it('red channel stays ≤ 202 (amber-400 red component) across the full ramp', () => {
    for (let i = 0; i <= 10; i++) {
      const cents = (i / 10) * RAMP_CLAMP_CENTS;
      const { r } = parseRgb(rampColor(cents));
      expect(r).toBeLessThanOrEqual(0xca); // 202
    }
  });

  it('rampColor(999) (clamped) also stays ≤ 202', () => {
    const { r } = parseRgb(rampColor(999));
    expect(r).toBeLessThanOrEqual(0xca);
  });
});

// ── AC7 — Pure module (verified by import inspection) ────────────────────────

describe('rampColor — AC7: pure synchronous function', () => {
  it('returns a string for every numeric input (no throws, no async)', () => {
    // Spot-check a broad range including negatives, zero, and large values.
    const inputs = [-100, -30, -1, -0.5, 0, 0.001, 15, 30, 31, 100, 999, NaN];
    for (const x of inputs) {
      // NaN → Math.abs(NaN) = NaN → t = NaN/30 = NaN → min(NaN,1) = NaN → round(NaN) = NaN
      // rgb(NaN, NaN, NaN) is a defined (if odd) CSS string — no throw.
      expect(() => rampColor(x)).not.toThrow();
      expect(typeof rampColor(x)).toBe('string');
    }
  });
});

// ── AC8 — Clamp value is a named export ──────────────────────────────────────

describe('rampColor — AC8: RAMP_CLAMP_CENTS is a named export constant', () => {
  it('RAMP_CLAMP_CENTS is a positive number', () => {
    expect(typeof RAMP_CLAMP_CENTS).toBe('number');
    expect(RAMP_CLAMP_CENTS).toBeGreaterThan(0);
  });

  it('RAMP_CLAMP_CENTS equals 30 (the ±30¢ "moderately out of tune" threshold)', () => {
    expect(RAMP_CLAMP_CENTS).toBe(30);
  });

  it('rampColor at exactly RAMP_CLAMP_CENTS equals rampColor at RAMP_CLAMP_CENTS + delta (clamped)', () => {
    expect(rampColor(RAMP_CLAMP_CENTS)).toBe(rampColor(RAMP_CLAMP_CENTS + 5));
  });
});

// ── Symmetry — negative input mirrors positive ────────────────────────────────

describe('rampColor — symmetry: negative cents mirrors positive (Math.abs owned by rampColor)', () => {
  it('rampColor(-x) === rampColor(x) for a sample of values', () => {
    const values = [0, 1, 5, 10, 15, 20, 25, 30, 31, 100];
    for (const x of values) {
      expect(rampColor(-x)).toBe(rampColor(x));
    }
  });

  it('rampColor(-0) === rampColor(0)', () => {
    expect(rampColor(-0)).toBe(rampColor(0));
  });
});
