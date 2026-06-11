// noteTracker test suite — C3, epic #141.
//
// All tests use SYNTHETIC frame scripts: deterministic arrays of
// `{ timestampMs, hz, clarity }` objects. No audio APIs, no DOM, no React.
//
// The suite is organized to pin every AC from the issue spec (#133):
//   AC2  — clean run completes
//   AC3  — flicker does not advance
//   AC4  — low-clarity frames reset dwell
//   AC5  — octave guard
//   AC6  — median cents excludes non-settled frames (settling frames discarded)
//   AC7  — median outlier robustness
//   AC8  — strict sequence enforced
//   AC9  — reset() clears state
//   AC10 — threshold injection works
//   AC1  — pure module (no react/Audio/DOM imports) is verified at the file level
//            by the grep in the acceptance criteria; not a runtime test.
//
// Helpers at the top generate synthetic frame scripts from simple intent
// declarations, keeping test bodies readable without hiding what matters.

import { frequencyOfMidi, A4_DEFAULT } from '@violin-tools/theory';
import { describe, it, expect, assert, beforeEach } from 'vitest';

import {
  createNoteTracker,
  type DrillTarget,
  type RawFrame,
  type NoteResult,
  type TrackerOptions,
} from './noteTracker.ts';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Standard options matching production values. Tests may override any field. */
const STANDARD_OPTIONS: TrackerOptions = {
  clarityThreshold: 0.5,
  dwellMs: 150, // 150 ms dwell to confirm settling
  halfWidthCents: 50, // ±50 ¢ acceptance window
  a4: A4_DEFAULT,
};

const A4 = A4_DEFAULT;

// ── Helpers: DrillTarget construction ──────────────────────────────────────────

/**
 * Build a `DrillTarget` from a MIDI note number. Uses `frequencyOfMidi` so
 * the Hz is consistent with the octave guard's `noteFromFrequency` round-trip.
 */
function target(midiNote: number, index: number): DrillTarget {
  return {
    index,
    midiNote,
    hz: frequencyOfMidi(midiNote, A4),
    degreeLabel: String(index + 1),
  };
}

/**
 * Build a 29-target sequence: one full 2-octave Flesch-shape scale run
 * starting from G3 (MIDI 55), ascending diatonically to G5 (MIDI 79),
 * which yields 24 ascending pitches + 5 descending back to D5 for a 29-note
 * sequence (representative; not the final C2 shape — good enough for AC2).
 *
 * For the pure FSM tests the exact pitches don't matter — we just need an
 * ordered sequence of distinct MIDI notes.
 */
function build29TargetPlan(): readonly DrillTarget[] {
  const midiNotes: number[] = [];
  // Ascending: G3 (55) to G5 (79) — 25 notes
  for (let midi = 55; midi <= 79; midi++) {
    midiNotes.push(midi);
  }
  // Descending continuation: F#5 down to E5 — 4 more notes → total 29
  midiNotes.push(78, 77, 76, 75);
  return midiNotes.slice(0, 29).map((n, i) => target(n, i));
}

// ── Helpers: Frame script generators ──────────────────────────────────────────

/** A frame with clarity above threshold, pitched at `hz`, at `timestampMs`. */
function goodFrame(timestampMs: number, hz: number): RawFrame {
  return { timestampMs, hz, clarity: 0.8 };
}

/** A frame below the clarity threshold (silence / noise). */
function silentFrame(timestampMs: number, hz: number): RawFrame {
  return { timestampMs, hz, clarity: 0.1 };
}

/**
 * Generate a script of `count` frames that cleanly settle a target:
 * - `count` in-window good frames separated by `frameGapMs`,
 *   starting at `startMs`, all at `hz`.
 * Then one out-of-window frame that fires the advance.
 *
 * Returns `{ frames, exitFrame }` so tests can push them individually.
 */
function settleScript(
  hz: number,
  startMs: number,
  count: number,
  frameGapMs: number,
): { frames: RawFrame[]; exitFrame: RawFrame } {
  const frames: RawFrame[] = [];
  for (let i = 0; i < count; i++) {
    frames.push(goodFrame(startMs + i * frameGapMs, hz));
  }
  const lastMs = startMs + (count - 1) * frameGapMs;
  // Exit by jumping to a clearly out-of-window frequency (one full octave away).
  const exitFrame = goodFrame(lastMs + frameGapMs, hz * 2);
  return { frames, exitFrame };
}

/**
 * Push all frames in a settle script through the tracker. Returns the
 * `NoteResult` produced by the exit frame, or `null` if none was emitted.
 */
function runSettleScript(
  tracker: ReturnType<typeof createNoteTracker>,
  hz: number,
  startMs: number,
  count: number,
  frameGapMs: number,
): NoteResult | null {
  const { frames, exitFrame } = settleScript(hz, startMs, count, frameGapMs);
  for (const f of frames) {
    tracker.pushFrame(f);
  }
  return tracker.pushFrame(exitFrame);
}

// ── AC2: Clean run completes ──────────────────────────────────────────────────

describe('AC2 — clean run completes', () => {
  it('advances all 29 targets in order; final state is complete', () => {
    const plan = build29TargetPlan();
    const tracker = createNoteTracker(plan, STANDARD_OPTIONS);

    let cursor = 0; // ms cursor
    const frameGapMs = 20;
    // dwell: 10 frames × 20 ms = 200 ms ≥ dwellMs(150)
    const dwellFrames = 10;

    const emitted: NoteResult[] = [];

    for (const t of plan) {
      const result = runSettleScript(tracker, t.hz, cursor, dwellFrames, frameGapMs);
      expect(result).not.toBeNull();
      if (result !== null) {
        emitted.push(result);
      }
      cursor += (dwellFrames + 2) * frameGapMs;
    }

    expect(emitted).toHaveLength(29);
    emitted.forEach((r, i) => {
      expect(r.targetIndex).toBe(i);
    });

    const state = tracker.getState();
    expect(state.trackerState).toBe('complete');
    expect(state.currentTargetIndex).toBe(29);
    expect(state.results).toHaveLength(29);
  });
});

// ── AC3: Flicker does not advance ─────────────────────────────────────────────

describe('AC3 — flicker does not advance', () => {
  it('frames that enter and exit the window before dwellMs does not produce a NoteResult', () => {
    const plan = [target(69, 0)]; // A4
    const tracker = createNoteTracker(plan, { ...STANDARD_OPTIONS, dwellMs: 200 });

    // 4 frames × 20 ms = 80 ms — well under dwellMs(200)
    const flickerFrames = 4;
    const flickerGap = 20;
    const hz = plan[0]!.hz;

    for (let i = 0; i < flickerFrames; i++) {
      const r = tracker.pushFrame(goodFrame(i * flickerGap, hz));
      expect(r).toBeNull();
    }
    // Exit the window: no advance should fire
    const r = tracker.pushFrame(goodFrame(flickerFrames * flickerGap, hz * 2));
    expect(r).toBeNull();

    // Target index unchanged
    expect(tracker.getState().currentTargetIndex).toBe(0);
    expect(tracker.getState().results).toHaveLength(0);
  });

  it('partial dwell → exit → re-enter → full dwell does advance on the second attempt', () => {
    const plan = [target(69, 0)];
    const tracker = createNoteTracker(plan, { ...STANDARD_OPTIONS, dwellMs: 100 });
    const hz = plan[0]!.hz;

    // First pass: 3 × 20 ms = 60 ms (under 100 ms dwell) → exit → no advance
    for (let i = 0; i < 3; i++) tracker.pushFrame(goodFrame(i * 20, hz));
    tracker.pushFrame(goodFrame(60, hz * 2)); // exit

    // Second pass: 6 × 20 ms = 120 ms ≥ 100 ms → advance on exit
    for (let i = 0; i < 6; i++) tracker.pushFrame(goodFrame(200 + i * 20, hz));
    const r = tracker.pushFrame(goodFrame(200 + 6 * 20, hz * 2));
    expect(r).not.toBeNull();
    expect(r?.targetIndex).toBe(0);
  });
});

// ── AC4: Low-clarity frames reset dwell ───────────────────────────────────────

describe('AC4 — low-clarity frames reset dwell', () => {
  it('clarity-0 frames during settling reset the dwell buffer; target does not advance prematurely', () => {
    const plan = [target(69, 0)];
    const tracker = createNoteTracker(plan, { ...STANDARD_OPTIONS, dwellMs: 100 });
    const hz = plan[0]!.hz;

    // 3 good frames (60 ms) — entering settling
    for (let i = 0; i < 3; i++) tracker.pushFrame(goodFrame(i * 20, hz));

    // 1 silent frame at 70 ms — drops below clarity, resets settling
    tracker.pushFrame(silentFrame(70, hz));

    // Exit window — should NOT advance (dwell never completed)
    const r = tracker.pushFrame(goodFrame(90, hz * 2));
    expect(r).toBeNull();
    expect(tracker.getState().currentTargetIndex).toBe(0);
  });

  it('silence gap resets even after a long settling sequence', () => {
    const plan = [target(69, 0)];
    const hz = plan[0]!.hz;

    // Use a long dwell so the frames below are still in settling when silence hits.
    const trackerStrict = createNoteTracker(plan, { ...STANDARD_OPTIONS, dwellMs: 300 });

    // 7 frames × 20 ms = 140 ms — still settling (dwell = 300 ms)
    for (let i = 0; i < 7; i++) trackerStrict.pushFrame(goodFrame(i * 20, hz));

    // One silent frame at 150 ms — resets settling
    trackerStrict.pushFrame(silentFrame(150, hz));

    // Exit window — must not advance
    const r = trackerStrict.pushFrame(goodFrame(160, hz * 2));
    expect(r).toBeNull();
    expect(trackerStrict.getState().currentTargetIndex).toBe(0);
  });
});

// ── AC5: Octave guard ─────────────────────────────────────────────────────────

describe('AC5 — octave guard', () => {
  it('a frame one octave up does not advance the current target', () => {
    const plan = [target(69, 0)]; // A4 = MIDI 69
    const tracker = createNoteTracker(plan, STANDARD_OPTIONS);
    const hz = plan[0]!.hz;

    // One octave up: A5 = MIDI 81, hz * 2. Even though a hypothetical
    // loose window might pass the ratio check for A5 vs A4, the MIDI
    // octave guard (reading.midi === 69) rejects it because
    // noteFromFrequency(hz*2, A4).midi === 81 ≠ 69.
    //
    // Drive many such frames (well past dwell if we weren't guarding).
    const octaveHz = hz * 2;
    for (let i = 0; i < 20; i++) {
      const r = tracker.pushFrame(goodFrame(i * 20, octaveHz));
      expect(r).toBeNull();
    }
    // Exit: still no advance.
    expect(tracker.pushFrame(goodFrame(500, 100))).toBeNull();
    expect(tracker.getState().currentTargetIndex).toBe(0);
  });

  it('a frame one octave down does not advance the current target', () => {
    const plan = [target(69, 0)]; // A4 = MIDI 69
    const tracker = createNoteTracker(plan, STANDARD_OPTIONS);
    const hz = plan[0]!.hz;

    const octaveBelowHz = hz / 2; // A3 = MIDI 57
    for (let i = 0; i < 20; i++) {
      tracker.pushFrame(goodFrame(i * 20, octaveBelowHz));
    }
    const r = tracker.pushFrame(goodFrame(500, 100));
    expect(r).toBeNull();
    expect(tracker.getState().currentTargetIndex).toBe(0);
  });
});

// ── AC6: Median cents excludes non-settled (settling) frames ──────────────────

describe('AC6 — scoring window is settled frames only', () => {
  it('settling frames are not included in the scoring window', () => {
    // We inject a deliberately wrong pitch during settling, then the correct
    // pitch during settled. The median should reflect only the settled frames.
    const plan = [target(69, 0)]; // A4 440 Hz
    const tracker = createNoteTracker(plan, {
      ...STANDARD_OPTIONS,
      dwellMs: 100,
      halfWidthCents: 60, // wide enough to admit +50 ¢ frames
    });
    const hz = plan[0]!.hz; // 440

    // Settling phase: 4 × 20 ms = 80 ms — still in settling (dwell = 100 ms).
    // Push frames that are +50 ¢ sharp: hz * 2^(50/1200) ≈ 454.7 Hz
    // These are in-window (|+50 ¢| = halfWidthCents) but should NOT be scored.
    const sharpHz = hz * Math.pow(2, 50 / 1200);
    for (let i = 0; i < 4; i++) {
      tracker.pushFrame(goodFrame(i * 20, sharpHz));
    }

    // Settled phase: 10 × 20 ms more — starts at 80 ms; by frame 5 (100 ms)
    // we've met the dwell. After settling, push on-pitch (0 ¢) frames.
    // The 5th frame (at 100 ms) transitions to settled; frames after that score.
    for (let i = 4; i < 14; i++) {
      tracker.pushFrame(goodFrame(i * 20, hz)); // exactly on pitch: 0 ¢
    }

    // Exit: advance fires.
    const result = tracker.pushFrame(goodFrame(300, 100));
    expect(result).not.toBeNull();

    // medianCents should be close to 0 (the settled frames), NOT pulled toward +50 ¢
    // by the settling frames.
    assert(result !== null);
    expect(result.medianCents).not.toBeNull();
    expect(Math.abs(result.medianCents ?? Infinity)).toBeLessThan(5);
  });
});

// ── AC7: Median outlier robustness ────────────────────────────────────────────

describe('AC7 — median outlier robustness', () => {
  // The outlier frames must still round to the target MIDI note (pass the octave
  // guard, i.e. be within ±50 ¢), yet be asymmetric enough to distinguish median
  // from mean. We use +40 ¢ as the "outlier" (within the MIDI rounding boundary)
  // against a background of +3 ¢ frames.
  //
  // Mean of [3,3,3,3,3,3,3,3,3,40] = (27+40)/10 = 6.7 ¢
  // Median of that same list = 3 ¢
  // Both are unambiguous: median ≈ 3 ¢, well under the mean.
  //
  // Note: a +90 ¢ frame would fail the octave guard (rounds to the next MIDI note)
  // and be treated as out-of-window by the FSM — which is the correct behavior.
  // The AC tests that median is used (not mean) for frames that DO land in the window.

  it('one stray +40 ¢ outlier in an otherwise +3 ¢ settled window: median ≈ 3 ¢, not mean ≈ 6.7 ¢', () => {
    const plan = [target(69, 0)]; // A4
    const tracker = createNoteTracker(plan, {
      ...STANDARD_OPTIONS,
      dwellMs: 50, // short dwell to get into settled quickly
      halfWidthCents: 50,
    });
    const hz = plan[0]!.hz; // 440

    // Dwell: 3 frames × 20 ms = 60 ms ≥ 50 ms dwell → enters settled
    for (let i = 0; i < 3; i++) {
      tracker.pushFrame(goodFrame(i * 20, hz)); // 0 ¢, settling phase (discarded)
    }

    // Settled phase: 9 frames at +3 ¢ + 1 frame at +40 ¢
    // Both round to MIDI 69 (A4) and pass the octave guard.
    const nearHz = hz * Math.pow(2, 3 / 1200); // +3 ¢ → midi round(69.03)=69 ✓
    const outlierHz = hz * Math.pow(2, 40 / 1200); // +40 ¢ → midi round(69.40)=69 ✓

    let t = 60;
    for (let i = 0; i < 9; i++) {
      tracker.pushFrame(goodFrame(t, nearHz));
      t += 20;
    }
    tracker.pushFrame(goodFrame(t, outlierHz)); // the outlier (still in-window)
    t += 20;

    // Exit: advance.
    const result = tracker.pushFrame(goodFrame(t, 100));
    expect(result).not.toBeNull();

    assert(result !== null);
    expect(result.medianCents).not.toBeNull();
    // Median of [3×9, 40×1] = 3 ¢ — well under mean 6.7 ¢.
    // Threshold ≤ 5 ¢ confirms we're using median, not mean.
    const mc = result.medianCents ?? Infinity;
    expect(mc).toBeLessThanOrEqual(5);
    // Frame count: 10 settled frames (the 3 settling frames are discarded).
    expect(result.frameCount).toBe(10);
  });

  it('median of 9×(+3¢) + 1×(+40¢) is near +3¢, not near mean ≈ +6.7¢', () => {
    // This test documents the mean vs median delta explicitly.
    const plan = [target(57, 0)]; // A3, to vary the test frequency
    const tracker = createNoteTracker(plan, {
      ...STANDARD_OPTIONS,
      dwellMs: 50,
      halfWidthCents: 50,
    });
    const hz = plan[0]!.hz;

    // Dwell 3 frames at exact pitch
    for (let i = 0; i < 3; i++) tracker.pushFrame(goodFrame(i * 20, hz));

    let t = 60;
    const nearHz = hz * Math.pow(2, 3 / 1200);
    const outlierHz = hz * Math.pow(2, 40 / 1200);
    for (let i = 0; i < 9; i++) {
      tracker.pushFrame(goodFrame(t, nearHz));
      t += 20;
    }
    tracker.pushFrame(goodFrame(t, outlierHz));
    t += 20;
    const result = tracker.pushFrame(goodFrame(t, 100));

    assert(result !== null);
    expect(result.medianCents).not.toBeNull();
    const mc = result.medianCents ?? 999;
    // Median ≈ 3 ¢ — well under mean 6.7 ¢.
    expect(mc).toBeLessThan(5); // if mean were used it would be ~6.7 ¢ > 5
    expect(mc).toBeGreaterThan(0); // it is actually sharp
  });
});

// ── AC8: Strict sequence enforced ─────────────────────────────────────────────

describe('AC8 — strict sequence enforced', () => {
  it('frames pitched at target index 3 while FSM is on target index 0 do not register', () => {
    const plan = [target(60, 0), target(62, 1), target(64, 2), target(65, 3)]; // C4 D4 E4 F4
    const tracker = createNoteTracker(plan, { ...STANDARD_OPTIONS, dwellMs: 50 });

    const hzTarget3 = plan[3]!.hz; // F4

    // Drive many frames at target-3 (F4) while the FSM expects target-0 (C4).
    let t = 0;
    for (let i = 0; i < 20; i++) {
      const r = tracker.pushFrame(goodFrame(t, hzTarget3));
      expect(r).toBeNull();
      t += 20;
    }
    // Exit: still no advance.
    expect(tracker.pushFrame(goodFrame(t, 100))).toBeNull();
    expect(tracker.getState().currentTargetIndex).toBe(0);
    expect(tracker.getState().results).toHaveLength(0);
  });

  it('only frames matching the current target contribute to the window', () => {
    // Target 0 (C4) should not advance on D4 frames, and vice versa.
    const plan = [target(60, 0), target(62, 1)];
    const tracker = createNoteTracker(plan, { ...STANDARD_OPTIONS, dwellMs: 50 });

    // Settle target 0 correctly:
    const hz0 = plan[0]!.hz;
    for (let i = 0; i < 5; i++) tracker.pushFrame(goodFrame(i * 20, hz0));
    const r0 = tracker.pushFrame(goodFrame(200, hz0 * 2)); // exit via octave
    expect(r0).not.toBeNull();
    expect(r0?.targetIndex).toBe(0);

    // Now FSM is on target 1 (D4).
    expect(tracker.getState().currentTargetIndex).toBe(1);

    // Frames at target 0's Hz should not advance target 1.
    for (let i = 0; i < 20; i++) {
      tracker.pushFrame(goodFrame(300 + i * 20, hz0));
    }
    expect(tracker.pushFrame(goodFrame(900, 100))).toBeNull();
    expect(tracker.getState().currentTargetIndex).toBe(1);
  });
});

// ── AC9: reset() clears state ─────────────────────────────────────────────────

describe('AC9 — reset() clears state', () => {
  let plan: readonly DrillTarget[];
  let tracker: ReturnType<typeof createNoteTracker>;

  beforeEach(() => {
    plan = [target(60, 0), target(62, 1), target(64, 2)];
    tracker = createNoteTracker(plan, { ...STANDARD_OPTIONS, dwellMs: 50 });
  });

  it('after two targets advance, reset() sets currentTargetIndex=0 and results=[]', () => {
    const hz0 = plan[0]!.hz;
    const hz1 = plan[1]!.hz;

    // Advance target 0
    for (let i = 0; i < 5; i++) tracker.pushFrame(goodFrame(i * 20, hz0));
    tracker.pushFrame(goodFrame(200, hz0 * 2));

    // Advance target 1
    for (let i = 0; i < 5; i++) tracker.pushFrame(goodFrame(300 + i * 20, hz1));
    tracker.pushFrame(goodFrame(500, hz1 * 2));

    expect(tracker.getState().currentTargetIndex).toBe(2);
    expect(tracker.getState().results).toHaveLength(2);

    // Reset
    tracker.reset();

    const state = tracker.getState();
    expect(state.currentTargetIndex).toBe(0);
    expect(state.results).toHaveLength(0);
    expect(state.trackerState).toBe('running');
  });

  it('after reset, the tracker can complete a full run again', () => {
    // Run through all 3 targets
    for (const t of plan) {
      for (let i = 0; i < 5; i++) tracker.pushFrame(goodFrame(i * 20, t.hz));
      tracker.pushFrame(goodFrame(200, t.hz * 2));
    }
    expect(tracker.getState().trackerState).toBe('complete');

    // Reset and run again
    tracker.reset();
    expect(tracker.getState().trackerState).toBe('running');

    let t2 = 0;
    const emitted: NoteResult[] = [];
    for (const tgt of plan) {
      for (let i = 0; i < 5; i++) tracker.pushFrame(goodFrame(t2 + i * 20, tgt.hz));
      const r = tracker.pushFrame(goodFrame(t2 + 200, tgt.hz * 2));
      if (r !== null) emitted.push(r);
      t2 += 400;
    }

    expect(emitted).toHaveLength(3);
    expect(tracker.getState().trackerState).toBe('complete');
  });
});

// ── AC10: Threshold injection works ───────────────────────────────────────────

describe('AC10 — threshold injection works', () => {
  it('shorter dwellMs tracker advances earlier than longer dwellMs tracker on identical frames', () => {
    const plan = [target(69, 0)]; // A4
    const shortDwell = createNoteTracker(plan, { ...STANDARD_OPTIONS, dwellMs: 60 });
    const longDwell = createNoteTracker(plan, { ...STANDARD_OPTIONS, dwellMs: 200 });
    const hz = plan[0]!.hz;

    let shortAdvancedAt: number | null = null;

    // Drive 20 frames at 20 ms spacing. After frame N, elapsed from entry is N×20 ms.
    // shortDwell (60 ms): advances after 3 frames in window (3×20=60) + exit.
    // longDwell (200 ms): would need 10 frames (10×20=200) + exit.
    for (let i = 0; i < 15; i++) {
      const t = i * 20;
      const rs = shortDwell.pushFrame(goodFrame(t, hz));
      if (rs !== null && shortAdvancedAt === null) shortAdvancedAt = t;
      longDwell.pushFrame(goodFrame(t, hz));
    }
    // Trigger advance for both via exit
    const exitT = 15 * 20;
    const rs = shortDwell.pushFrame(goodFrame(exitT, hz * 2));
    if (rs !== null && shortAdvancedAt === null) shortAdvancedAt = exitT;
    longDwell.pushFrame(goodFrame(exitT, hz * 2));

    // Short-dwell tracker must have advanced (it met dwell well before frame 15).
    expect(shortAdvancedAt).not.toBeNull();

    // Long-dwell tracker should NOT have advanced yet (only 15×20=300ms in window
    // but we only drove 15 frames before the exit, and dwell was met at frame 10
    // so it would advance on exit at the same time as short if we let it run long
    // enough). Let's verify both advanced, with short advancing first.
    //
    // Actually with 15 frames before exit: at frame 3 short meets dwell; at frame
    // 10 long meets dwell. Both advance on exit (frame 15). So short transitions
    // to settled at frame 3 and long at frame 10; BOTH fire on the exit frame.
    // But the key test is that with only 5 frames (100 ms < 200 ms dwell), only
    // the short tracker advances.
    const plan2 = [target(69, 0)];
    const shortDwell2 = createNoteTracker(plan2, { ...STANDARD_OPTIONS, dwellMs: 60 });
    const longDwell2 = createNoteTracker(plan2, { ...STANDARD_OPTIONS, dwellMs: 200 });

    // 5 frames × 20 ms = 100 ms — meets shortDwell(60) but not longDwell(200)
    for (let i = 0; i < 5; i++) {
      shortDwell2.pushFrame(goodFrame(i * 20, hz));
      longDwell2.pushFrame(goodFrame(i * 20, hz));
    }
    const exitShort = shortDwell2.pushFrame(goodFrame(120, hz * 2));
    const exitLong = longDwell2.pushFrame(goodFrame(120, hz * 2));

    expect(exitShort).not.toBeNull(); // short dwell met → advances on exit
    expect(exitLong).toBeNull(); // long dwell not met → no advance
  });

  it('higher clarityThreshold rejects frames that a lower threshold accepts', () => {
    const plan = [target(69, 0)];
    const loThreshold = createNoteTracker(plan, {
      ...STANDARD_OPTIONS,
      clarityThreshold: 0.3,
      dwellMs: 60,
    });
    const hiThreshold = createNoteTracker(plan, {
      ...STANDARD_OPTIONS,
      clarityThreshold: 0.9,
      dwellMs: 60,
    });
    const hz = plan[0]!.hz;

    // Frames with clarity 0.5: above lo(0.3) but below hi(0.9).
    const marginalFrame = (t: number): RawFrame => ({ timestampMs: t, hz, clarity: 0.5 });

    for (let i = 0; i < 5; i++) {
      loThreshold.pushFrame(marginalFrame(i * 20));
      hiThreshold.pushFrame(marginalFrame(i * 20));
    }
    const rLo = loThreshold.pushFrame(goodFrame(120, hz * 2));
    const rHi = hiThreshold.pushFrame(goodFrame(120, hz * 2));

    expect(rLo).not.toBeNull(); // accepted by low threshold → advances
    expect(rHi).toBeNull(); // rejected by high threshold → no advance
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('pushFrame after complete returns null and does not increment index', () => {
    const plan = [target(69, 0)];
    const tracker = createNoteTracker(plan, { ...STANDARD_OPTIONS, dwellMs: 50 });
    const hz = plan[0]!.hz;

    for (let i = 0; i < 5; i++) tracker.pushFrame(goodFrame(i * 20, hz));
    tracker.pushFrame(goodFrame(200, hz * 2)); // advance + complete

    expect(tracker.getState().trackerState).toBe('complete');
    const r = tracker.pushFrame(goodFrame(300, hz));
    expect(r).toBeNull();
    expect(tracker.getState().currentTargetIndex).toBe(1); // unchanged
  });

  it('silence frames (hz=0) in window do not crash and do not advance', () => {
    const plan = [target(69, 0)];
    const tracker = createNoteTracker(plan, STANDARD_OPTIONS);

    for (let i = 0; i < 20; i++) {
      const r = tracker.pushFrame({ timestampMs: i * 20, hz: 0, clarity: 0.8 });
      expect(r).toBeNull();
    }
    expect(tracker.getState().currentTargetIndex).toBe(0);
  });

  it('getState results array is the same length as emitted NoteResults', () => {
    const plan = [target(60, 0), target(62, 1), target(64, 2)];
    const tracker = createNoteTracker(plan, { ...STANDARD_OPTIONS, dwellMs: 50 });

    let t = 0;
    for (const tgt of plan) {
      for (let i = 0; i < 5; i++) tracker.pushFrame(goodFrame(t + i * 20, tgt.hz));
      tracker.pushFrame(goodFrame(t + 200, tgt.hz * 2));
      t += 400;
    }

    expect(tracker.getState().results).toHaveLength(3);
    tracker.getState().results.forEach((r, i) => {
      expect(r.targetIndex).toBe(i);
      expect(r.intendedHz).toBeCloseTo(plan[i]!.hz, 6);
    });
  });

  it('NoteResult.medianCents is the intended-degree cents, not nearest-note cents (AC1 headline invariant)', () => {
    // Create a target at MIDI 69 (A4) but with hz set to 439 Hz instead of
    // exact 440 Hz — simulating a slightly detuned reference target (as C2
    // could produce for an instrument tuned to non-standard pitch).
    //
    // Feed a frame at exactly 440 Hz:
    //   centsBetween(440, 439) ≈ +3.94 ¢ (sharp of the intended 439 Hz)
    //   noteFromFrequency(440, A4).cents = 0.0 ¢ (nearest note IS A4 = 440 Hz)
    //
    // The result must use intended-degree scoring: medianCents ≈ +3.94 ¢,
    // not nearest-note-relative 0 ¢. If the implementation accidentally uses
    // noteFromFrequency(frame.hz).cents, the test would fail (0 ¢ ≠ ~4 ¢).
    const customTarget: DrillTarget = {
      index: 0,
      midiNote: 69, // A4 — octave guard uses this
      hz: 439, // intentionally 1 Hz flat of exact A4
      degreeLabel: '1',
    };
    const tracker = createNoteTracker([customTarget], {
      ...STANDARD_OPTIONS,
      dwellMs: 50,
      halfWidthCents: 50,
    });

    const frameHz = 440; // exact A4: +3.94 ¢ vs intended 439 Hz

    // Dwell: 3 frames × 20 ms = 60 ms ≥ 50 ms → entering settled
    for (let i = 0; i < 3; i++) tracker.pushFrame(goodFrame(i * 20, frameHz));

    // Settled: 5 more frames at same Hz
    for (let i = 3; i < 8; i++) tracker.pushFrame(goodFrame(i * 20, frameHz));

    const result = tracker.pushFrame(goodFrame(200, 100)); // exit
    assert(result !== null);
    expect(result.medianCents).not.toBeNull();
    const mc = result.medianCents ?? 0;
    // vs intended (439 Hz): ~+3.94 ¢. vs nearest-note (440 Hz, A4): 0.0 ¢.
    // A tolerance of ±0.2 ¢ around 3.94 ¢ confirms the intended-degree formula.
    expect(mc).toBeGreaterThan(3.5);
    expect(mc).toBeLessThan(4.5);
  });
});

// ── A4 calibration guard ────────────────────────────────────────────────────
//
// Regression: noteFromFrequency must use the same A4 reference as the plan.
// At baroque pitch (A4=415 Hz), an A4=440 grid shifts the MIDI rounding by
// ~100 ¢, so a perfectly in-tune note was classified as the wrong MIDI note
// and the octave guard permanently rejected it (drill froze).

describe('noteTracker — A4 calibration (baroque pitch A4=415)', () => {
  const A4_BAROQUE = 415;
  // MIDI 69 = A4, but at baroque pitch its Hz is 415 (not 440).
  const baroqueA4Hz = frequencyOfMidi(69, A4_BAROQUE);
  const baroqueOptions: TrackerOptions = {
    ...STANDARD_OPTIONS,
    a4: A4_BAROQUE,
  };

  it('advances the first target when frames are perfectly in-tune at A4=415', () => {
    // A minimal 2-target plan: A4 then A5, both at baroque pitch.
    const t0: DrillTarget = { index: 0, midiNote: 69, hz: baroqueA4Hz, degreeLabel: '1' };
    const t1: DrillTarget = { index: 1, midiNote: 81, hz: frequencyOfMidi(81, A4_BAROQUE), degreeLabel: '2' };
    const plan: readonly DrillTarget[] = [t0, t1];
    const tracker = createNoteTracker(plan, baroqueOptions);

    // settleScript drives frames at target.hz (415 Hz for A4 baroque) and fires advance.
    const result = runSettleScript(tracker, t0.hz, 0, 15, 16);
    expect(result).not.toBeNull();
    expect(tracker.getState().currentTargetIndex).toBe(1);
  });

  it('still rejects an octave-up frame at A4=415 (octave guard works at baroque pitch)', () => {
    const t0: DrillTarget = { index: 0, midiNote: 69, hz: baroqueA4Hz, degreeLabel: '1' };
    const plan: readonly DrillTarget[] = [t0];
    const tracker = createNoteTracker(plan, baroqueOptions);

    // One octave above: same pitch class but MIDI 81, not 69 — guard must reject.
    const octaveHz = baroqueA4Hz * 2;
    for (let i = 0; i < 25; i++) {
      tracker.pushFrame(goodFrame(i * 16, octaveHz));
    }
    // Exit frame (out of window) — should not advance since guard blocked settling.
    const exitResult = tracker.pushFrame(goodFrame(26 * 16, 200)); // 200 Hz is far off
    expect(exitResult).toBeNull();
    expect(tracker.getState().currentTargetIndex).toBe(0);
  });
});
