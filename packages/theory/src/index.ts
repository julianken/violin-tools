// Public entry point for @violin-tools/theory — the pure §12.5 pitch model.
// The renderer (S5) imports `classify`, `nodePitchClass`, and the constants
// from here; it never reaches into individual module files.
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
