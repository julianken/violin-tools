// useTuner — the audio shell hook of the Tuner (S18 ph4, epic #90).
//
// This is the ONLY code in the whole feature that touches Web Audio / the DOM —
// the thin shell that owns the microphone, the AudioContext, the AnalyserNode,
// and the rAF loop. Everything musical is pushed DOWN into the pure ph1–ph3
// layers: this file reads raw `Float32Array` frames + `ctx.sampleRate` and hands
// them straight to `detectPitchDetailed` (ph2) → the `TunerSmoother` (ph3); it
// makes no Hz/cents/sampleRate decision of its own (no hardcoded 44100 — the
// rate is read off the live context, AC#3). It mirrors the repo's
// `state/controls.ts` (pure) + `state/useControls.ts` (hook) split: the testable
// math is pure and unit-tested; this untestable surface is kept deliberately
// tiny. The UI capstone (ph6) renders the §17 surface from what this exposes.
//
// The documented Web Audio traps this shell defends against (from the #90
// deep-dive):
//   • A user gesture is REQUIRED. `getUserMedia` + AudioContext creation /
//     `resume()` happen inside `start()`, which the UI wires to the "Start
//     tuner" tap (§17.6). A context built on load is `suspended` and silently
//     produces nothing, so we resume an already-suspended context too.
//   • Constraints OFF. echoCancellation / noiseSuppression / autoGainControl all
//     `false` — those DSP stages distort pitch and level (AGC pumps the gate).
//     We verify they actually applied via `track.getSettings()` (AC#2) and warn
//     if the browser ignored a constraint (a tuner still works, just noisier).
//   • Page Visibility. rAF throttles / pauses on a hidden tab and the audio
//     exemption does NOT cover a capture-only tuner, so we pause the loop AND
//     suspend the context on `document.hidden`, resuming on visible (§17.8).
//   • Permission is terminal. A denied mic cannot be re-prompted programmatically
//     (the browser remembers the block) — `start()` resolving to `denied` is a
//     dead end the UI recovers from by guiding to settings (§17.6 / ph6), never a
//     no-op retry.
//
// Status ↔ Permissions API mapping (canonical — resolves the #94 plan-review
// SUGGESTION that the issue's names diverged from the epic's `prompt/granted`
// enumeration). The hook's vocabulary is the single source of truth ph6 consumes:
//   'unsupported'  — no secure context / no getUserMedia (no Permissions state).
//   'idle'         ≈ permission 'prompt'  — supported, not yet asked / stopped.
//   'requesting'   — the getUserMedia await is in flight (a transient, no
//                    Permissions-API equivalent — the browser is showing its
//                    prompt or resolving a remembered grant).
//   'listening'    ≈ permission 'granted' — the rAF loop is running.
//   'denied'       ≈ permission 'denied'  — terminal until the user changes it
//                    in settings.

import { A4_DEFAULT, clampA4 } from '@violin-tools/theory';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { CLARITY_THRESHOLD, detectPitchDetailed } from './detectPitch.ts';
import { createTunerSmoother, type Readout, type TunerSmoother } from './smoothing.ts';

/**
 * The microphone-permission lifecycle, the contract ph6's §17.6 states render
 * from. See the module header for the full Permissions-API mapping; in short:
 * `unsupported` (no secure context / API), `idle` ≈ `prompt`, `requesting` (the
 * grant await), `listening` ≈ `granted`, `denied` ≈ `denied` (terminal).
 */
export type TunerStatus = 'unsupported' | 'idle' | 'requesting' | 'listening' | 'denied';

/**
 * A single pre-smoothing pitch frame emitted by the `onRawFrame` seam.
 *
 * Emitted between `detectPitchDetailed` and `smoother.push` — so it carries the
 * raw detector output BEFORE the median/EMA/hysteresis chain runs. Consumers may
 * store the frame by reference; each emission is a fresh object literal (one
 * ephemeral allocation per subscribed frame) so no consumer ever observes a
 * mutated stale frame. Do NOT pool/reuse a single mutable frame object here — a
 * consumer that holds a ref to the frame would receive silently-wrong data.
 */
export interface RawFrame {
  /** The rAF `DOMHighResTimeStamp` for this frame (same epoch as `performance.now()`). */
  timestampMs: number;
  /** Detected fundamental in Hz, or the ph2 sentinel −1 when nothing was detected. */
  hz: number;
  /** NSDF clarity [0, 1]; frames below `CLARITY_THRESHOLD` are gated by the smoother. */
  clarity: number;
}

/** The AnalyserNode window. 2048 holds ≥2 periods of G3 (196 Hz) at 48k; never < 1024. */
const FFT_SIZE = 2048;

/**
 * How long (in wall-clock ms) to keep showing the last good readout after the
 * signal stops before falling back to the neutral "seeking" state (§17.7).
 *
 * ph3's `push` returns `null` for a gated frame (low clarity / `hz ≤ 0`), which
 * means "freeze, don't blank" — the right call for a momentary dropout (a bow
 * change, a brief un-voiced gap) so the meter doesn't flicker. But a `null` push
 * skips `setReadout`, so without a bound the LAST good `readout` would survive
 * **indefinitely** — only `stop()` ever nulls it — leaving a stale (possibly
 * in-tune / green) reading on screen long after the player stopped sounding. We
 * bound the hold: if no accepted frame has arrived within `READOUT_HOLD_MS`, we
 * blank to `null` so the existing `readout === null` seeking branch renders.
 *
 * 1500 ms is long enough to ride out the dropouts above without flicker, short
 * enough that a genuinely-stopped tuner returns to "listening…" promptly. The
 * window is measured against the `DOMHighResTimeStamp` the rAF callback receives
 * — NOT a frame count — because the rAF cadence is display-dependent (60 / 90 /
 * 120 Hz), so a frame count at an assumed 60 fps would blank at the wrong
 * wall-clock time on a high-refresh display.
 */
const READOUT_HOLD_MS = 1500;

/** The mic constraints — all three browser DSP stages OFF (they distort pitch/level). */
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

/** What `useTuner` exposes to the UI (ph6 renders the §17 surface from this). */
export interface TunerApi {
  /** The current permission/lifecycle state (§17.6). */
  status: TunerStatus;
  /**
   * The latest stabilized reading, or `null` when nothing confident is showing —
   * either nothing has been detected yet, or the signal stopped. ph3 returns
   * `null` for a gated frame ("freeze"); we hold the last good `readout` across a
   * brief dropout rather than blanking, but only for `READOUT_HOLD_MS` — once the
   * signal stays gone past that bound we revert to `null` so the UI falls back to
   * the neutral seeking state (§17.7) instead of stranding a stale reading.
   */
  readout: Readout | null;
  /**
   * `true` when the loop is paused because the tab is hidden (Page Visibility,
   * §17.8). The status stays `listening` — the session is alive, just gated — so
   * the UI can show a "paused" affordance without tearing the meter down.
   */
  paused: boolean;
  /**
   * Begin tuning. MUST be called from a user gesture (the "Start tuner" tap):
   * feature-detects a secure context + `getUserMedia`, requests the mic, builds
   * the audio graph, and starts the rAF loop. Resolves to `denied` on a blocked
   * or missing mic, `unsupported` on a non-secure / capability-less browser.
   */
  start: () => Promise<void>;
  /** Stop tuning and release everything (rAF, tracks, context). Idempotent. */
  stop: () => void;
  /** The A4 calibration reference in Hz (clamped to the §13 range, default 440). */
  a4: number;
  /** Set the A4 reference; flows into the ph1 conversions via the live smoother. */
  setA4: (a4: number) => void;
}

/** Options for `useTuner`. `initialA4` seeds the calibration (default `A4_DEFAULT`). */
export interface UseTunerOptions {
  /** Starting A4 reference in Hz; clamped to the §13 calibration range. */
  initialA4?: number;
  /**
   * Optional pre-smoothing frame subscriber.
   *
   * Called on every rAF tick at the exact point after `detectPitchDetailed`
   * resolves and **before** `smoother.push` — so gated frames (clarity below
   * threshold, or `hz ≤ 0`) reach the callback even though the displayed readout
   * never changes. Held in a ref so a mid-session change does NOT re-create the
   * rAF loop; passing `undefined` (or omitting the option) stops the callback.
   *
   * Contract: the callback MUST NOT throw — a throwing subscriber is caught,
   * logged as a warning, and does not kill the rAF loop. Consumers that need
   * to re-schedule work should enqueue via a ref, not call state setters
   * directly (to avoid driving extra renders on every frame).
   */
  onRawFrame?: (frame: RawFrame) => void;
}

/**
 * Feature-detect a usable capture context AT CALL TIME (never cached at module
 * load — a test or an embedding may stub these after import). A capture-only
 * tuner needs both a secure context (getUserMedia is gated on it) and the
 * `mediaDevices.getUserMedia` API itself. Returns false → status `unsupported`.
 */
function isCaptureSupported(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  // The DOM lib types `mediaDevices` as always-present, but jsdom and insecure
  // origins leave it (or `getUserMedia`) undefined — re-type optional and
  // feature-detect, mirroring the `navigator.clipboard` idiom in useShareLink.
  const nav = navigator as Omit<Navigator, 'mediaDevices'> & {
    mediaDevices?: MediaDevices;
  };
  return typeof nav.mediaDevices?.getUserMedia === 'function';
}

/**
 * Resolve the `AudioContext` constructor, preferring the standard global and
 * falling back to the prefixed `webkitAudioContext` some Safari builds still
 * expose. Returns `null` when neither exists (older / headless environments) so
 * `start()` can route to `unsupported` rather than throwing.
 */
function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Subscribe to `document.hidden` via `useSyncExternalStore` (the React-19-correct
 * way to read an external source, mirroring `useIsLandscape`). The synchronous
 * `getSnapshot` makes the first render correct; the server snapshot is `false`
 * (a hidden document never renders on the server).
 */
function subscribeVisibility(onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => undefined;
  document.addEventListener('visibilitychange', onChange);
  return () => {
    document.removeEventListener('visibilitychange', onChange);
  };
}

function getVisibilitySnapshot(): boolean {
  return typeof document !== 'undefined' && document.hidden;
}

function useDocumentHidden(): boolean {
  return useSyncExternalStore(subscribeVisibility, getVisibilitySnapshot, () => false);
}

/**
 * The audio shell hook. Owns the mic-permission lifecycle and a running rAF
 * detection loop, exposing the current `Readout`, a status state machine, the
 * paused flag, and an adjustable A4. Construct it once per Tuner view; the UI
 * calls `start()` from the gesture and `stop()` to tear down (unmount cleans up
 * automatically, so a forgotten `stop()` never leaks a track or context).
 */
export function useTuner(options: UseTunerOptions = {}): TunerApi {
  const [status, setStatus] = useState<TunerStatus>('idle');
  const [readout, setReadout] = useState<Readout | null>(null);
  const [a4, setA4State] = useState<number>(() => clampA4(options.initialA4 ?? A4_DEFAULT));

  // ── Mutable audio-graph handles, held in refs (not state — they must not drive
  //    renders, and the rAF loop reads them synchronously). All null when stopped.
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const smootherRef = useRef<TunerSmoother | null>(null);
  // Wall-clock time (the rAF `DOMHighResTimeStamp`) of the last ACCEPTED frame —
  // the bound for the readout hold. A gated (null) frame keeps the last good
  // readout only while `(now − lastAcceptedMs) ≤ READOUT_HOLD_MS`; past that we
  // blank to the neutral seeking state. Set on start() and on every accepted
  // frame. The rAF timestamp (not a frame counter) makes the window display-rate
  // independent — see READOUT_HOLD_MS.
  const lastAcceptedMsRef = useRef<number>(0);
  // The live A4 the loop reads each frame (a ref so a mid-session calibration
  // change reaches the rebuilt smoother without re-arming the loop via deps).
  const a4Ref = useRef<number>(a4);
  // The live onRawFrame subscriber (a ref so a mid-session change — or a first-
  // time subscription — does NOT re-create the rAF loop). A useEffect below keeps
  // the ref current on every render where options.onRawFrame has changed.
  const onRawFrameRef = useRef<((frame: RawFrame) => void) | undefined>(
    options.onRawFrame,
  );
  // ── Lifecycle guards (synchronous — the `status` state lags behind two calls in
  //    the same tick, so the abort decisions below cannot rely on it). ───────────
  //  • `mountedRef` flips false in the unmount cleanup, so a start() whose
  //    getUserMedia / resume() resolves AFTER unmount knows to release, not adopt,
  //    what it acquired (the closed-over teardown can't see the new refs yet).
  //  • `startingRef` is a synchronous re-entry latch: set the instant a start()
  //    commits to acquiring (before the first await), cleared on every exit. A
  //    second start() in the same tick sees it set and no-ops, so getUserMedia is
  //    called exactly once — the closed-over `status` is still a stale 'idle'.
  //  • `startTokenRef` is a monotonically-incrementing session id. Each start()
  //    captures a fresh token at the top; after every await it checks it still
  //    holds the latest one. A stop()/unmount (or a later start) bumps the token,
  //    superseding any in-flight start so it tears down its own acquisitions and
  //    bails instead of orphaning a context/stream.
  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const startTokenRef = useRef(0);

  const hidden = useDocumentHidden();
  // `paused` is only meaningful while a session is live (status 'listening').
  const paused = status === 'listening' && hidden;

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ── rAF frame: read the analyser, run ph2 → ph3, publish the readout. ────────
  // Stable across renders — it reads only refs + state setters (never props/state
  // directly), so it never goes stale and is invoked ONLY inside rAF, never during
  // render. It re-schedules itself by name (a hoisted function declaration so the
  // self-reference is legal), so a single requestAnimationFrame(tick) runs the
  // whole loop until cancelled. It consumes the rAF `DOMHighResTimeStamp` to bound
  // the readout hold (see below + READOUT_HOLD_MS).
  const tick = useCallback(function frame(frameTimeMs: number): void {
    const analyser = analyserRef.current;
    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    const smoother = smootherRef.current;
    if (!analyser || !ctx || !buffer || !smoother) return;

    analyser.getFloatTimeDomainData(buffer);
    const { hz, clarity } = detectPitchDetailed(buffer, ctx.sampleRate);

    // ── onRawFrame seam (pre-smoothing) ────────────────────────────────────────
    // Emit BEFORE smoother.push so the subscriber receives every detector frame,
    // including clarity-gated and hz≤0 frames the smoother gates out. Each call
    // creates a fresh object literal (one ephemeral allocation per subscribed
    // frame) — do NOT reuse a mutable frame object because a consumer may store
    // the reference and would observe a silently mutated stale frame. The
    // try/catch ensures a throwing subscriber never kills the rAF loop.
    const rawSubscriber = onRawFrameRef.current;
    if (rawSubscriber !== undefined) {
      try {
        rawSubscriber({ timestampMs: frameTimeMs, hz, clarity });
      } catch (err: unknown) {
        console.warn('useTuner: onRawFrame subscriber threw; ignoring to protect the rAF loop', err);
      }
    }

    const next = smoother.push({ hz, clarity });
    if (next !== null) {
      // An accepted frame: publish it and re-arm the hold window.
      lastAcceptedMsRef.current = frameTimeMs;
      setReadout(next);
    } else if (frameTimeMs - lastAcceptedMsRef.current > READOUT_HOLD_MS) {
      // A gated frame (ph3 "freeze") past the hold window: stop holding the stale
      // reading and blank to the neutral seeking state (§17.7 — `readout === null`
      // renders "listening…"). Within the window we keep the last good readout so
      // a momentary dropout (a bow change, a brief gap) doesn't flicker.
      setReadout(null);
    }

    rafRef.current = requestAnimationFrame(frame);
  }, []);

  const runLoop = useCallback(() => {
    cancelRaf();
    rafRef.current = requestAnimationFrame(tick);
  }, [cancelRaf, tick]);

  // ── Release one acquired session — stop its tracks, close its context. ───────
  // Operates on locals (not the refs) so it can also release an acquisition an
  // aborted start() never published to the refs (the unmount-mid-request leak).
  // Idempotent on a given pair: a double-close throws in some browsers, so we
  // guard on the context state.
  const releaseSession = useCallback((stream: MediaStream | null, ctx: AudioContext | null) => {
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    if (ctx && ctx.state !== 'closed') {
      // close() returns a promise; we don't await it (teardown is sync).
      void ctx.close();
    }
  }, []);

  // ── Full teardown — cancel the loop, stop tracks, close the context. ─────────
  // Idempotent: safe to call from stop(), the unmount cleanup, and a failed
  // start() alike. Bumping the start token supersedes any in-flight start() so a
  // getUserMedia/resume() that resolves after this won't adopt a now-dead
  // session. Closing the context releases the underlying audio hardware.
  const teardown = useCallback(() => {
    startTokenRef.current += 1;
    startingRef.current = false;
    cancelRaf();
    releaseSession(streamRef.current, ctxRef.current);
    streamRef.current = null;
    ctxRef.current = null;
    analyserRef.current = null;
    bufferRef.current = null;
    smootherRef.current = null;
  }, [cancelRaf, releaseSession]);

  const stop = useCallback(() => {
    teardown();
    setReadout(null);
    setStatus('idle');
  }, [teardown]);

  const start = useCallback(async (): Promise<void> => {
    // ── Re-entrancy guard (synchronous) ───────────────────────────────────────
    // Reading `status` is not enough: two start() calls in the same tick both
    // close over a stale 'idle' and both proceed (the setStatus is async), each
    // owning a context/stream — the first orphaned. So gate synchronously: a live
    // session (refs set), an in-flight start (`startingRef`), or a status already
    // requesting/listening makes this call a no-op. Then claim the session: latch
    // `startingRef` and a fresh token, and after every await assert this start
    // still holds the latest token (a stop()/unmount bumps it). On abort, release
    // whatever was acquired so nothing the refs never adopted can leak.
    if (status === 'listening' || status === 'requesting') return;
    if (startingRef.current || streamRef.current !== null || ctxRef.current !== null) return;
    startingRef.current = true;
    const token = (startTokenRef.current += 1);
    const superseded = (): boolean => !mountedRef.current || startTokenRef.current !== token;

    // ── Feature detection (AC#1) ──────────────────────────────────────────────
    if (!isCaptureSupported()) {
      startingRef.current = false;
      setStatus('unsupported');
      return;
    }
    const AudioContextCtor = getAudioContextCtor();
    if (AudioContextCtor === null) {
      startingRef.current = false;
      setStatus('unsupported');
      return;
    }

    setStatus('requesting');

    // ── Microphone request (AC#1 / AC#2) ──────────────────────────────────────
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
        video: false,
      });
    } catch (err: unknown) {
      // NotAllowedError (blocked) and NotFoundError (no device) are both terminal
      // — the UI guides to settings (§17.6), it cannot re-prompt. Any other
      // failure (e.g. a transient device error) also lands here as denied; ph6
      // recovery copy covers it.
      if (superseded()) return; // teardown already cleared startingRef + moved on
      startingRef.current = false;
      setStatus('denied');
      if (err instanceof DOMException) {
        // Surfaced for diagnostics only; the state above is what the UI renders.
        console.warn(`Tuner: getUserMedia failed (${err.name})`);
      }
      return;
    }

    // The mic resolved AFTER an unmount or a superseding stop(): nothing will ever
    // tear this track down via the refs, so release it here and bail — this is the
    // unmount-mid-request leak the guard exists to prevent. (teardown already
    // cleared startingRef.)
    if (superseded()) {
      releaseSession(stream, null);
      return;
    }

    // ── Verify the constraints actually applied (AC#2) ────────────────────────
    // Some browsers silently ignore a constraint; a tuner still works, but a left-
    // on AGC/NS will fight the gate, so we warn rather than fail.
    const track = stream.getAudioTracks()[0];
    if (track) {
      const settings = track.getSettings();
      for (const key of ['echoCancellation', 'noiseSuppression', 'autoGainControl'] as const) {
        if (settings[key] === true) {
          console.warn(`Tuner: browser ignored ${key}:false (left it on)`);
        }
      }
    }

    // ── Build the audio graph ─────────────────────────────────────────────────
    const ctx = new AudioContextCtor();
    // A context constructed inside the gesture is usually 'running', but some
    // engines still hand back 'suspended' — resume so the analyser actually pulls
    // samples (a suspended context silently produces a buffer of zeros).
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // A resume rejection is rare; treat it as a failed start and clean up.
        releaseSession(stream, ctx);
        if (superseded()) return; // teardown already cleared startingRef
        startingRef.current = false;
        setStatus('denied');
        return;
      }
    }

    // The resume await is a second suspension point — re-check before adopting the
    // context, releasing both the track and the now-orphaned context if superseded.
    if (superseded()) {
      releaseSession(stream, ctx);
      return;
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    ctx.createMediaStreamSource(stream).connect(analyser);

    // The detector reads ctx.sampleRate at runtime (AC#3 — never hardcode 44100).
    // The smoother's clarity gate is wired to ph2's CLARITY_THRESHOLD so the two
    // thresholds CANNOT silently drift (resolves the #93/ph3 review SUGGESTION).
    const smoother = createTunerSmoother({
      clarityThreshold: CLARITY_THRESHOLD,
      a4: a4Ref.current,
    });

    streamRef.current = stream;
    ctxRef.current = ctx;
    analyserRef.current = analyser;
    bufferRef.current = new Float32Array(FFT_SIZE);
    smootherRef.current = smoother;
    // Session adopted into the refs — teardown now owns it; release the synchronous
    // re-entry latch (the live refs/status guard re-entry from here on).
    startingRef.current = false;

    // Anchor the readout-hold window to session start (the rAF timestamp this
    // session's first accepted frame would carry), so the first gated frames don't
    // measure against a stale `lastAcceptedMs` from a previous session or epoch 0.
    // Every accepted frame re-arms it from there (see `tick`).
    lastAcceptedMsRef.current = typeof performance !== 'undefined' ? performance.now() : 0;

    setStatus('listening');
    // If the tab is already hidden, the visibility effect will hold the loop; an
    // unconditional runLoop() here is harmless (the effect re-evaluates on mount/
    // status change and cancels it), but starting it keeps the visible case crisp.
    if (!getVisibilitySnapshot()) runLoop();
  }, [status, runLoop, releaseSession]);

  // ── Page Visibility gate (§17.8) ─────────────────────────────────────────────
  // While listening, pause the loop AND suspend the context on hidden; resume the
  // context and re-arm the loop on visible. Suspending releases the capture work
  // the throttled rAF would otherwise leave half-running.
  useEffect(() => {
    if (status !== 'listening') return;
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (hidden) {
      cancelRaf();
      if (ctx.state === 'running') void ctx.suspend();
    } else {
      // The ph4 review SUGGESTION (benign hardening): `ctx.resume()` is async, so
      // between the await and its resolution a `stop()`/unmount (or a tab that
      // re-hid) could have torn the session down. Re-arm the loop ONLY if THIS
      // context is still the live one — guard on the ref identity (teardown nulls
      // it) so a resume that resolves after teardown never re-starts a dead loop.
      const resumeAndRun = (): void => {
        if (ctxRef.current === ctx && !getVisibilitySnapshot()) runLoop();
      };
      if (ctx.state === 'suspended') {
        ctx.resume().then(resumeAndRun, resumeAndRun);
      } else {
        resumeAndRun();
      }
    }
  }, [hidden, status, cancelRaf, runLoop]);

  // ── A4 calibration → live smoother ───────────────────────────────────────────
  // The smoother is constructed with a fixed A4, so a mid-session change rebuilds
  // it (preserving the running session — the next frame seeds the fresh smoother).
  // The A4 also flows to a future start() via the ref.
  const setA4 = useCallback((next: number) => {
    const clamped = clampA4(next);
    a4Ref.current = clamped;
    setA4State(clamped);
    if (smootherRef.current) {
      smootherRef.current = createTunerSmoother({
        clarityThreshold: CLARITY_THRESHOLD,
        a4: clamped,
      });
    }
  }, []);

  // ── onRawFrame ref sync ──────────────────────────────────────────────────────
  // Keep the subscriber ref current on every render (without a dep-list this
  // fires after every render — acceptable because it's a cheap assignment and the
  // rAF loop never re-creates). Passing `undefined` clears the ref, which stops
  // the callback from firing on the next frame (AC8 — clean unsubscribe).
  useEffect(() => {
    onRawFrameRef.current = options.onRawFrame;
  });

  // ── Unmount cleanup (AC#5) ───────────────────────────────────────────────────
  // Release everything on unmount so a navigated-away Tuner never leaks a live
  // mic track or an open AudioContext. Flipping `mountedRef` first makes any
  // start() whose getUserMedia/resume() resolves AFTER this release (rather than
  // adopt) what it acquired — without it, a request in flight at unmount would
  // build a context/stream the (already-run) teardown can never reach. `teardown`
  // is stable, so this effect runs once; the cleanup runs on unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  return { status, readout, paused, start, stop, a4, setA4 };
}
