// drillPlan — pure Flesch 2-octave up-down target-sequence builder.
//
// Builds the ordered array of DrillTarget objects that the intonation drill's
// FSM (C3 · noteTracker) evaluates incoming pitch frames against. This module
// is entirely synchronous data construction: no React, no DOM, no Web Audio.
//
// The Flesch 2-octave shape:
//   root → top-of-2-octaves → root  (up then down, peak appears ONCE)
//
// Duplicate-endpoint policy (must match the tests):
//   - The peak note is NOT emitted twice: the last ascending note and the first
//     descending note are combined into a single entry at the peak index.
//   - The bottom root IS emitted at both the start (index 0) and the end
//     (index length−1): the Flesch pattern begins and ends on the root.
//
// Sequence length formula:
//   Let n = number of distinct intervals in the scale (= SCALE_INTERVALS[s].length).
//   Ascending 2 octaves: n*2 + 1 notes (root, 6 degrees, octave root, 6 degrees, peak root).
//   Descending 2 octaves: n*2 notes (peak shared → omit, then n*2 entries back to root).
//   Total: 4*n + 1 entries.
//   For diatonic (n=7): 29 entries; for pentatonic (n=5): 21; for chromatic (n=12): 49.
//
// Starting octave:
//   The sequence starts at the lowest violin-range octave where the root pitch
//   class sits at or above MIDI 55 (G3, the lowest violin open string). We search
//   upward until the starting MIDI note is ≥ MIDI_VIOLIN_LOW and the entire
//   2-octave span stays within MIDI_VIOLIN_HIGH (E6 = MIDI 88), falling back to
//   the highest valid start if no span fits perfectly.
//
// Expected Hz per target:
//   Derived via frequencyOfMidi(midiNote, clampA4(a4)) — the same source the
//   Tuner uses — ensuring a single A4 source of truth across the app.

import { type Root, type ScaleType, SCALE_INTERVALS, ROOT_PITCH_CLASS } from './classify.ts';
import { frequencyOfMidi, clampA4 } from './tuning.ts';

/** The lowest MIDI note on a standard violin: G3. */
const MIDI_VIOLIN_LOW = 55; // G3

/** The upper practical limit for a violin drill: E6. */
const MIDI_VIOLIN_HIGH = 88; // E6

/**
 * A single target note in a `drillPlan` sequence.
 *
 * @property index       - Zero-based position in the full up-down sequence.
 * @property midiNote    - Equal-tempered MIDI note number for this target.
 * @property hz          - Expected frequency (Hz) under the given A4 reference,
 *                         derived from `frequencyOfMidi(midiNote, clampA4(a4))`.
 * @property degreeLabel - Human-readable degree: "1" for the root, "2" for the
 *                         second scale degree, …, "8" for the octave root, etc.
 *                         Degrees above the first octave continue the count
 *                         (e.g. the 9th degree = "9"). The label is ordinal
 *                         within the ascending sequence; the same MIDI note
 *                         carries the same label on descent.
 */
export interface DrillTarget {
  readonly index: number;
  readonly midiNote: number;
  readonly hz: number;
  readonly degreeLabel: string;
}

/**
 * Build the Flesch 2-octave up-down target sequence for `root` / `scaleType`.
 *
 * @param root       - The scale root (e.g. `'A'`, `'G'`).
 * @param scaleType  - The scale type (e.g. `'major'`, `'naturalMinor'`).
 * @param a4         - The A4 reference in Hz; clamped to [A4_MIN, A4_MAX].
 * @returns          A readonly array of `DrillTarget` objects in Flesch order.
 *
 * Sequence invariants:
 *   - `targets[0].midiNote % 12 === ROOT_PITCH_CLASS[root]`   (starts on root)
 *   - `targets[n-1].midiNote % 12 === ROOT_PITCH_CLASS[root]` (ends on root)
 *   - The maximum `midiNote` in the sequence appears exactly once (peak not duplicated)
 *   - `targets.length === 4 * intervals.length + 1`
 *   - Every `target.hz === frequencyOfMidi(target.midiNote, clampA4(a4))`
 */
export function drillPlan(
  root: Root,
  scaleType: ScaleType,
  a4: number,
): readonly DrillTarget[] {
  const rootPc = ROOT_PITCH_CLASS[root];
  const intervals = SCALE_INTERVALS[scaleType];
  const a4Clamped = clampA4(a4);

  // --- Determine the starting MIDI note (lowest in-range root for this root PC) ---
  // We need the entire 2-octave ascending span to fit within the violin range.
  // The peak MIDI = startMidi + 24. So we need:
  //   startMidi >= MIDI_VIOLIN_LOW  AND  startMidi + 24 <= MIDI_VIOLIN_HIGH
  // MIDI formula: midiOf(pc, octave) = 12 * (octave + 1) + pc
  // Find the smallest octave where startMidi >= MIDI_VIOLIN_LOW and startMidi+24 <= HIGH.
  let startMidi: number | null = null;
  for (let octave = 2; octave <= 7; octave++) {
    const midi = 12 * (octave + 1) + rootPc;
    if (midi >= MIDI_VIOLIN_LOW && midi + 24 <= MIDI_VIOLIN_HIGH) {
      startMidi = midi;
      break;
    }
  }
  // Fallback: if nothing fits perfectly, use the lowest octave where start >= low
  if (startMidi === null) {
    for (let octave = 2; octave <= 7; octave++) {
      const midi = 12 * (octave + 1) + rootPc;
      if (midi >= MIDI_VIOLIN_LOW) {
        startMidi = midi;
        break;
      }
    }
  }
  // Safety guard — should never happen for any violin root (G3–E6 is 33 semitones)
  startMidi ??= MIDI_VIOLIN_LOW;

  // --- Build the ascending MIDI note list (2 octaves) ---
  // Walk through the intervals for 2 full octaves, collecting each MIDI note.
  // intervals[0] is always 0 (the root), so the pattern for one octave is:
  //   startMidi + intervals[0], startMidi + intervals[1], ..., startMidi + intervals[n-1]
  // For the second octave, offset by 12.
  // Then add the peak (startMidi + 24 = root at top of 2nd octave).
  const ascending: number[] = [];
  for (let octaveOffset = 0; octaveOffset < 2; octaveOffset++) {
    for (const interval of intervals) {
      ascending.push(startMidi + octaveOffset * 12 + interval);
    }
  }
  // Add the peak note (root 2 octaves up)
  ascending.push(startMidi + 24);

  // ascending now has 2*n + 1 notes: the full ascending sequence including peak

  // --- Build the descending list (mirror, minus the shared peak) ---
  // Descend from one step below the peak back to the start root.
  // `ascending.slice(0, -1)` drops the peak note; `.reverse()` walks back down.
  const descending: number[] = ascending.slice(0, -1).reverse();

  // --- Combine: ascending (includes peak) + descending ---
  const allMidi = [...ascending, ...descending];
  // Total length: (2n+1) + (2n) = 4n+1 ✓

  // --- Build degree labels ---
  // Ascending degrees run 1, 2, ..., n, n+1, n+2, ..., 2n, 2n+1
  // On descent the degree labels mirror (we re-use the ascending label for the same MIDI).
  // Build a map from MIDI note to its degree label (using the ascending assignment).
  // Since the same MIDI can repeat in enharmonic edge cases (it won't in standard scales,
  // but we be safe), we map by position in the ascending list.
  const ascendingLabels: string[] = ascending.map((_, i) => String(i + 1));
  // For descending positions, find the corresponding ascending index.
  // ascending[i] and descending[j] = ascending[2n - 1 - j], so label = String(2n - j)
  const descendingLabels: string[] = descending.map(
    (_, j) => String(ascending.length - 1 - j),
  );

  const allLabels = [...ascendingLabels, ...descendingLabels];

  // --- Map to DrillTarget ---
  return allMidi.map((midiNote, index): DrillTarget => {
    return {
      index,
      midiNote,
      hz: frequencyOfMidi(midiNote, a4Clamped),
      degreeLabel: allLabels[index] ?? String(index + 1),
    };
  });
}
