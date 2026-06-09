// Tuning math — the pure equal-temperament arithmetic the Tuner (S18) consumes.
//
// This module converts between frequency (Hz) and a musical reading (nearest
// note, octave, signed cents) against an adjustable A4 reference, and derives
// the four violin open-string targets for that reference. It is pure: no Web
// Audio, no DOM, no React — exactly the testable core the epic (#90) ships
// before the untestable audio shell, mirroring the existing pure `classify` /
// `spell` modules in this package.
//
// Equal temperament throughout (12-TET): a semitone is 2^(1/12), and frequency
// maps to MIDI by `n = round(69 + 12·log2(f / a4))` with A4 = MIDI 69. Cents are
// the log-frequency deviation `1200·log2(f / target)`. The pitch-class model
// (§12.5) and note-name spelling (§13) live in `classify` / `spell`; this module
// reuses `OPEN_STRING_PITCH_CLASS` for the open-string pitch classes but owns its
// own *fixed-sharp* chromatic naming (see `noteFromFrequency` — a tuner has no
// key context, so `spell()` does not apply here).

import { OPEN_STRING_PITCH_CLASS, type OpenString } from './classify.ts';

/**
 * A4 calibration range (Hz). The Tuner's adjustable reference is clamped to
 * 415–446 (historical-to-modern pitch), defaulting to the modern 440 (#90 /
 * #91). 415 ≈ Baroque "A415", 446 the upper bound some orchestras tune to.
 */
export const A4_MIN = 415;
export const A4_MAX = 446;
export const A4_DEFAULT = 440;

/** MIDI note number of A4 — the reference note all conversions hang off of. */
const A4_MIDI = 69;

/** Semitones per octave, and cents per semitone — named so the math reads. */
const SEMITONES_PER_OCTAVE = 12;
const CENTS_PER_OCTAVE = 1200;

/**
 * Clamp `a4` into the calibration range `[A4_MIN, A4_MAX]`. The Tuner UI keeps
 * its A4 slider in range, but every public function clamps defensively so a math
 * helper can never be driven outside the supported reference window.
 */
export function clampA4(a4: number): number {
  if (a4 < A4_MIN) return A4_MIN;
  if (a4 > A4_MAX) return A4_MAX;
  return a4;
}

/**
 * Base-2 logarithm guarded against non-positive input. `Math.log2(x)` is `-Infinity`
 * at 0 and `NaN` below it; every caller here passes a frequency ratio that is only
 * meaningful for positive operands, so we centralise the guard rather than risk a
 * `NaN`/`-Infinity` leaking into a reading. Non-positive input is reported as `null`
 * and the caller decides what that means (a non-frequency, not "0 cents").
 */
function safeLog2(value: number): number | null {
  if (value <= 0) return null;
  return Math.log2(value);
}

/**
 * Frequency (Hz) of a MIDI note number under an A4 reference: the inverse of
 * `n = round(69 + 12·log2(f / a4))`, i.e. `f = a4 · 2^((n − 69) / 12)`. `a4` is
 * clamped to the calibration range. `n` may be fractional (the formula is
 * continuous); integers give equal-tempered pitches.
 */
export function frequencyOfMidi(n: number, a4: number = A4_DEFAULT): number {
  return clampA4(a4) * Math.pow(2, (n - A4_MIDI) / SEMITONES_PER_OCTAVE);
}

/**
 * Frequency (Hz) of a note named by pitch class (0–11, C = 0; §12.5 intro) and
 * scientific octave. The MIDI number for pitch class `pc` in octave `octave` is
 * `12·(octave + 1) + pc` (MIDI 60 = C4 = middle C), then `frequencyOfMidi`
 * applies the A4 reference. This is the open-string fixture path (e.g. A4 → 440).
 */
export function frequencyOfNote(pc: number, octave: number, a4: number = A4_DEFAULT): number {
  return frequencyOfMidi(midiOf(pc, octave), a4);
}

/** MIDI number of pitch class `pc` (0–11) in scientific `octave`: 12·(octave+1)+pc. */
function midiOf(pc: number, octave: number): number {
  return SEMITONES_PER_OCTAVE * (octave + 1) + pc;
}

/**
 * Signed cents from `f` to `target`: `1200·log2(f / target)`. Positive when `f`
 * is sharp of `target`, negative when flat, 0 when equal. Returns `null` when
 * either operand is non-positive (a guarded `log2`, per `safeLog2`) so the result
 * is never `NaN`/`-Infinity` — callers treat `null` as "not a valid comparison".
 */
export function centsBetween(f: number, target: number): number | null {
  if (target <= 0) return null;
  const ratio = safeLog2(f / target);
  if (ratio === null) return null;
  return CENTS_PER_OCTAVE * ratio;
}

/** Fixed-sharp chromatic note names, pitch class 0–11 (C = 0; §12.5 intro). */
const CHROMATIC_SHARP_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;

/** A frequency resolved to its nearest equal-tempered note. */
export interface Reading {
  /** Nearest equal-tempered MIDI note number. */
  midi: number;
  /** Pitch class of that note, 0–11 (C = 0). */
  pc: number;
  /** Scientific octave of that note (MIDI 60 = C4). */
  octave: number;
  /**
   * Fixed-sharp chromatic name of the note (`C`, `C♯`, `D`, …). DELIBERATELY not
   * `spell()` (§13): `spell` is letter-correct only inside a `(root, scale)` key,
   * and a chromatic tuner has no key context — so a sharp spelling is fixed for
   * every accidental (`C♯`, never `D♭`). The `♯` is U+266F, the glyph the §3
   * self-hosted face covers (matching `spell`).
   */
  name: string;
  /** Signed deviation from that nearest note, in cents (positive = sharp). */
  cents: number;
}

/**
 * Resolve a frequency to its nearest equal-tempered note under an A4 reference.
 *
 * `n = round(69 + 12·log2(f / a4))` gives the nearest MIDI note; `cents` is the
 * signed deviation from that note's exact frequency (`1200·log2(f / f_n)`),
 * within ±50¢ by construction. `name` is the fixed-sharp chromatic name (see
 * `Reading.name`), NOT `spell()` — a tuner has no key.
 *
 * Returns `null` for `f ≤ 0` (the documented sentinel, per #91 AC #6 and the
 * plan-review SUGGESTION): a `Reading | null` makes every consumer (ph3 smoothing,
 * ph6 UI) guard explicitly rather than silently propagate a bad in-band reading,
 * and the guarded `log2` means `f ≤ 0` never yields `NaN`.
 */
export function noteFromFrequency(f: number, a4: number = A4_DEFAULT): Reading | null {
  const reference = clampA4(a4);
  const ratio = safeLog2(f / reference);
  if (ratio === null) return null;
  const exactMidi = A4_MIDI + SEMITONES_PER_OCTAVE * ratio;
  const midi = Math.round(exactMidi);
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / SEMITONES_PER_OCTAVE) - 1;
  // (exactMidi − midi) semitones × 100 = signed cents from the nearest note.
  const cents = (exactMidi - midi) * (CENTS_PER_OCTAVE / SEMITONES_PER_OCTAVE);
  return {
    midi,
    pc,
    octave,
    name: CHROMATIC_SHARP_NAMES[pc] ?? '',
    cents,
  };
}

/**
 * The four violin open strings, low to high, with their MIDI numbers (§12.1
 * perfect-fifth tuning): G3 = 55, D4 = 62, A4 = 69, E5 = 76. The pitch classes
 * agree with `OPEN_STRING_PITCH_CLASS` (G3 = 7, D4 = 2, A4 = 9, E5 = 4); we keep
 * the MIDI numbers here because the octave (which `OPEN_STRING_PITCH_CLASS` drops)
 * is load-bearing for the target frequency.
 */
export const OPEN_STRINGS: readonly { readonly name: OpenString; readonly midi: number }[] = [
  { name: 'G3', midi: 55 },
  { name: 'D4', midi: 62 },
  { name: 'A4', midi: 69 },
  { name: 'E5', midi: 76 },
] as const;

// Guard: the MIDI numbers above must agree with the §12.5(c) pitch classes that
// `classify` owns (55 mod 12 = 7 = G3, etc.). Asserted at module load so a future
// edit to either table can't silently desync them.
for (const { name, midi } of OPEN_STRINGS) {
  if (((midi % 12) + 12) % 12 !== OPEN_STRING_PITCH_CLASS[name]) {
    throw new Error(`OPEN_STRINGS MIDI ${String(midi)} disagrees with pitch class of ${name}`);
  }
}

/** A map of each open string to its target frequency (Hz) at a given A4. */
export type OpenStringFrequencies = Readonly<Record<OpenString, number>>;

/**
 * The four open-string target frequencies at an A4 reference. At A4 = 440 these
 * are G3 ≈ 196.00, D4 ≈ 293.66, A4 = 440, E5 ≈ 659.26; they scale proportionally
 * with `a4` (the ratios between strings are fixed by equal temperament).
 */
export function openStringFrequencies(a4: number = A4_DEFAULT): OpenStringFrequencies {
  const reference = clampA4(a4);
  return {
    G3: frequencyOfMidi(55, reference),
    D4: frequencyOfMidi(62, reference),
    A4: frequencyOfMidi(69, reference),
    E5: frequencyOfMidi(76, reference),
  };
}

/**
 * The open string nearest to `f` by LOG-frequency distance — i.e. the string with
 * the smallest absolute cents to `f`. Log distance (not linear Hz) is the musically
 * correct measure: the same Hz gap is far more cents at G3 than at E5, so a linear
 * nearest would bias toward the high strings. Returns `null` for `f ≤ 0` (no valid
 * comparison). Ties (a pitch exactly between two strings) resolve to the lower
 * string by iteration order, which is deterministic and harmless at the Tuner's
 * resolution.
 */
export function nearestOpenString(f: number, a4: number = A4_DEFAULT): OpenString | null {
  if (f <= 0) return null;
  const targets = openStringFrequencies(a4);
  let best: OpenString | null = null;
  let bestDistance = Infinity;
  for (const { name } of OPEN_STRINGS) {
    const cents = centsBetween(f, targets[name]);
    if (cents === null) continue;
    const distance = Math.abs(cents);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }
  return best;
}
