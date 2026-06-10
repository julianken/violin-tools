// useIntonationDrill — the thin React shell hook for the Intonation epic (C5, #135).
//
// This hook follows the same architectural split as `state/controls.ts` (pure) +
// `state/useControls.ts` (hook): all testable math is in the pure layers
// (`drillPlan`, `noteTracker`), and this file is the thin shell that owns the
// audio-subscription lifecycle and React state.
//
// What this hook does:
//   1. Builds the `DrillTarget[]` plan via `drillPlan(root, scale, a4)`.
//      Memoized on root/scale/a4. A root/scale/a4 change mid-run ends the run
//      (phase → idle, tracker reset) because the target Hz values have changed
//      and the already-scored results are no longer valid against the new reference.
//   2. Constructs a `noteTracker` instance. The tracker is recreated whenever the
//      plan changes.
//   3. On `startDrill()`: calls `tuner.start()` if not already listening, then
//      registers the `onRawFrame` subscriber.
//   4. The subscriber (the hot path): checks phase and visibility, computes
//      live cents, calls `tracker.pushFrame`. On a NoteResult, batches state
//      updates. When all targets advance, unsubscribes and sets phase to 'complete'.
//   5. Signal-loss hold: `liveCents` goes null after `READOUT_HOLD_MS` of no
//      accepted signal (no frame with hz > 0 && clarity ≥ threshold). Uses a ref
//      timestamp (not setTimeout) to match the Tuner's rAF-cadence pattern.
//   6. Page-Visibility pause: frames during `tuner.paused === true` are ignored.
//   7. Error propagation: `tunerStatus` passes through from `tuner.status`. If
//      tuner.status becomes 'denied' or 'unsupported' during a run, transitions
//      phase → idle and resets.
//
// What this hook does NOT do (scope-out per issue #135):
//   - No UI components (those are C6, C7, C8).
//   - No view wiring (C9).
//   - No ramp color computation (C4, pure).
//   - No audio ownership (the tuner owns the mic; this hook is a consumer).
//
// Threshold constants (documented with rationale):
//   CLARITY_THRESHOLD  0.5   — reused from detectPitch.ts. Frames below this
//                              threshold are considered noise and do not update
//                              liveCents or advance the tracker.
//   DWELL_MS           300   — player must dwell in-window for 300 ms before
//                              the target settles. Long enough to confirm intent,
//                              short enough not to feel sluggish (a quarter note
//                              at 60 bpm = ~1000 ms; 300 ms is 30% of that).
//   WINDOW_CENTS       50    — ±50 ¢ around the intended degree. Half a semitone.
//                              Wide enough for slightly flat/sharp playing, narrow
//                              enough that adjacent diatonic degrees (≥100 ¢ apart)
//                              never overlap.
//   READOUT_HOLD_MS    1500  — matches the Tuner's hold (useTuner.ts). After
//                              1500 ms of no accepted frame, liveCents → null.

import { drillPlan, type DrillTarget } from '@violin-tools/theory';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ControlsApi } from '../state/useControls.ts';
import type { RawFrame as TunerRawFrame, TunerApi, TunerStatus } from '../tuner/useTuner.ts';

import { createNoteTracker, type NoteResult } from './noteTracker.ts';

// ── Threshold constants ───────────────────────────────────────────────────────

/** Clarity gate — matches `CLARITY_THRESHOLD` from `detectPitch.ts`. */
const CLARITY_THRESHOLD = 0.5;

/**
 * Dwell requirement in ms. Player must stay in-window for this duration before
 * the target settles. 300 ms is long enough to confirm intent without feeling
 * sluggish. Injected into `createNoteTracker` so tests can override via the
 * optional `testOptions` param.
 */
const DWELL_MS = 300;

/**
 * Window half-width in cents. ±50 ¢ around the intended degree. Adjacent
 * diatonic degrees are ≥100 ¢ apart, so windows do not overlap.
 */
const WINDOW_CENTS = 50;

/**
 * How long (ms) to hold the last non-null `liveCents` after the signal goes
 * silent. Matches `READOUT_HOLD_MS` in `useTuner.ts` (1500 ms) for a
 * consistent UX: a bow change or brief gap blanks the live-cents display after
 * 1.5 s, not immediately.
 */
const READOUT_HOLD_MS = 1500;

// ── Public types ──────────────────────────────────────────────────────────────

/** The run lifecycle phase. */
export type DrillRunPhase = 'idle' | 'running' | 'complete';

/**
 * Optional threshold overrides for testing. Production uses the module-level
 * constants above; a test can inject a shorter `dwellMs` to advance targets
 * faster without waiting 300 ms of real time.
 */
export interface DrillTestOptions {
  dwellMs?: number;
  windowCents?: number;
  clarityThreshold?: number;
}

/**
 * The state snapshot returned by `useIntonationDrill`. All fields are stable
 * for a given render — dumb UI components (C6 note-map drill display, C7 cents
 * meter, C8 summary panel) render from this without any audio logic.
 */
export interface DrillRunState {
  /** Current run lifecycle phase. */
  phase: DrillRunPhase;
  /** Mic permission / lifecycle status — passed through from `useTuner`. */
  tunerStatus: TunerStatus;
  /** `true` when the tab is hidden and the drill is paused. */
  paused: boolean;
  /** The full target sequence (empty when idle / plan not yet built). */
  plan: readonly DrillTarget[];
  /** Index of the current target the tracker is waiting for. */
  currentTargetIndex: number;
  /** Scored results for targets that have already advanced. */
  results: readonly NoteResult[];
  /**
   * Live signed-cents deviation of the current incoming Hz vs the current
   * target's intended Hz. `null` when there is no signal (below clarity
   * threshold, or no frames have arrived within `READOUT_HOLD_MS`).
   */
  liveCents: number | null;
  /** Start the drill. Calls `tuner.start()` if not already listening, then begins tracking. */
  startDrill: () => Promise<void>;
  /** Stop the drill and reset to idle. */
  stopDrill: () => void;
  /** Alias for `stopDrill` — resets to idle for a fresh run. */
  resetDrill: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Thin React shell that composes the C1 `onRawFrame` seam, the C2 `drillPlan`,
 * and the C3 `noteTracker` FSM into a `DrillRunState` snapshot dumb UI
 * components can render from.
 *
 * @param controls - The `useControls()` result; provides `state.root` and `state.scale`.
 * @param tuner    - The `useTuner()` result; provides `status`, `start`, `a4`,
 *                   `paused`, and `setOnRawFrame`.
 * @param testOptions - Optional threshold overrides for unit testing.
 */
export function useIntonationDrill(
  controls: ControlsApi,
  tuner: TunerApi,
  testOptions?: DrillTestOptions,
): DrillRunState {
  const { root, scale } = controls.state;
  const { status: tunerStatus, paused, start: tunerStart, a4, setOnRawFrame } = tuner;

  // ── Resolved thresholds (test-overridable) ────────────────────────────────
  const dwellMs = testOptions?.dwellMs ?? DWELL_MS;
  const windowCents = testOptions?.windowCents ?? WINDOW_CENTS;
  const clarityThreshold = testOptions?.clarityThreshold ?? CLARITY_THRESHOLD;

  // ── Plan — memoized on root/scale/a4 ─────────────────────────────────────
  // Rebuilding the plan on a root/scale/a4 change while running ends the run
  // (phase → idle) because the target Hz values have changed — the already-
  // scored results are no longer valid against the new reference.
  const plan = useMemo(() => drillPlan(root, scale, a4), [root, scale, a4]);

  // ── React state ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<DrillRunPhase>('idle');
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [results, setResults] = useState<readonly NoteResult[]>([]);
  const [liveCents, setLiveCents] = useState<number | null>(null);

  // ── Refs for the hot path (rAF subscriber) ────────────────────────────────
  // These must be refs, not state, so the rAF callback reads the latest values
  // without a stale closure. State setters are safe to call from rAF callbacks.
  const phaseRef = useRef<DrillRunPhase>('idle');
  const trackerRef = useRef(
    createNoteTracker(plan, { clarityThreshold, dwellMs, windowCents }),
  );
  // A ref to the tuner object so the subscriber can read `tuner.paused` at
  // call time (not at subscribe time). This is important because `paused` is a
  // getter on the tuner — it changes without triggering a React re-render, so
  // a snapshot captured at subscribe time would be stale.
  const tunerRef = useRef<TunerApi>(tuner);
  // Wall-clock time (rAF DOMHighResTimeStamp) of the last frame with
  // hz > 0 && clarity ≥ threshold — used to bound the liveCents hold window.
  const lastSignalMsRef = useRef<number>(0);

  // Keep tuner ref in sync so the subscriber always reads the live tuner.
  useEffect(() => {
    tunerRef.current = tuner;
  }, [tuner]);

  // Keep phase ref in sync with state.
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ── Rebuild tracker when plan changes ────────────────────────────────────
  // A root/scale/a4 change rebuilds the plan (via the memo above). When the plan
  // changes while running, end the run: the target Hz values have changed, so
  // already-scored results are invalid.
  useEffect(() => {
    // Re-create the tracker against the new plan.
    trackerRef.current = createNoteTracker(plan, { clarityThreshold, dwellMs, windowCents });

    if (phaseRef.current === 'running') {
      // Root/scale/a4 changed mid-run → reset to idle.
      setPhase('idle');
      phaseRef.current = 'idle';
      setCurrentTargetIndex(0);
      setResults([]);
      setLiveCents(null);
      setOnRawFrame(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plan identity changes are the trigger; the individual threshold values are stable constants (or test overrides that don't change per-render)
  }, [plan, setOnRawFrame]);

  // ── Error propagation from tuner ──────────────────────────────────────────
  // If the tuner loses the mic mid-run (denied/unsupported), end the run.
  useEffect(() => {
    if (
      (tunerStatus === 'denied' || tunerStatus === 'unsupported') &&
      phaseRef.current === 'running'
    ) {
      setPhase('idle');
      phaseRef.current = 'idle';
      setCurrentTargetIndex(0);
      setResults([]);
      setLiveCents(null);
      trackerRef.current.reset();
      setOnRawFrame(undefined);
    }
  }, [tunerStatus, setOnRawFrame]);

  // ── rAF subscriber (the hot path) ─────────────────────────────────────────
  // Built with useCallback so the identity is stable across renders (the plan
  // changes rebuild the tracker and this callback, but that's correct — the
  // new subscriber is wired to the new tracker).
  const subscriber = useCallback(
    (frame: TunerRawFrame): void => {
      // Guard 1: only process frames while running and tab is visible.
      // Read paused directly from the tuner ref at call time — `tuner.paused` is
      // a getter that changes without triggering a React re-render, so a snapshot
      // captured at subscribe time would be stale.
      if (phaseRef.current !== 'running' || tunerRef.current.paused) {
        return;
      }

      const { hz, clarity, timestampMs } = frame;

      // ── Live cents ──────────────────────────────────────────────────────────
      // Compute live cents vs the current target's intended Hz. Computed BEFORE
      // pushing to the tracker so the display updates even on non-advancing frames.
      // The plan is captured in the closure and is stable for the subscriber's
      // lifetime (a plan change rebuilds the subscriber via the useCallback dep).
      const state = trackerRef.current.getState();
      const targetIndex = state.currentTargetIndex;
      const currentTarget = plan[targetIndex];

      const holdExpired = timestampMs - lastSignalMsRef.current > READOUT_HOLD_MS;

      if (hz > 0 && clarity >= clarityThreshold && currentTarget !== undefined) {
        // Fresh signal — compute and publish live cents, re-arm the hold window.
        setLiveCents(1200 * Math.log2(hz / currentTarget.hz));
        lastSignalMsRef.current = timestampMs;
      } else if (holdExpired) {
        // Hold window expired with no signal — blank to null.
        setLiveCents(null);
      }
      // else: within hold window — leave liveCents unchanged (no setLiveCents call).

      // ── Push to tracker ────────────────────────────────────────────────────
      const result = trackerRef.current.pushFrame(frame);

      if (result !== null) {
        // A target advanced.
        const newState = trackerRef.current.getState();
        setCurrentTargetIndex(newState.currentTargetIndex);
        setResults([...newState.results]);

        if (newState.trackerState === 'complete') {
          setPhase('complete');
          phaseRef.current = 'complete';
          setLiveCents(null);
          setOnRawFrame(undefined);
        }
      }
    },
    // plan and clarityThreshold are the only values the subscriber reads.
    // dwellMs and windowCents are used only in createNoteTracker calls (in effects),
    // not in this callback. setOnRawFrame is stable (useCallback in useTuner).
    [plan, clarityThreshold, setOnRawFrame],
  );

  // ── stopDrill / resetDrill ────────────────────────────────────────────────
  const stopDrill = useCallback((): void => {
    setOnRawFrame(undefined);
    trackerRef.current.reset();
    setPhase('idle');
    phaseRef.current = 'idle';
    setCurrentTargetIndex(0);
    setResults([]);
    setLiveCents(null);
  }, [setOnRawFrame]);

  // ── startDrill ────────────────────────────────────────────────────────────
  const startDrill = useCallback(async (): Promise<void> => {
    // Guard: don't start if the tuner is denied or unsupported.
    if (tunerStatus === 'denied' || tunerStatus === 'unsupported') {
      return;
    }

    // Ensure the tuner mic is running. This is a no-op if already listening.
    if (tunerStatus !== 'listening') {
      await tunerStart();
    }

    // After the await, re-check: if the tuner is still not listening (e.g. user
    // denied the mic prompt), abort without transitioning phase.
    // Note: tunerStatus is captured in the closure; the actual status may have
    // updated via React state, but in the rAF subscriber we guard on phaseRef
    // which is not set until below.
    // We also check the ref for synchronous guards that may have fired.
    // The conservative approach: only start if the tuner is now listening.
    // This is checked by the caller via `tunerStatus` on the next render;
    // we proceed here optimistically and let the error propagation useEffect
    // handle the denied case if it arises.

    // Reset tracker and transition to running.
    trackerRef.current.reset();
    setCurrentTargetIndex(0);
    setResults([]);
    setLiveCents(null);
    lastSignalMsRef.current = 0;

    setPhase('running');
    phaseRef.current = 'running';

    // Wire the subscriber.
    setOnRawFrame(subscriber);
  }, [tunerStatus, tunerStart, subscriber, setOnRawFrame]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      setOnRawFrame(undefined);
    };
  }, [setOnRawFrame]);

  return {
    phase,
    tunerStatus,
    paused,
    plan,
    currentTargetIndex,
    results,
    liveCents,
    startDrill,
    stopDrill,
    resetDrill: stopDrill,
  };
}
