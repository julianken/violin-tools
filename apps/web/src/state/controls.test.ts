import { describe, expect, it } from 'vitest';

import {
  derive,
  INITIAL_CONTROLS,
  isRefDimmed,
  REF_PILLS,
  ROOT_PILLS,
  SCALE_PILLS,
  setRoot,
  setScale,
  toggleRef,
  type ControlsState,
} from './controls.ts';

// Pure state-model tests (no React/DOM). These pin the §9.1 content contracts,
// the §12.5 derivation seam, the §9.1 dim logic, and — load-bearing — that
// toggling one Refs boolean leaves the others untouched (the checkbox vs radio
// distinction the §9.1/§11.3 reconciliation rests on).

describe('controls content contracts (§9.1)', () => {
  it('Root row is the 12 default-spelling pills in chromatic order', () => {
    expect(ROOT_PILLS).toEqual([
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
    ]);
  });

  it('Scale row is the 7 pills with the exact truncated labels', () => {
    expect(SCALE_PILLS.map((p) => p.label)).toEqual([
      'Major',
      'Nat. minor',
      'Harm. minor',
      'Mel. minor',
      'Major Pent.',
      'Minor Pent.',
      'Chromatic',
    ]);
  });

  it('Refs row is the 4 pills in order with the §8.1 accent families', () => {
    expect(REF_PILLS.map((p) => p.label)).toEqual([
      'Tapes',
      'low 2',
      '3-tape',
      'Landmarks',
    ]);
    expect(REF_PILLS.map((p) => p.accent)).toEqual([
      'tape',
      'tape',
      'tape',
      'landmark',
    ]);
  });
});

describe('single-select reducers (§9.1)', () => {
  it('setRoot replaces only the root', () => {
    const next = setRoot(INITIAL_CONTROLS, 'Bb');
    expect(next.root).toBe('Bb');
    expect(next.scale).toBe(INITIAL_CONTROLS.scale);
    expect(next.refs).toEqual(INITIAL_CONTROLS.refs);
  });

  it('setScale replaces only the scale', () => {
    const next = setScale(INITIAL_CONTROLS, 'harmonicMinor');
    expect(next.scale).toBe('harmonicMinor');
    expect(next.root).toBe(INITIAL_CONTROLS.root);
  });
});

describe('Refs independence (the checkbox contract)', () => {
  it('toggling one ref does NOT change any other ref', () => {
    // Start with Tapes on so low2/3-tape are not dimmed.
    const base: ControlsState = {
      ...INITIAL_CONTROLS,
      refs: { tapes: true, low2: false, threeTape: false, landmarks: false },
    };
    const next = toggleRef(base, 'low2');
    // The toggled one flipped…
    expect(next.refs.low2).toBe(true);
    // …and every OTHER ref is byte-for-byte unchanged (NOT cleared — this is the
    // exact failure single-select wiring would introduce).
    expect(next.refs.tapes).toBe(base.refs.tapes);
    expect(next.refs.threeTape).toBe(base.refs.threeTape);
    expect(next.refs.landmarks).toBe(base.refs.landmarks);
  });

  it('two refs can be active simultaneously', () => {
    let state = toggleRef(INITIAL_CONTROLS, 'tapes');
    state = toggleRef(state, 'landmarks');
    expect(state.refs.tapes).toBe(true);
    expect(state.refs.landmarks).toBe(true);
  });
});

describe('dim logic (§9.1)', () => {
  it('low 2 and 3-tape dim when Tapes is off', () => {
    const refs = { tapes: false, low2: false, threeTape: false, landmarks: false };
    expect(isRefDimmed(refs, 'low2')).toBe(true);
    expect(isRefDimmed(refs, 'threeTape')).toBe(true);
    // Tapes and Landmarks are never dimmed.
    expect(isRefDimmed(refs, 'tapes')).toBe(false);
    expect(isRefDimmed(refs, 'landmarks')).toBe(false);
  });

  it('low 2 also dims while 3-tape is active (even with Tapes on)', () => {
    const refs = { tapes: true, low2: false, threeTape: true, landmarks: false };
    expect(isRefDimmed(refs, 'low2')).toBe(true);
    // 3-tape itself is available when Tapes is on.
    expect(isRefDimmed(refs, 'threeTape')).toBe(false);
  });

  it('nothing dims when Tapes is on and 3-tape is off', () => {
    const refs = { tapes: true, low2: false, threeTape: false, landmarks: false };
    expect(isRefDimmed(refs, 'low2')).toBe(false);
    expect(isRefDimmed(refs, 'threeTape')).toBe(false);
  });
});

describe('derivation through the theory engine (§12.5)', () => {
  it('derives the §12.5(b) pitch class for the selected root', () => {
    expect(derive(setRoot(INITIAL_CONTROLS, 'Bb')).rootPc).toBe(10);
    expect(derive(setRoot(INITIAL_CONTROLS, 'F#')).rootPc).toBe(6);
    expect(derive(setRoot(INITIAL_CONTROLS, 'A')).rootPc).toBe(9);
  });

  it('derives the §12.5(a) interval set for the selected scale', () => {
    expect(derive(setScale(INITIAL_CONTROLS, 'major')).scaleSet).toEqual([
      0, 2, 4, 5, 7, 9, 11,
    ]);
    expect(derive(setScale(INITIAL_CONTROLS, 'chromatic')).scaleSet).toHaveLength(12);
  });
});
