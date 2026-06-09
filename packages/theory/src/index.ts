// Public entry point for @violin-tools/theory — the pure §12.5 pitch model plus
// the §13 note-name spelling. The renderer imports `classify`, `nodePitchClass`,
// `spell`, and the constants from here; it never reaches into individual module
// files.
export {
  classify,
  nodePitchClass,
  SCALE_INTERVALS,
  ROOT_PITCH_CLASS,
  OPEN_STRING_PITCH_CLASS,
  NMAX,
  MIN_COLUMN_INDEX,
  MAX_COLUMN_INDEX,
  type NodeState,
  type ScaleType,
  type Root,
  type OpenString,
} from './classify.ts';
// §13 letter-correct note spelling — names what §12.5 classification placed.
export { spell } from './spell.ts';
// §13 / §11.3 spoken note names — the plain-speech (AT) form of a note name and
// the per-marker accessible name ("C sharp, root") the roving note map exposes.
export { spokenName, noteMarkerName } from './speech.ts';
// S18 (Tuner) tuning math — pure equal-temperament Hz ↔ note/cents conversion
// against an adjustable A4, plus the violin open-string targets. No Web Audio/DOM.
export {
  A4_MIN,
  A4_MAX,
  A4_DEFAULT,
  clampA4,
  frequencyOfMidi,
  frequencyOfNote,
  centsBetween,
  noteFromFrequency,
  OPEN_STRINGS,
  openStringFrequencies,
  nearestOpenString,
  type Reading,
  type OpenStringFrequencies,
} from './tuning.ts';
