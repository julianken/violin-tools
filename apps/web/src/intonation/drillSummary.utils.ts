/**
 * drillSummary.utils.ts — pure utilities for the DrillSummary component.
 *
 * This file has NO React import, NO DOM reference, and NO side effects.
 * It is AC8-pure: all exports are deterministic functions over arrays.
 *
 * DESIGN.md §13 voice governs all prose output: descriptive and factual,
 * never judgmental. A deviation may be expressive intonation, not a mistake.
 * DESIGN.md wins on any conflict (AGENTS.md).
 */

import { type DrillTarget, type NoteResult } from './intonation.types.ts';

/**
 * Derive a §13-voice tendency statement from a completed drill run, or null if
 * the data does not meet the threshold.
 *
 * Algorithm:
 * 1. Compute mean signed cents across all results.
 * 2. If |mean| ≥ threshold, assert an overall tendency (sharp or flat).
 * 3. Additionally attempt ascending/descending sub-division: a result with
 *    targetIndex ≤ peakIndex is on the ascending half; > peakIndex descending.
 *    Assert a directional sub-tendency only if ≥ 3 results exist on that half
 *    AND its mean clears the threshold — if so, report the more specific form.
 * 4. Return a single §13 sentence, or null if the threshold is not met.
 *
 * The threshold defaults to 5¢ (the in-tune window from DESIGN.md §17.2).
 *
 * @param results  Scored targets (readonly; may be empty or partial).
 * @param plan     Full drill plan — used to derive ascending vs. descending.
 * @param threshold Minimum |mean cents| to assert a tendency (default 5).
 */
export function deriveTendency(
  results: readonly NoteResult[],
  plan: readonly DrillTarget[],
  threshold = 5,
): string | null {
  if (results.length === 0) return null;

  const total = results.length;
  const sum = results.reduce((acc, r) => acc + r.medianCents, 0);
  const mean = sum / total;

  // No dominant tendency if within the threshold window.
  if (Math.abs(mean) < threshold) return null;

  const direction = mean > 0 ? 'sharp' : 'flat';
  const sign = mean > 0 ? '+' : '−';
  const absMeanFormatted = `${sign}${Math.abs(mean).toFixed(0)} ¢`;

  // Attempt ascending/descending sub-division.
  if (plan.length > 0) {
    const peakIndex = Math.floor(plan.length / 2);

    const ascending = results.filter((r) => r.targetIndex <= peakIndex);
    const descending = results.filter((r) => r.targetIndex > peakIndex);

    const ascMean =
      ascending.length >= 3
        ? ascending.reduce((acc, r) => acc + r.medianCents, 0) / ascending.length
        : null;
    const descMean =
      descending.length >= 3
        ? descending.reduce((acc, r) => acc + r.medianCents, 0) / descending.length
        : null;

    // Report the more specific directional form if one half dominates and the
    // other does not. Ascending takes precedence if both halves qualify.
    if (ascMean !== null && Math.abs(ascMean) >= threshold) {
      const ascDir = ascMean > 0 ? 'sharp' : 'flat';
      const ascSign = ascMean > 0 ? '+' : '−';
      const ascFormatted = `${ascSign}${Math.abs(ascMean).toFixed(0)} ¢`;
      return `Ascending notes ran consistently ${ascDir} (${ascFormatted} avg).`;
    }
    if (descMean !== null && Math.abs(descMean) >= threshold) {
      const descDir = descMean > 0 ? 'sharp' : 'flat';
      const descSign = descMean > 0 ? '+' : '−';
      const descFormatted = `${descSign}${Math.abs(descMean).toFixed(0)} ¢`;
      return `Descending notes ran consistently ${descDir} (${descFormatted} avg).`;
    }
  }

  // Overall tendency (no meaningful directional sub-division).
  return `Notes ran consistently ${direction} overall (${absMeanFormatted} avg).`;
}

/**
 * Compute the mean of |medianCents| across all results (the "average deviation"
 * shown in the callout). Returns 0 for an empty array.
 */
export function meanAbsCents(results: readonly NoteResult[]): number {
  if (results.length === 0) return 0;
  return results.reduce((acc, r) => acc + Math.abs(r.medianCents), 0) / results.length;
}

/**
 * Find the result with the largest |medianCents|. Returns null for an empty
 * array.
 */
export function farthestResult(results: readonly NoteResult[]): NoteResult | null {
  if (results.length === 0) return null;
  return results.reduce((worst, r) =>
    Math.abs(r.medianCents) > Math.abs(worst.medianCents) ? r : worst,
  );
}

/**
 * Format a signed cents value for display: "+7 ¢", "−3 ¢", "0 ¢".
 * Uses U+2212 MINUS SIGN for negative values (matching §17.3 readout copy).
 */
export function formatSignedCents(cents: number): string {
  const rounded = Math.round(cents);
  if (rounded === 0) return '0 ¢';
  return rounded > 0 ? `+${String(rounded)} ¢` : `−${String(Math.abs(rounded))} ¢`;
}
