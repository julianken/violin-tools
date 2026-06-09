import { describe, expect, it } from 'vitest';

import {
  buildShareParams,
  derive,
  INITIAL_CONTROLS,
  isRefDimmed,
  parseShareParams,
  REF_PILLS,
  ROOT_PILLS,
  rootLabel,
  SCALE_DISPLAY_NAME,
  SCALE_PILLS,
  scaleName,
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

describe('§13 scaleName — spelled heading / breadcrumb name', () => {
  it('uses the full §13 scale names, not the truncated pill labels', () => {
    expect(SCALE_DISPLAY_NAME).toEqual({
      major: 'Major',
      naturalMinor: 'Natural Minor',
      harmonicMinor: 'Harmonic Minor',
      melodicMinor: 'Melodic Minor',
      majorPentatonic: 'Major Pentatonic',
      minorPentatonic: 'Minor Pentatonic',
      chromatic: 'Chromatic',
    });
  });

  it('defaults to "A Major"', () => {
    expect(scaleName(INITIAL_CONTROLS)).toBe('A Major');
  });

  it('spells a flat root letter-correct — "B♭ Major", never "A♯ Major"', () => {
    const name = scaleName(setRoot(INITIAL_CONTROLS, 'Bb'));
    expect(name).toBe('B♭ Major');
    expect(name).not.toContain('A♯');
  });

  it('joins the spelled root with the full scale name', () => {
    expect(scaleName(setScale(setRoot(INITIAL_CONTROLS, 'Bb'), 'harmonicMinor'))).toBe(
      'B♭ Harmonic Minor',
    );
    expect(scaleName(setScale(INITIAL_CONTROLS, 'minorPentatonic'))).toBe(
      'A Minor Pentatonic',
    );
  });

  it('flips the pc-1 H1/breadcrumb name with the scale family (S15: D♭ ↔ C♯)', () => {
    const dbMinor = setScale(setRoot(INITIAL_CONTROLS, 'Db'), 'naturalMinor');
    expect(scaleName(dbMinor)).toBe('C♯ Natural Minor'); // never "D♭ Natural Minor"
    expect(scaleName(setScale(dbMinor, 'major'))).toBe('D♭ Major'); // major family keeps D♭
    expect(scaleName(setScale(dbMinor, 'chromatic'))).toBe('D♭ Chromatic'); // chromatic = default
  });
});

describe('§9.1 / §13 rootLabel — family-aware pill label (S15)', () => {
  it('every NON-pc-1 root keeps its §9.1 default ASCII pill label in every scale', () => {
    for (const { scale } of SCALE_PILLS) {
      for (const root of ROOT_PILLS) {
        if (root === 'Db') continue; // pc 1 is the one context-dependent pill
        expect(rootLabel(root, scale)).toBe(root);
      }
    }
  });

  it('pc 1 reads Db for the major family + chromatic, C♯ for the minor family', () => {
    expect(rootLabel('Db', 'major')).toBe('Db');
    expect(rootLabel('Db', 'majorPentatonic')).toBe('Db');
    expect(rootLabel('Db', 'chromatic')).toBe('Db');
    expect(rootLabel('Db', 'naturalMinor')).toBe('C♯');
    expect(rootLabel('Db', 'harmonicMinor')).toBe('C♯');
    expect(rootLabel('Db', 'melodicMinor')).toBe('C♯');
    expect(rootLabel('Db', 'minorPentatonic')).toBe('C♯');
  });
});

// §16 deep-link codec — buildShareParams / parseShareParams. PURE: no `window`
// is read here (the codec takes a `search` string); only the AppShell/hook
// boundary touches `window.location`. These pin the round-trip identity, the
// percent-encoding of a sharp root, the `?motion=` survival on a (root,scale)
// write, and the junk-link no-op the map's never-blank guarantee rests on.
describe('§16 share-link codec — round-trip (root, scale)', () => {
  it('buildShareParams ∘ parseShareParams is identity across all 12 roots × 7 scales', () => {
    for (const root of ROOT_PILLS) {
      for (const { scale } of SCALE_PILLS) {
        const search = buildShareParams('', { root, scale }).toString();
        expect(parseShareParams(search)).toEqual({ root, scale });
      }
    }
  });

  it('encodes a sharp root via URLSearchParams as r=F%23 (never hand-concatenated)', () => {
    const search = buildShareParams('', { root: 'F#', scale: 'major' }).toString();
    expect(search).toContain('r=F%23');
    // And it survives the round trip back to the F# union member.
    expect(parseShareParams(search).root).toBe('F#');
  });

  it('upserts r/s onto the live search so a pre-existing ?motion=snappy SURVIVES a (root,scale) change', () => {
    // The merge requirement: resolveMotionBuild (Content.tsx) reads ?motion=
    // every render — a fresh write would drop it and flip the motion build.
    const next = buildShareParams('?motion=snappy&r=C&s=major', {
      root: 'Bb',
      scale: 'harmonicMinor',
    });
    expect(next.get('motion')).toBe('snappy');
    expect(next.get('r')).toBe('Bb');
    expect(next.get('s')).toBe('harmonicMinor');
  });

  it('parseShareParams("") no-ops to an empty partial (caller defaults A/major)', () => {
    expect(parseShareParams('')).toEqual({});
  });

  it('omits an unknown/absent r or s rather than throwing or coercing', () => {
    // Unknown root, valid scale → only scale survives.
    expect(parseShareParams('?r=H&s=major')).toEqual({ scale: 'major' });
    // Valid root, unknown scale → only root survives.
    expect(parseShareParams('?r=A&s=doubleHarmonic')).toEqual({ root: 'A' });
    // Absent both → empty.
    expect(parseShareParams('?x=1')).toEqual({});
  });
});
