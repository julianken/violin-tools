// drillDots.ts — buildDrillDots mapper (§R3 / AC5 / C11, #172).
//
// Separated from IntonationView.tsx so it can be unit-tested directly without
// triggering the react-refresh/only-export-components lint rule (which fires
// when a non-component export lives in the same module as React components).

import { spell } from '@violin-tools/theory';

import type { DrillDot } from '../../intonation/drillTypes';
import { rampColor } from '../../intonation/rampColor';

/**
 * Build the DrillDot[] array from plan + results for DrillMap.
 *
 * DrillTarget has no .letter or position fields; we derive:
 *   - letter: spell(midiNote % 12, root, scale) per §R5
 *   - stringIndex / columnOffset: midiNote → violin string assignment
 *   - state: 'played' / 'active' / 'pending' from results vs currentTargetIndex
 *   - rampColor: from result.medianCents when played
 *
 * Violin string assignment (standard tuning, MIDI):
 *   G3=55, D4=62, A4=69, E5=76
 *   A note's string is the highest open string ≤ midiNote + the normal playing range.
 *   We assign to the lowest string where the columnOffset (semitones from open) ≤ 14.
 *   String indices: E5=0, A4=1, D4=2, G3=3 (the §12.1 cross-order index).
 */
export function buildDrillDots(
  plan: readonly { midiNote: number; hz: number; index: number; degreeLabel: string }[],
  results: readonly { targetIndex: number; medianCents: number | null }[],
  currentTargetIndex: number,
  root: Parameters<typeof spell>[1],
  scale: Parameters<typeof spell>[2],
): readonly DrillDot[] {
  // Build a map from targetIndex → medianCents for played targets.
  // medianCents may be null (degenerate but safe per noteTracker contract).
  const resultMap = new Map<number, number | null>();
  for (const r of results) {
    resultMap.set(r.targetIndex, r.medianCents);
  }

  return plan.map((target, i): DrillDot => {
    const letter = spell(target.midiNote % 12, root, scale);

    // Assign to violin string: highest open string where columnOffset ≤ 14
    // Standard open string MIDI: G3=55, D4=62, A4=69, E5=76
    // §12.1 string indices (low→high on neck, E5=0, A4=1, D4=2, G3=3)
    const OPEN_MIDI = [76, 69, 62, 55] as const; // E5, A4, D4, G3 → indices 0,1,2,3
    let stringIndex = 3; // default to G3
    let columnOffset = target.midiNote - 55;

    for (let si = 0; si < OPEN_MIDI.length; si++) {
      // OPEN_MIDI is a fixed-length tuple (4 items); si < OPEN_MIDI.length
      // guarantees the index is in bounds. The nullish coalesce guards the
      // noUncheckedIndexedAccess lint rule without a non-null assertion.
      const openMidi = OPEN_MIDI[si] ?? 55;
      const offset = target.midiNote - openMidi;
      if (offset >= 0 && offset <= 14) {
        stringIndex = si;
        columnOffset = offset;
        break;
      }
    }

    // Clamp columnOffset to [0, 14] for safety
    columnOffset = Math.max(0, Math.min(14, columnOffset));

    const playedEntry = resultMap.get(i);
    const isPlayed = playedEntry !== undefined;
    const isActive = !isPlayed && i === currentTargetIndex;

    const state: DrillDot['state'] = isPlayed ? 'played' : isActive ? 'active' : 'pending';
    // medianCents may be null; fall back to 0 for the ramp so null never crashes rampColor.
    const dotRampColor = isPlayed ? rampColor(playedEntry ?? 0) : 'var(--in-scale-fill)';

    return {
      stringIndex,
      columnOffset,
      letter,
      rampColor: dotRampColor,
      state,
    };
  });
}
