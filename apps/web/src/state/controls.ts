// Controls state model — the single source of truth the controls card writes and
// the note map reads (DESIGN.md §9.1, §12.5). DESIGN.md wins on any conflict
// (AGENTS.md).
//
// S6 owns the *state seam* between input (the three controls rows) and output
// (the S5 note map): the whole app holds one `(root, scale, refs)` value, every
// control mutates it, and the 60-dot classification (and so the map) is a pure
// function of it via @violin-tools/theory's `classify()` — the §12.5 rule is
// NEVER duplicated here. `refs` is four INDEPENDENT booleans (not a single
// selection), which is exactly why the Refs row is a `group` of checkboxes, not a
// radiogroup (the §9.1 / §11.3 reconciliation this PR makes).
//
// This module is pure data + reducers (no React/DOM); the `useControls` hook in
// `useControls.ts` adapts it to component state, and `derive()` turns the state
// into the `(rootPc, scaleSet)` the map renders from.

import {
  ROOT_PITCH_CLASS,
  SCALE_INTERVALS,
  type Root,
  type ScaleType,
} from '@violin-tools/theory';

/**
 * The four reference-layer toggles (§9.1), each an INDEPENDENT boolean — any
 * combination is a valid state (e.g. `tapes` on + `landmarks` on). This is the
 * data shape behind the Refs row's `role="checkbox"` semantics; a single-select
 * union here would be the bug the radiogroup→checkbox distinction guards against.
 */
export interface RefsState {
  /** Beginner tape overlay on/off (§9.1). */
  tapes: boolean;
  /** Tape 2 spelling `+4` → `+3` (§9.1). */
  low2: boolean;
  /** Drop tape 2 entirely — 4-tape ↔ 3-tape (§9.1). */
  threeTape: boolean;
  /** Octave + heel landmark bands, toggled together (§9.1). */
  landmarks: boolean;
}

/** The one app state the controls card drives and the map renders from. */
export interface ControlsState {
  /** Selected root pill (§9.1); its pitch class classifies (§12.5(b)). */
  root: Root;
  /** Selected scale pill (§9.1 / §12.5(a)). */
  scale: ScaleType;
  /** The four independent reference-layer toggles (§9.1). */
  refs: RefsState;
}

/** The four Refs keys, so callers can toggle one without naming a union inline. */
export type RefKey = keyof RefsState;

/**
 * The default selection: A Major with every reference layer off — the §12.5
 * worked-check case (`rootPc = 9`), so the first paint is the exact state a
 * reviewer can diff against the spec, matching the S5 static default.
 */
export const INITIAL_CONTROLS: ControlsState = {
  root: 'A',
  scale: 'major',
  refs: { tapes: false, low2: false, threeTape: false, landmarks: false },
};

// ── content contracts (§9.1) ──────────────────────────────────────────────
// These are the *content* contracts of §9.1 (which pills, what label, in what
// order). The pill VISUALS resolve in §8.1 (controls.css); the pitch-class and
// interval-set MATH lives in @violin-tools/theory — never re-derived here.

/**
 * §9.1 Root row — 12 pills in ascending chromatic order from C, in the violin
 * default spellings (`Db`/`Eb`/`F#`/`Ab`/`Bb`, never `C#`/`D#`/`Gb`/`G#`/`A#`).
 * The label IS the `Root` union member (the §13 default glyph); the v1 dual-
 * spelling sub-label for `F#`/`Bb` is a documented §16 gap, not built here.
 */
export const ROOT_PILLS: readonly Root[] = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];

/** §9.1 Scale row — the 7 scale pills with their exact truncated labels. */
export const SCALE_PILLS: readonly { scale: ScaleType; label: string }[] = [
  { scale: 'major', label: 'Major' },
  { scale: 'naturalMinor', label: 'Nat. minor' },
  { scale: 'harmonicMinor', label: 'Harm. minor' },
  { scale: 'melodicMinor', label: 'Mel. minor' },
  { scale: 'majorPentatonic', label: 'Major Pent.' },
  { scale: 'minorPentatonic', label: 'Minor Pent.' },
  { scale: 'chromatic', label: 'Chromatic' },
];

/** A Refs pill's accent family (§8.1): the three tape pills vs the teal one. */
export type RefAccent = 'tape' | 'landmark';

/**
 * §9.1 Refs row — 4 pills in two visually-grouped clusters: the three `{tape}`
 * pills (`Tapes`/`low 2`/`3-tape`), then the one `{teal}` pill (`Landmarks`).
 * Each maps to its independent boolean in `RefsState`.
 */
export const REF_PILLS: readonly {
  key: RefKey;
  label: string;
  accent: RefAccent;
}[] = [
  { key: 'tapes', label: 'Tapes', accent: 'tape' },
  { key: 'low2', label: 'low 2', accent: 'tape' },
  { key: 'threeTape', label: '3-tape', accent: 'tape' },
  { key: 'landmarks', label: 'Landmarks', accent: 'landmark' },
];

// ── reducers (pure) ───────────────────────────────────────────────────────

/** Set the root (single-select); leaves scale and refs untouched. */
export function setRoot(state: ControlsState, root: Root): ControlsState {
  return { ...state, root };
}

/** Set the scale (single-select); leaves root and refs untouched. */
export function setScale(state: ControlsState, scale: ScaleType): ControlsState {
  return { ...state, scale };
}

/**
 * Toggle ONE reference layer, leaving every other ref untouched — the behavioral
 * contract that makes the Refs row checkboxes, not radios. (Toggling `low 2`
 * never clears `Tapes`; the test in controls.test.tsx pins exactly this.)
 */
export function toggleRef(state: ControlsState, key: RefKey): ControlsState {
  return { ...state, refs: { ...state.refs, [key]: !state.refs[key] } };
}

// ── §9.1 dim logic (availability, NOT selection) ──────────────────────────

/**
 * §9.1 dim logic — which Refs pills are *unavailable* in the current combination
 * (rendered `.dim`: `opacity:.4; pointer-events:none`, never hidden — §8.1):
 *   • `low 2` and `3-tape` dim whenever `Tapes` is off;
 *   • `low 2` ALSO dims while `3-tape` is active (even with `Tapes` on).
 * `Tapes` and `Landmarks` are never dimmed. This is availability, computed from
 * state — it does not itself change selection.
 */
export function isRefDimmed(refs: RefsState, key: RefKey): boolean {
  if (key === 'low2') return !refs.tapes || refs.threeTape;
  if (key === 'threeTape') return !refs.tapes;
  return false;
}

// ── derivation for the map (pure function of state) ───────────────────────

/**
 * The `(rootPc, scaleSet)` the note map renders from — a pure function of
 * `(root, scale)` through @violin-tools/theory's §12.5(b) pitch-class table and
 * §12.5(a) interval sets. The map then classifies every node via `classify()`;
 * S6 never re-implements the rule.
 */
export function derive(state: ControlsState): {
  rootPc: number;
  scaleSet: readonly number[];
} {
  return {
    rootPc: ROOT_PITCH_CLASS[state.root],
    scaleSet: SCALE_INTERVALS[state.scale],
  };
}
