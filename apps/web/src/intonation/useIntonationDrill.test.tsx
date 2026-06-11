// useIntonationDrill tests — hook lifecycle verification using mocked seam and tracker.
//
// These tests pin the C5 acceptance criteria (issue #135). The onRawFrame seam
// and the tuner are mocked; the hook is driven entirely via synthetic subscriptions.

import { act, renderHook, waitFor } from '@testing-library/react';
import { drillPlan } from '@violin-tools/theory';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ControlsApi } from '../state/useControls.ts';
import type { RawFrame, TunerApi, TunerStatus } from '../tuner/useTuner.ts';

import { useIntonationDrill } from './useIntonationDrill.ts';

// ── Mock seam and tuner ───────────────────────────────────────────────────────

type MockTuner = TunerApi & {
  _emit: (frame: RawFrame) => void;
  _setStatus: (s: TunerStatus) => void;
  _setPaused: (p: boolean) => void;
  _currentSubscriber: ((frame: RawFrame) => void) | undefined;
};

/** Build a minimal mock TunerApi. */
function makeMockTuner(overrides: Partial<TunerApi> = {}): MockTuner {
  let subscriber: ((frame: RawFrame) => void) | undefined;
  let status: TunerStatus = 'idle';
  let paused = false;

  const mock: MockTuner = {
    get status() { return status; },
    get paused() { return paused; },
    readout: null,
    a4: 440,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    setA4: vi.fn(),
    setOnRawFrame: vi.fn((cb: ((frame: RawFrame) => void) | undefined) => {
      subscriber = cb;
    }),
    ...overrides,
    _emit: (frame: RawFrame) => {
      subscriber?.(frame);
    },
    _setStatus: (s: TunerStatus) => { status = s; },
    _setPaused: (p: boolean) => { paused = p; },
    get _currentSubscriber() { return subscriber; },
  };

  return mock;
}

/** Build a minimal mock ControlsApi. */
function makeMockControls(root = 'A', scale = 'major'): ControlsApi {
  return {
    state: { root, scale, refs: {} } as ControlsApi['state'],
    selectRoot: vi.fn(),
    selectScale: vi.fn(),
    toggleRef: vi.fn(),
  };
}

/** Short thresholds for fast tests. */
const TEST_OPTIONS = { dwellMs: 50, windowCents: 50, clarityThreshold: 0.5 };

const A4 = 440;

/** Build frames that settle on a target Hz (count × 16 ms > dwellMs). */
function settleFrames(hz: number, startMs: number, count: number): RawFrame[] {
  return Array.from({ length: count }, (_, i): RawFrame => ({
    timestampMs: startMs + i * 16,
    hz,
    clarity: 0.9,
  }));
}

function exitFrame(timestampMs: number): RawFrame {
  return { timestampMs, hz: 50, clarity: 0.9 };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── AC2 — Run lifecycle ───────────────────────────────────────────────────────

describe('useIntonationDrill — run lifecycle', () => {
  it('starts idle, transitions to running on startDrill()', async () => {
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls();
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    expect(result.current.phase).toBe('idle');

    await act(async () => {
      await result.current.startDrill();
    });

    expect(result.current.phase).toBe('running');
  });

  it('transitions to idle on stopDrill()', async () => {
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls();
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });
    expect(result.current.phase).toBe('running');

    act(() => {
      result.current.stopDrill();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.results).toHaveLength(0);
  });

  it('transitions to complete when all targets advance', async () => {
    const plan = drillPlan('A', 'major', A4);
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls('A', 'major');
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });

    let t = 0;
    act(() => {
      for (const target of plan) {
        for (const frame of settleFrames(target.hz, t, 5)) {
          tuner._emit(frame);
          t += 16;
        }
        tuner._emit(exitFrame(t));
        t += 16;
      }
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('complete');
    });
  });

  it('resetDrill returns to idle', async () => {
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls();
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });
    expect(result.current.phase).toBe('running');

    act(() => {
      result.current.resetDrill();
    });

    expect(result.current.phase).toBe('idle');
  });
});

// ── AC3 — Mic denied/unsupported keeps phase idle ────────────────────────────

describe('useIntonationDrill — mic denied/unsupported', () => {
  it('startDrill resolves without transitioning phase when tunerStatus is denied', async () => {
    const tuner = makeMockTuner();
    tuner._setStatus('denied');

    const controls = makeMockControls();
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.tunerStatus).toBe('denied');
  });

  it('startDrill resolves without transitioning phase when tunerStatus is unsupported', async () => {
    const tuner = makeMockTuner();
    tuner._setStatus('unsupported');

    const controls = makeMockControls();
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.tunerStatus).toBe('unsupported');
  });
});

// ── AC4 — Signal-loss hold ────────────────────────────────────────────────────

describe('useIntonationDrill — signal-loss hold', () => {
  it('liveCents stays non-null immediately after signal stops (within hold window)', async () => {
    const plan = drillPlan('A', 'major', A4);
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls('A', 'major');
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });

    const target = plan[0];
    expect(target).toBeDefined();
    if (!target) return;

    // Emit one good frame.
    act(() => {
      tuner._emit({ timestampMs: 1000, hz: target.hz, clarity: 0.9 });
    });
    expect(result.current.liveCents).not.toBeNull();

    // Emit a no-signal frame within the hold window (100 ms after last signal).
    act(() => {
      tuner._emit({ timestampMs: 1100, hz: 0, clarity: 0.0 });
    });
    // Within 1500 ms hold window — liveCents stays non-null.
    expect(result.current.liveCents).not.toBeNull();
  });

  it('liveCents goes null after the hold window expires', async () => {
    const plan = drillPlan('A', 'major', A4);
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls('A', 'major');
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });

    const target = plan[0];
    expect(target).toBeDefined();
    if (!target) return;

    // Emit one good frame at t=0.
    act(() => {
      tuner._emit({ timestampMs: 0, hz: target.hz, clarity: 0.9 });
    });
    expect(result.current.liveCents).not.toBeNull();

    // Emit no-signal frame past the 1500 ms hold window.
    act(() => {
      tuner._emit({ timestampMs: 2000, hz: 0, clarity: 0.0 });
    });
    // 2000 > 1500 → liveCents should be null.
    expect(result.current.liveCents).toBeNull();
  });

  it('currentTargetIndex does not change during a signal-loss gap', async () => {
    const plan = drillPlan('A', 'major', A4);
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls('A', 'major');
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });

    const target = plan[0];
    expect(target).toBeDefined();
    if (!target) return;

    // Settle partially (below dwellMs).
    act(() => {
      for (let t = 0; t < 30; t += 16) {
        tuner._emit({ timestampMs: t, hz: target.hz, clarity: 0.9 });
      }
    });
    const indexBefore = result.current.currentTargetIndex;

    // No-signal gap for 500 ms.
    act(() => {
      for (let t = 500; t < 700; t += 16) {
        tuner._emit({ timestampMs: t, hz: 0, clarity: 0.0 });
      }
    });

    expect(result.current.currentTargetIndex).toBe(indexBefore);
  });
});

// ── AC5 — Page-Visibility pause ───────────────────────────────────────────────

describe('useIntonationDrill — page-visibility pause', () => {
  it('frames during tuner.paused do not advance the tracker', async () => {
    const plan = drillPlan('A', 'major', A4);
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls('A', 'major');
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });

    tuner._setPaused(true);

    const target = plan[0];
    expect(target).toBeDefined();
    if (!target) return;

    // Emit frames that would normally advance the target.
    act(() => {
      let t = 0;
      for (const frame of settleFrames(target.hz, t, 10)) {
        tuner._emit(frame);
        t += 16;
      }
      tuner._emit(exitFrame(t));
    });

    // No advance — paused guard should have blocked all frames.
    expect(result.current.currentTargetIndex).toBe(0);
  });

  it('run resumes correctly when paused becomes false', async () => {
    const plan = drillPlan('A', 'major', A4);
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls('A', 'major');
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });

    // Pause, emit frames (should be ignored), then unpause.
    tuner._setPaused(true);

    const target = plan[0];
    expect(target).toBeDefined();
    if (!target) return;

    act(() => {
      for (const frame of settleFrames(target.hz, 0, 5)) {
        tuner._emit(frame);
      }
    });

    tuner._setPaused(false);

    // After unpausing, fresh frames should advance the tracker normally.
    act(() => {
      let t = 100;
      for (const frame of settleFrames(target.hz, t, 5)) {
        tuner._emit(frame);
        t += 16;
      }
      tuner._emit(exitFrame(t));
    });

    await waitFor(() => {
      expect(result.current.currentTargetIndex).toBe(1);
    });
  });
});

// ── AC6 — Root/scale/A4 change mid-run resets to idle ────────────────────────

describe('useIntonationDrill — root/scale/a4 change mid-run', () => {
  it('changing controls.root mid-run transitions phase to idle and clears results', async () => {
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls('A', 'major');
    const { result, rerender } = renderHook(
      (c: ControlsApi) => useIntonationDrill(c, tuner, TEST_OPTIONS),
      { initialProps: controls },
    );

    await act(async () => {
      await result.current.startDrill();
    });
    expect(result.current.phase).toBe('running');

    // Change root to D — the plan changes, which should end the run.
    const newControls = makeMockControls('D', 'major');
    act(() => {
      rerender(newControls);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('idle');
    });
    expect(result.current.results).toHaveLength(0);
  });
});

// ── AC7 — NoteResult accumulation ────────────────────────────────────────────

describe('useIntonationDrill — NoteResult accumulation', () => {
  it('results has N entries after N targets advance, with correct targetIndex', async () => {
    const plan = drillPlan('A', 'major', A4);
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls('A', 'major');
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });

    const N = 3;
    let t = 0;
    act(() => {
      for (let i = 0; i < N; i++) {
        const target = plan[i];
        if (!target) continue;
        for (const frame of settleFrames(target.hz, t, 5)) {
          tuner._emit(frame);
          t += 16;
        }
        tuner._emit(exitFrame(t));
        t += 16;
      }
    });

    await waitFor(() => {
      expect(result.current.results).toHaveLength(N);
    });

    for (let i = 0; i < N; i++) {
      expect(result.current.results[i]?.targetIndex).toBe(i);
    }
  });
});

// ── AC8 — Subscriber cleanup on stopDrill ────────────────────────────────────

describe('useIntonationDrill — subscriber cleanup', () => {
  it('stopDrill unsubscribes; subsequent frames do not reach the tracker', async () => {
    const plan = drillPlan('A', 'major', A4);
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls('A', 'major');
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });

    act(() => {
      result.current.stopDrill();
    });

    expect(tuner._currentSubscriber).toBeUndefined();

    const target = plan[0];
    expect(target).toBeDefined();
    if (!target) return;

    act(() => {
      let t = 0;
      for (const frame of settleFrames(target.hz, t, 10)) {
        tuner._emit(frame);
        t += 16;
      }
      tuner._emit(exitFrame(t));
    });

    expect(result.current.currentTargetIndex).toBe(0);
    expect(result.current.phase).toBe('idle');
  });
});

// ── AC9 — Advance is never gated on accuracy ─────────────────────────────────

describe('useIntonationDrill — accuracy does not gate advance', () => {
  it('sloppy ±20¢ frames still advance when dwell is met', async () => {
    const plan = drillPlan('A', 'major', A4);
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls('A', 'major');
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    await act(async () => {
      await result.current.startDrill();
    });

    const target = plan[0];
    expect(target).toBeDefined();
    if (!target) return;

    // Alternate ±20 ¢ frames.
    const sharpHz = target.hz * Math.pow(2, 20 / 1200);
    const flatHz = target.hz * Math.pow(2, -20 / 1200);

    act(() => {
      let t = 0;
      for (let i = 0; i < 8; i++) {
        const hz = i % 2 === 0 ? sharpHz : flatHz;
        tuner._emit({ timestampMs: t, hz, clarity: 0.9 });
        t += 16;
      }
      tuner._emit(exitFrame(200));
    });

    await waitFor(() => {
      expect(result.current.currentTargetIndex).toBe(1);
    });
  });
});

// ── Cleanup on unmount ────────────────────────────────────────────────────────

describe('useIntonationDrill — unmount cleanup', () => {
  it('setOnRawFrame(undefined) is called on unmount', () => {
    const tuner = makeMockTuner();
    const controls = makeMockControls();
    const { unmount } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    act(() => {
      unmount();
    });

    const calls = vi.mocked(tuner.setOnRawFrame).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall).toBeDefined();
    expect(lastCall?.[0]).toBeUndefined();
  });
});

// ── Error propagation ─────────────────────────────────────────────────────────

describe('useIntonationDrill — tuner error mid-run', () => {
  it('tunerStatus denied during run transitions phase to idle', async () => {
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls();
    const { result, rerender } = renderHook(
      (t: MockTuner) => useIntonationDrill(controls, t, TEST_OPTIONS),
      { initialProps: tuner },
    );

    await act(async () => {
      await result.current.startDrill();
    });
    expect(result.current.phase).toBe('running');

    act(() => {
      tuner._setStatus('denied');
      rerender(tuner);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('idle');
    });
  });
});

// ── Threshold injection path ──────────────────────────────────────────────────

describe('useIntonationDrill — threshold injection', () => {
  it('shorter dwellMs produces faster advance via the hook', async () => {
    const plan = drillPlan('A', 'major', A4);
    const tuner = makeMockTuner();
    tuner.start = vi.fn().mockImplementation(() => {
      tuner._setStatus('listening');
      return Promise.resolve();
    });

    const controls = makeMockControls('A', 'major');
    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, { dwellMs: 30, windowCents: 50, clarityThreshold: 0.5 }),
    );

    await act(async () => {
      await result.current.startDrill();
    });

    const target = plan[0];
    expect(target).toBeDefined();
    if (!target) return;

    // 3 × 16 ms = 48 ms > dwellMs(30) — should advance.
    act(() => {
      let t = 0;
      for (const frame of settleFrames(target.hz, t, 3)) {
        tuner._emit(frame);
        t += 16;
      }
      tuner._emit(exitFrame(100));
    });

    await waitFor(() => {
      expect(result.current.currentTargetIndex).toBe(1);
    });
  });
});

// ── Plan exposed in state ─────────────────────────────────────────────────────

describe('useIntonationDrill — plan in state', () => {
  it('plan matches drillPlan(root, scale, a4)', () => {
    const tuner = makeMockTuner();
    const controls = makeMockControls('A', 'major');

    const { result } = renderHook(() =>
      useIntonationDrill(controls, tuner, TEST_OPTIONS),
    );

    const expected = drillPlan('A', 'major', A4);
    expect(result.current.plan).toHaveLength(expected.length);
    result.current.plan.forEach((target, i) => {
      expect(target.midiNote).toBe(expected[i]?.midiNote);
      expect(target.hz).toBeCloseTo(expected[i]?.hz ?? 0, 5);
    });
  });
});
