import { act, renderHook, waitFor } from '@testing-library/react';
import { A4_DEFAULT, frequencyOfNote } from '@violin-tools/theory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTuner } from './useTuner.ts';

// This suite exercises the ONE untestable-in-prod surface of the Tuner — the
// audio shell — by stubbing the Web Audio / getUserMedia globals jsdom lacks and
// driving a MANUAL rAF pump (no real frames, no timers-as-frames flake). The
// pure ph2/ph3 core is NOT mocked: the 440 Hz integration test synthesizes a real
// sine (via ph1's frequencyOfNote) and pushes it through the genuine detector +
// smoother, so a green readout proves the shell wires the real pipeline, not a
// stub. Everything is deterministic — no Math.random, no Date.

// ── Manual rAF pump ──────────────────────────────────────────────────────────
// requestAnimationFrame is stubbed to ENQUEUE callbacks rather than fire them, so
// a test advances the loop exactly N frames via `pumpFrames(n)`. This makes the
// rAF loop fully controllable (a real rAF never fires under jsdom, and fake
// timers wouldn't model the cancel/re-arm cleanly).
let rafQueue: Map<number, FrameRequestCallback>;
let rafNextId: number;

function installRaf(): void {
  rafQueue = new Map();
  rafNextId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    const id = rafNextId++;
    rafQueue.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    rafQueue.delete(id);
  });
}

/** Run up to `count` queued frames; each frame may re-enqueue the next (the loop). */
function pumpFrames(count: number): void {
  for (let i = 0; i < count; i++) {
    const entry = rafQueue.entries().next();
    if (entry.done) break;
    const [id, cb] = entry.value;
    rafQueue.delete(id);
    cb(performance.now());
  }
}

/**
 * Run one queued frame per supplied timestamp, passing that EXACT
 * `DOMHighResTimeStamp` to the rAF callback. The hook's readout-hold window is
 * measured against this value (not `performance.now()` or a frame count), so a
 * controlled, increasing sequence makes the bounded-hold tests deterministic with
 * no fake wall clock. Stops early if the loop drains (no frame queued).
 */
function pumpFramesAt(timestampsMs: readonly number[]): void {
  for (const ts of timestampsMs) {
    const entry = rafQueue.entries().next();
    if (entry.done) break;
    const [id, cb] = entry.value;
    rafQueue.delete(id);
    cb(ts);
  }
}

/** Number of frames currently queued (0 ⇒ the loop is paused / torn down). */
function pendingFrames(): number {
  return rafQueue.size;
}

// ── Fake AnalyserNode ────────────────────────────────────────────────────────
// `getFloatTimeDomainData` fills the caller's buffer with a configurable signal.
// Default is silence (zeros); a test swaps in a sine to drive the pipeline.
class FakeAnalyser {
  fftSize = 0;
  fillBuffer: (buf: Float32Array) => void = (buf) => buf.fill(0);
  connect = vi.fn();
  getFloatTimeDomainData(buf: Float32Array): void {
    this.fillBuffer(buf);
  }
}

// ── Fake AudioContext ────────────────────────────────────────────────────────
type CtxState = 'suspended' | 'running' | 'closed';

class FakeAudioContext {
  static lastInstance: FakeAudioContext | null = null;
  static initialState: CtxState = 'running';
  // When true, `resume()` REJECTS (the documented iOS failure where a suspended
  // context can't be resumed) instead of resolving to 'running'.
  static resumeRejects = false;
  state: CtxState;
  sampleRate = 48000;
  analyser = new FakeAnalyser();
  resume = vi.fn((): Promise<void> => {
    if (FakeAudioContext.resumeRejects) {
      return Promise.reject(new DOMException('cannot resume', 'InvalidStateError'));
    }
    this.state = 'running';
    return Promise.resolve();
  });
  suspend = vi.fn((): Promise<void> => {
    this.state = 'suspended';
    return Promise.resolve();
  });
  close = vi.fn((): Promise<void> => {
    this.state = 'closed';
    return Promise.resolve();
  });
  createAnalyser = vi.fn((): FakeAnalyser => this.analyser);
  createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
  constructor() {
    this.state = FakeAudioContext.initialState;
    FakeAudioContext.lastInstance = this;
  }
}

// ── Fake MediaStream / track ─────────────────────────────────────────────────
function makeStream(settings: Partial<MediaTrackSettings> = {}): {
  stream: MediaStream;
  stop: ReturnType<typeof vi.fn>;
} {
  const stop = vi.fn();
  const track = {
    stop,
    kind: 'audio',
    getSettings: (): MediaTrackSettings => ({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      ...settings,
    }),
  };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, stop };
}

// ── Global wiring ────────────────────────────────────────────────────────────
function installSupported(getUserMedia: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  vi.stubGlobal('AudioContext', FakeAudioContext);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
}

/** Force `document.hidden` and dispatch the visibilitychange event. */
function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  installRaf();
  FakeAudioContext.lastInstance = null;
  FakeAudioContext.initialState = 'running';
  FakeAudioContext.resumeRejects = false;
  setHidden(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useTuner — feature detection', () => {
  it('reports "unsupported" when navigator.mediaDevices is absent', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    vi.stubGlobal('AudioContext', FakeAudioContext);

    const { result } = renderHook(() => useTuner());
    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('unsupported');
  });

  it('reports "unsupported" outside a secure context', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    });
    vi.stubGlobal('AudioContext', FakeAudioContext);

    const { result } = renderHook(() => useTuner());
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('unsupported');
  });
});

describe('useTuner — permission state machine', () => {
  it('goes idle → requesting → listening on grant', async () => {
    const { stream } = makeStream();
    // A getUserMedia that resolves on the next microtask lets us observe the
    // transient 'requesting' state before 'listening'.
    let resolveGum!: (s: MediaStream) => void;
    const getUserMedia = vi.fn(
      (_constraints: MediaStreamConstraints) =>
        new Promise<MediaStream>((resolve) => {
          resolveGum = resolve;
        }),
    );
    installSupported(getUserMedia);

    const { result } = renderHook(() => useTuner());
    expect(result.current.status).toBe('idle');

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start();
    });
    // The await on getUserMedia is in flight — status is the transient 'requesting'.
    expect(result.current.status).toBe('requesting');

    await act(async () => {
      resolveGum(stream);
      await startPromise;
    });

    expect(result.current.status).toBe('listening');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    // Constraints: all three DSP stages explicitly off (AC#2).
    const constraints = getUserMedia.mock.calls[0]?.[0];
    expect(constraints?.audio).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    });
    expect(constraints?.video).toBe(false);
  });

  it('goes → denied on NotAllowedError', async () => {
    const getUserMedia = vi.fn(() =>
      Promise.reject(new DOMException('blocked', 'NotAllowedError')),
    );
    installSupported(getUserMedia);
    // Swallow the diagnostic warn the hook emits on a denied mic.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { result } = renderHook(() => useTuner());
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('denied');
    expect(warn).toHaveBeenCalled();
  });

  it('goes → denied on NotFoundError (no device)', async () => {
    const getUserMedia = vi.fn(() =>
      Promise.reject(new DOMException('no device', 'NotFoundError')),
    );
    installSupported(getUserMedia);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { result } = renderHook(() => useTuner());
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('denied');
  });

  it('resumes a suspended AudioContext inside start()', async () => {
    FakeAudioContext.initialState = 'suspended';
    const { stream } = makeStream();
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    installSupported(getUserMedia);

    const { result } = renderHook(() => useTuner());
    await act(async () => {
      await result.current.start();
    });

    const ctx = FakeAudioContext.lastInstance;
    expect(ctx?.resume).toHaveBeenCalled();
    expect(ctx?.state).toBe('running');
    expect(result.current.status).toBe('listening');
  });

  it('a rejecting ctx.resume() fails the start: status "denied", tracks stopped (no leak)', async () => {
    // The documented iOS failure (useTuner.ts L401–409): a suspended context whose
    // resume() REJECTS. The catch must release the session — stop the mic track AND
    // close the context — and set status 'denied', leaving no orphaned capture.
    FakeAudioContext.initialState = 'suspended';
    FakeAudioContext.resumeRejects = true;
    const { stream, stop } = makeStream();
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    installSupported(getUserMedia);

    const { result } = renderHook(() => useTuner());
    await act(async () => {
      await result.current.start();
    });

    const ctx = FakeAudioContext.lastInstance;
    expect(ctx?.resume).toHaveBeenCalled();
    // The catch path: session released (track stopped, context closed) and denied.
    expect(result.current.status).toBe('denied');
    expect(stop).toHaveBeenCalledTimes(1); // mic track stopped — no leak
    expect(ctx?.close).toHaveBeenCalledTimes(1); // context torn down too
    expect(pendingFrames()).toBe(0); // no rAF loop armed (start never adopted)
    expect(result.current.readout).toBeNull();
  });
});

describe('useTuner — detection loop (real ph2/ph3 integration)', () => {
  it('drives a 440 Hz sine to an A4 / in-tune readout', async () => {
    const { stream } = makeStream();
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    installSupported(getUserMedia);

    // A real 440 Hz sine at the fake context's 48k rate — the genuine ph2
    // detector + ph3 smoother turn this into the readout (no mocking the core).
    const a4Freq = frequencyOfNote(9, 4, A4_DEFAULT); // pc 9 (A), octave 4 = 440 Hz
    expect(a4Freq).toBeCloseTo(440, 6);
    const fillSine = (buf: Float32Array): void => {
      const w = (2 * Math.PI * a4Freq) / 48000;
      for (let i = 0; i < buf.length; i++) buf[i] = 0.8 * Math.sin(w * i);
    };

    const { result } = renderHook(() => useTuner());
    await act(async () => {
      await result.current.start();
    });
    // Point the analyser at the sine, then run several frames (the smoother needs
    // a few frames to fill its median window before it emits a settled label).
    FakeAudioContext.lastInstance!.analyser.fillBuffer = fillSine;
    act(() => {
      pumpFrames(10);
    });

    await waitFor(() => {
      expect(result.current.readout).not.toBeNull();
    });
    const readout = result.current.readout;
    expect(readout?.note).toBe('A');
    expect(readout?.octave).toBe(4);
    expect(readout?.inTune).toBe(true);
    expect(Math.abs(readout?.cents ?? 99)).toBeLessThanOrEqual(5);
  });

  it('reads sampleRate off the live context (no hardcoded 44100)', async () => {
    const { stream } = makeStream();
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    installSupported(getUserMedia);

    const { result } = renderHook(() => useTuner());
    await act(async () => {
      await result.current.start();
    });

    // Drive a sine generated at a NON-44100 rate (44100 would mis-detect if the
    // hook ignored ctx.sampleRate). The fake context reports 48000.
    const a4Freq = frequencyOfNote(9, 4, A4_DEFAULT);
    const ctx = FakeAudioContext.lastInstance!;
    expect(ctx.sampleRate).toBe(48000);
    ctx.analyser.fillBuffer = (buf: Float32Array): void => {
      const w = (2 * Math.PI * a4Freq) / ctx.sampleRate;
      for (let i = 0; i < buf.length; i++) buf[i] = 0.8 * Math.sin(w * i);
    };
    act(() => {
      pumpFrames(10);
    });

    await waitFor(() => {
      expect(result.current.readout?.note).toBe('A');
    });
    expect(result.current.readout?.octave).toBe(4);
  });
});

describe('useTuner — page visibility', () => {
  it('pauses the loop and suspends the context on hidden, resumes on visible', async () => {
    const { stream } = makeStream();
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    installSupported(getUserMedia);

    const { result } = renderHook(() => useTuner());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('listening');
    expect(pendingFrames()).toBeGreaterThan(0); // loop armed
    expect(result.current.paused).toBe(false);

    const ctx = FakeAudioContext.lastInstance!;

    // Hide the tab: the loop is cancelled and the context suspended (both fire
    // synchronously inside the visibility effect).
    act(() => {
      setHidden(true);
    });
    expect(result.current.paused).toBe(true);
    expect(pendingFrames()).toBe(0);
    expect(ctx.suspend).toHaveBeenCalled();
    expect(result.current.status).toBe('listening'); // session is alive, just gated

    // Show it again: the context resumes (a microtask) and the loop re-arms — the
    // waitFor below flushes that async resume → runLoop.
    act(() => {
      setHidden(false);
    });
    expect(result.current.paused).toBe(false);
    await waitFor(() => {
      expect(pendingFrames()).toBeGreaterThan(0);
    });
    expect(ctx.resume).toHaveBeenCalled();
  });
});

describe('useTuner — cleanup', () => {
  it('stop() cancels rAF, stops tracks, closes the context', async () => {
    const { stream, stop } = makeStream();
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    installSupported(getUserMedia);

    const { result } = renderHook(() => useTuner());
    await act(async () => {
      await result.current.start();
    });
    const ctx = FakeAudioContext.lastInstance!;
    expect(pendingFrames()).toBeGreaterThan(0);

    act(() => {
      result.current.stop();
    });

    expect(pendingFrames()).toBe(0);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(ctx.close).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
    expect(result.current.readout).toBeNull();
  });

  it('unmount cancels rAF, stops tracks, closes the context', async () => {
    const { stream, stop } = makeStream();
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    installSupported(getUserMedia);

    const { result, unmount } = renderHook(() => useTuner());
    await act(async () => {
      await result.current.start();
    });
    const ctx = FakeAudioContext.lastInstance!;

    unmount();

    expect(pendingFrames()).toBe(0);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(ctx.close).toHaveBeenCalledTimes(1);
  });

  // The leak the re-entrancy guard exists to prevent: the component unmounts (its
  // teardown runs) WHILE getUserMedia is still pending, then the grant resolves.
  // Without the mountedRef/token guard the hook would adopt the late-arriving
  // track + build a context that nothing tears down. With it, the resolved track
  // is stopped on the abort path and no context is ever constructed.
  it('unmount mid-request releases the late-arriving track (no leak, no throw)', async () => {
    const { stream, stop } = makeStream();
    // A deferred getUserMedia we resolve by hand AFTER unmount.
    let resolveGum!: (s: MediaStream) => void;
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveGum = resolve;
        }),
    );
    installSupported(getUserMedia);

    const { result, unmount } = renderHook(() => useTuner());

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start();
    });
    // The request is in flight (transient 'requesting'); nothing acquired yet.
    expect(result.current.status).toBe('requesting');
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    // Unmount BEFORE the grant resolves — teardown runs against still-null refs.
    unmount();
    expect(FakeAudioContext.lastInstance).toBeNull(); // no context built yet

    // NOW the grant resolves. The hook must release the track and build no context
    // — and must not throw (resolving into an unmounted hook is the trap).
    await act(async () => {
      resolveGum(stream);
      await expect(startPromise).resolves.toBeUndefined();
    });

    expect(stop).toHaveBeenCalledTimes(1); // late track stopped, not leaked
    expect(FakeAudioContext.lastInstance).toBeNull(); // never created a context
    expect(pendingFrames()).toBe(0); // no rAF loop armed
  });

  // Two start() calls in the same tick both close over a stale 'idle' status; the
  // synchronous startingRef latch makes the second a no-op, so getUserMedia is
  // called exactly once and only one context/stream is ever acquired (no orphan).
  it('double start() acquires exactly one context/stream (second call is a no-op)', async () => {
    const { stream, stop } = makeStream();
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    installSupported(getUserMedia);

    const { result } = renderHook(() => useTuner());

    await act(async () => {
      // Fire both before awaiting either — the second sees the first's in-flight
      // latch (the closed-over status is still 'idle' for both).
      const first = result.current.start();
      const second = result.current.start();
      await Promise.all([first, second]);
    });

    expect(getUserMedia).toHaveBeenCalledTimes(1); // second call never re-requested
    expect(result.current.status).toBe('listening');

    // Exactly one context, and tearing the session down releases exactly that one
    // (no orphaned stream/context from a doubled acquisition).
    const ctx = FakeAudioContext.lastInstance!;
    act(() => {
      result.current.stop();
    });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(ctx.close).toHaveBeenCalledTimes(1);
  });
});

describe('useTuner — bounded readout hold (#103)', () => {
  // A sine fill at an arbitrary frequency, so a test can SWEEP the pitch across
  // accepted frames (the tracking case). A positive `hz` past the gate is an
  // accepted frame; silence (the default fill) is a gated frame (RMS below floor
  // ⇒ ph2 `hz = -1` ⇒ ph3 returns null), the same dropout the hold rides out.
  const sineFill =
    (hz: number) =>
    (buf: Float32Array): void => {
      const w = (2 * Math.PI * hz) / 48000;
      for (let i = 0; i < buf.length; i++) buf[i] = 0.8 * Math.sin(w * i);
    };
  /** Frequency `cents` above A4 (440 Hz) — same note territory, progressively sharper. */
  const sharpOfA4 = (cents: number): number => 440 * Math.pow(2, cents / 1200);

  async function startListening() {
    const { stream } = makeStream();
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    installSupported(getUserMedia);
    const hook = renderHook(() => useTuner());
    await act(async () => {
      await hook.result.current.start();
    });
    return hook;
  }

  // AC#1 — CONTINUOUS TRACKING. Feed accepted frames whose pitch rises (A4 →
  // progressively sharper, same note) and assert the published cents track the
  // input direction — they climb across accepted frames, so the readout cannot be
  // a single latched value. (Pins the SUGGESTION #1 observable: a moving input,
  // not a held one, so "tracks" can't be satisfied by a frozen reading.)
  it('tracks continuously — published cents follow a rising pitch', async () => {
    const { result } = await startListening();
    const analyser = FakeAudioContext.lastInstance!.analyser;

    // A rising sweep, well within A4's territory (≤ ~40¢ sharp), one accepted frame
    // at a time so each frame reads the updated pitch. Timestamps advance 16ms/frame
    // (≈60fps) but stay FAR inside the 1500ms hold — no frame is gated here.
    const sweepCents = [0, 5, 10, 15, 20, 25, 30, 35, 40];
    const seen: number[] = [];
    sweepCents.forEach((cents, i) => {
      analyser.fillBuffer = sineFill(sharpOfA4(cents));
      act(() => {
        pumpFramesAt([1000 + i * 16]);
      });
      const r = result.current.readout;
      expect(r).not.toBeNull();
      seen.push(r!.cents);
    });

    // Held note stays A4 throughout (the sweep never leaves its territory).
    expect(result.current.readout?.note).toBe('A');
    expect(result.current.readout?.octave).toBe(4);
    // The EMA glides, so consecutive published cents are NON-DECREASING and the
    // last is strictly greater than the first — the readout moved with the input,
    // it did not latch.
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]! - 1e-9);
    }
    expect(seen[seen.length - 1]!).toBeGreaterThan(seen[0]! + 1);
  });

  // AC#2 — BOUNDED BLANK. Accepted frames establish a good readout, then sustained
  // GATED frames (silence ⇒ ph2 `hz=-1`) with timestamps advancing PAST the hold
  // window: the readout must revert to null (the neutral seeking state).
  it('blanks to null after the hold window elapses on a sustained dropout', async () => {
    const { result } = await startListening();
    const analyser = FakeAudioContext.lastInstance!.analyser;

    // Establish a good A4 readout (last accepted frame at t = 1000ms).
    analyser.fillBuffer = sineFill(440);
    act(() => {
      pumpFramesAt([200, 400, 600, 800, 1000]);
    });
    expect(result.current.readout).not.toBeNull();

    // Now silence (gated). Within the window (≤ 1000 + 1500 = 2500ms) it holds; the
    // last gated frame at 2700ms is 1700ms past the last accepted frame — past the
    // 1500ms bound — so it blanks.
    analyser.fillBuffer = (buf) => buf.fill(0);
    act(() => {
      pumpFramesAt([1500, 2000, 2400, 2700]);
    });

    expect(result.current.readout).toBeNull();
  });

  // AC#3 — NO STALE GREEN. After the window, there is no in-tune reading lingering:
  // `readout` is null ⇒ `hasSignal` (TunerView: `readout !== null`) is false, so the
  // meter shows the neutral seeking state, never a stale green.
  it('does not strand a stale in-tune reading after the window', async () => {
    const { result } = await startListening();
    const analyser = FakeAudioContext.lastInstance!.analyser;

    // A dead-on A4 ⇒ the last good readout is in-tune (green) — exactly the stale
    // reading that must NOT persist.
    analyser.fillBuffer = sineFill(440);
    act(() => {
      pumpFramesAt([200, 400, 600, 800, 1000]);
    });
    expect(result.current.readout?.inTune).toBe(true);

    // Sustained silence past the window.
    analyser.fillBuffer = (buf) => buf.fill(0);
    act(() => {
      pumpFramesAt([1500, 2200, 3000]);
    });

    // readout null ⇒ hasSignal false (no green): the seeking state, not a stale ✓.
    expect(result.current.readout).toBeNull();
  });

  // AC#4 — NO FLICKER. A gated run SHORTER than the hold window must NOT blank: the
  // last good readout is still showing (a momentary dropout doesn't tear the meter
  // down). This is the freeze the hold preserves; only a SUSTAINED gap blanks.
  it('holds the last good readout through a dropout shorter than the window', async () => {
    const { result } = await startListening();
    const analyser = FakeAudioContext.lastInstance!.analyser;

    analyser.fillBuffer = sineFill(440);
    act(() => {
      pumpFramesAt([200, 400, 600, 800, 1000]);
    });
    const held = result.current.readout;
    expect(held).not.toBeNull();

    // Silence, but every gated frame stays WITHIN 1500ms of the last accepted frame
    // (1000ms): 1200, 1600, 2000, 2400 are all ≤ 2500ms. The readout is unchanged.
    analyser.fillBuffer = (buf) => buf.fill(0);
    act(() => {
      pumpFramesAt([1200, 1600, 2000, 2400]);
    });

    expect(result.current.readout).not.toBeNull();
    expect(result.current.readout).toBe(held); // same object — never re-published
    expect(result.current.readout?.note).toBe('A');
    expect(result.current.readout?.inTune).toBe(true);
  });
});

describe('useTuner — A4 calibration', () => {
  it('clamps the initial A4 and exposes it', () => {
    const { result } = renderHook(() => useTuner({ initialA4: 999 }));
    expect(result.current.a4).toBe(446); // A4_MAX
  });

  it('defaults A4 to A4_DEFAULT', () => {
    const { result } = renderHook(() => useTuner());
    expect(result.current.a4).toBe(A4_DEFAULT);
  });

  it('setA4 clamps and updates the exposed value', () => {
    const { result } = renderHook(() => useTuner());
    act(() => {
      result.current.setA4(442);
    });
    expect(result.current.a4).toBe(442);
    act(() => {
      result.current.setA4(10);
    });
    expect(result.current.a4).toBe(415); // A4_MIN
  });

  it('a mid-session setA4 rebuilds the live smoother without restarting the rAF loop', async () => {
    // A4Calibration is a LIVE control: changing A4 while listening must rebuild the
    // running smoother (useTuner.ts L490–494, `if (smootherRef.current)`) so the
    // readout resolves against the NEW reference — and it must NOT tear down or
    // re-arm the detection loop (the session keeps running; the next frame seeds the
    // fresh smoother). 0-hit on main: the existing setA4 test never start()s.
    const { stream } = makeStream();
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    installSupported(getUserMedia);

    const { result } = renderHook(() => useTuner());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('listening');
    const armedFrames = pendingFrames();
    expect(armedFrames).toBeGreaterThan(0); // the loop is running

    // Recalibrate to A4 = 442 Hz mid-session. The A4=442 in-tune A4 pitch is 442 Hz
    // (frequencyOfNote(9, 4, 442)); feeding that raw frequency through a smoother
    // STILL keyed to 440 would read ~+8¢ sharp, so a green/in-tune A4 readout proves
    // the rebuilt smoother (a4=442) is the one wired to the loop.
    const a442Freq = frequencyOfNote(9, 4, 442);
    expect(a442Freq).toBeCloseTo(442, 6);
    act(() => {
      result.current.setA4(442);
    });
    expect(result.current.a4).toBe(442);
    // The loop was NOT torn down or re-armed: same in-flight frame still pending,
    // the session stayed 'listening' (rebuild is in-place, not a restart).
    expect(result.current.status).toBe('listening');
    expect(pendingFrames()).toBe(armedFrames);

    // Point the analyser at the 442 Hz sine and pump frames; the rebuilt smoother
    // resolves it to A4, in-tune (it would NOT be in-tune against the stale a4=440).
    FakeAudioContext.lastInstance!.analyser.fillBuffer = (buf: Float32Array): void => {
      const w = (2 * Math.PI * a442Freq) / 48000;
      for (let i = 0; i < buf.length; i++) buf[i] = 0.8 * Math.sin(w * i);
    };
    act(() => {
      pumpFrames(10);
    });

    await waitFor(() => {
      expect(result.current.readout).not.toBeNull();
    });
    expect(result.current.readout?.note).toBe('A');
    expect(result.current.readout?.octave).toBe(4);
    expect(result.current.readout?.inTune).toBe(true);
    expect(Math.abs(result.current.readout?.cents ?? 99)).toBeLessThanOrEqual(5);
  });
});
