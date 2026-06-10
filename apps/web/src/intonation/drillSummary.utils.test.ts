/**
 * drillSummary.utils.test.ts — pure utility tests for the DrillSummary (C8/#138).
 * These run in jsdom but import no React, no DOM, and no audio — pure functions only.
 * DESIGN.md wins on any conflict (AGENTS.md).
 */

import { describe, expect, it } from 'vitest';

import {
  deriveTendency,
  farthestResult,
  formatSignedCents,
  meanAbsCents,
} from './drillSummary.utils.ts';
import { type DrillTarget, type NoteResult } from './intonation.types.ts';

// ── Fixtures ───────────────────────────────────────────────────────────────

/** Build a minimal DrillTarget plan of the given length. */
function makePlan(length: number): readonly DrillTarget[] {
  return Array.from({ length }, (_, i) => ({
    index: i,
    midiNote: 60 + i,
    hz: 261.63 * Math.pow(2, i / 12),
    degreeLabel: `Note${String(i)}`,
  }));
}

/** Build a NoteResult with a given targetIndex and medianCents. */
function makeResult(targetIndex: number, medianCents: number): NoteResult {
  return { targetIndex, intendedHz: 440, medianCents, frameCount: 10 };
}

// A symmetric 2-octave plan has peakIndex = Math.floor(plan.length / 2).
// With plan.length = 29, peakIndex = 14.
const PLAN_29 = makePlan(29);

// ── deriveTendency ─────────────────────────────────────────────────────────

describe('deriveTendency — returns null when no signal', () => {
  it('returns null for an empty results array', () => {
    expect(deriveTendency([], PLAN_29)).toBeNull();
  });

  it('returns null when mean is within ±5 ¢ (no tendency)', () => {
    const results = [
      makeResult(0, 4),
      makeResult(1, -4),
      makeResult(2, 2),
    ];
    expect(deriveTendency(results, PLAN_29)).toBeNull();
  });

  it('returns null when mean is exactly 0', () => {
    const results = [makeResult(0, 5), makeResult(1, -5)];
    expect(deriveTendency(results, PLAN_29)).toBeNull();
  });
});

describe('deriveTendency — sharp tendency', () => {
  it('returns a non-null sharp statement when all results are uniformly sharp', () => {
    const results = [
      makeResult(0, 12),
      makeResult(1, 14),
      makeResult(2, 11),
    ];
    const result = deriveTendency(results, PLAN_29);
    expect(result).not.toBeNull();
    expect(result).toMatch(/sharp/i);
  });

  it('contains the avg value in the statement', () => {
    const results = [makeResult(0, 12), makeResult(1, 12), makeResult(2, 12)];
    const result = deriveTendency(results, PLAN_29);
    expect(result).toContain('12');
  });
});

describe('deriveTendency — flat tendency', () => {
  it('returns a non-null flat statement when all results are uniformly flat', () => {
    const results = [
      makeResult(0, -10),
      makeResult(1, -8),
      makeResult(2, -12),
    ];
    const result = deriveTendency(results, PLAN_29);
    expect(result).not.toBeNull();
    expect(result).toMatch(/flat/i);
  });
});

describe('deriveTendency — ascending sub-tendency', () => {
  it('reports ascending-specific tendency when ascending half is sharp and ≥ 3 results', () => {
    // Ascending half: indices 0–14 (peakIndex = 14 for plan of 29)
    // We give 3+ ascending results all sharply above threshold,
    // and only 1 descending result (not enough for sub-tendency).
    const results = [
      makeResult(0, 15),
      makeResult(3, 18),
      makeResult(7, 20),
      // One descending result, not enough to trigger descending sub-tendency
      makeResult(20, 8),
    ];
    const result = deriveTendency(results, PLAN_29);
    expect(result).not.toBeNull();
    expect(result?.toLowerCase()).toMatch(/ascending/);
  });
});

describe('deriveTendency — §13 voice: no judgmental vocabulary', () => {
  // The tendency statement must never contain words that imply the player
  // made a mistake. This is a regression guard against future LLM-generated
  // tendency-line regressions.
  const JUDGMENTAL_WORDS = ['wrong', 'bad', 'mistake', 'error', 'fail', 'incorrect'];

  it('contains no judgmental vocabulary in a sharp tendency', () => {
    const results = [makeResult(0, 12), makeResult(1, 15), makeResult(2, 11)];
    const tendency = deriveTendency(results, PLAN_29) ?? '';
    for (const word of JUDGMENTAL_WORDS) {
      expect(tendency.toLowerCase()).not.toContain(word);
    }
  });

  it('contains no judgmental vocabulary in a flat tendency', () => {
    const results = [makeResult(0, -12), makeResult(1, -15), makeResult(2, -11)];
    const tendency = deriveTendency(results, PLAN_29) ?? '';
    for (const word of JUDGMENTAL_WORDS) {
      expect(tendency.toLowerCase()).not.toContain(word);
    }
  });
});

describe('deriveTendency — custom threshold', () => {
  it('respects a custom threshold of 10 ¢ (does not trigger at 7 ¢)', () => {
    const results = [makeResult(0, 7), makeResult(1, 7), makeResult(2, 7)];
    expect(deriveTendency(results, PLAN_29, 10)).toBeNull();
  });

  it('respects a custom threshold of 10 ¢ (triggers at 12 ¢)', () => {
    const results = [makeResult(0, 12), makeResult(1, 12), makeResult(2, 12)];
    expect(deriveTendency(results, PLAN_29, 10)).not.toBeNull();
  });
});

// ── meanAbsCents ───────────────────────────────────────────────────────────

describe('meanAbsCents', () => {
  it('returns 0 for an empty array', () => {
    expect(meanAbsCents([])).toBe(0);
  });

  it('computes the mean of absolute values (not signed)', () => {
    const results = [makeResult(0, -10), makeResult(1, 10)];
    // Both are |10| → mean is 10, not 0.
    expect(meanAbsCents(results)).toBeCloseTo(10, 5);
  });

  it('handles a single result', () => {
    expect(meanAbsCents([makeResult(0, 7)])).toBeCloseTo(7, 5);
  });
});

// ── farthestResult ─────────────────────────────────────────────────────────

describe('farthestResult', () => {
  it('returns null for an empty array', () => {
    expect(farthestResult([])).toBeNull();
  });

  it('returns the result with the largest |medianCents|', () => {
    const results = [
      makeResult(0, 5),
      makeResult(1, -22),
      makeResult(2, 8),
    ];
    const worst = farthestResult(results);
    expect(worst?.targetIndex).toBe(1);
    expect(worst?.medianCents).toBe(-22);
  });

  it('handles a single-element array', () => {
    const r = makeResult(0, 12);
    expect(farthestResult([r])).toBe(r);
  });
});

// ── formatSignedCents ──────────────────────────────────────────────────────

describe('formatSignedCents', () => {
  it('formats zero as "0 ¢"', () => {
    expect(formatSignedCents(0)).toBe('0 ¢');
  });

  it('formats a positive value with a leading + sign', () => {
    expect(formatSignedCents(7)).toBe('+7 ¢');
  });

  it('formats a negative value with a U+2212 minus sign (not ASCII -)', () => {
    const result = formatSignedCents(-3);
    expect(result).toBe('−3 ¢');
    // Confirm the character is U+2212, not a hyphen-minus.
    expect(result.codePointAt(0)).toBe(0x2212);
  });

  it('rounds fractional inputs', () => {
    expect(formatSignedCents(7.6)).toBe('+8 ¢');
    expect(formatSignedCents(-3.4)).toBe('−3 ¢');
  });
});
