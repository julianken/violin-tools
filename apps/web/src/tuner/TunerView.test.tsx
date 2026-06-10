import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TunerView } from './TunerView.tsx';

// TunerView state + a11y tests (DESIGN.md §17.6 / §17.9). DESIGN.md §17 wins on any
// conflict (AGENTS.md). The view owns `useTuner()`; jsdom lacks Web Audio +
// getUserMedia, so we stub those globals (mirroring useTuner.test) to DRIVE the
// real permission state machine through idle → listening / denied / unsupported and
// assert the §17.6 surfaces render. The §17.9 announcer is asserted EMPTY at load
// (the live region exists before its first write) and the §17.7/§11.1 colour-
// redundancy cues (the ✓ word, the ♯/♭ words) are present.
//
// The rendered-readout + announcer suites below DRIVE a real pitch through the
// genuine ph2/ph3 pipeline: a configurable analyser is filled with a real sine
// (the `useTuner.test.tsx` sine-fill pattern, adapted here — that harness exports
// nothing, so the fixture is copied, not imported) and a MANUAL rAF pump runs N
// frames so the smoother fills its median window and emits a settled `readout`.

// ── Manual rAF pump (copied/adapted from useTuner.test.tsx) ───────────────────
// requestAnimationFrame ENQUEUES callbacks rather than firing them, so a test
// advances the loop exactly N frames via `pumpFrames(n)` — deterministic, and
// compatible with the fake timers the announcer debounce needs (a setTimeout-
// driven rAF would fight `vi.advanceTimersByTime`).
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

beforeEach(() => {
  installRaf();
  FakeAudioContext.lastInstance = null;
});

// ── Fake analyser with a configurable fill (default: silence) ─────────────────
class FakeAnalyser {
  fftSize = 0;
  fillBuffer: (buf: Float32Array) => void = (buf) => buf.fill(0);
  connect = vi.fn();
  getFloatTimeDomainData(buf: Float32Array): void {
    this.fillBuffer(buf);
  }
}

class FakeAudioContext {
  static lastInstance: FakeAudioContext | null = null;
  state: 'running' | 'suspended' | 'closed' = 'running';
  sampleRate = 48000;
  analyser = new FakeAnalyser();
  constructor() {
    FakeAudioContext.lastInstance = this;
  }
  createAnalyser() {
    return this.analyser as unknown as AnalyserNode;
  }
  createMediaStreamSource() {
    return { connect: () => undefined } as unknown as MediaStreamAudioSourceNode;
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

// ── Sine fill (copied/adapted from useTuner.test.tsx) ─────────────────────────
/** A real sine at `hz`, sampled at the fake context's 48k — feeds the genuine detector. */
const sineFill =
  (hz: number) =>
  (buf: Float32Array): void => {
    const w = (2 * Math.PI * hz) / 48000;
    for (let i = 0; i < buf.length; i++) buf[i] = 0.8 * Math.sin(w * i);
  };

/** Frequency `cents` away from A4 (440 Hz) — same A4 note territory, off by `cents`. */
const offA4 = (cents: number): number => 440 * Math.pow(2, cents / 1200);

function fakeStream(): MediaStream {
  return {
    getTracks: () => [{ stop: () => undefined }],
    getAudioTracks: () => [{ stop: () => undefined, getSettings: () => ({}) }],
  } as unknown as MediaStream;
}

function installSupported(getUserMedia: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  vi.stubGlobal('AudioContext', FakeAudioContext);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
});

/**
 * Render TunerView, grant the mic, and reach the listening state. Returns the
 * live analyser so a test can point it at a sine and `pumpFrames` a readout in.
 */
async function startListening(): Promise<FakeAnalyser> {
  const getUserMedia = vi.fn(() => Promise.resolve(fakeStream()));
  installSupported(getUserMedia);
  render(<TunerView />);
  await act(async () => {
    screen.getByRole('button', { name: 'Start tuning' }).click();
    await Promise.resolve();
  });
  await waitFor(() => {
    expect(screen.getByRole('group', { name: 'Open strings' })).toBeInTheDocument();
  });
  return FakeAudioContext.lastInstance!.analyser;
}

/** Point the analyser at `hz` and pump frames until a non-null readout settles. */
async function driveReadout(analyser: FakeAnalyser, hz: number): Promise<void> {
  analyser.fillBuffer = sineFill(hz);
  await act(async () => {
    pumpFrames(10);
    await Promise.resolve();
  });
  // The readout text lives in the aria-hidden .tuner-readout block; wait for it.
  await waitFor(() => {
    expect(document.querySelector('.tuner-readout')).not.toBeNull();
    expect(document.querySelector('.tuner-readout-empty')).toBeNull();
  });
}

describe('idle / start state (§17.6)', () => {
  it('renders the kicker, H1, the rationale, the {mint}-outline Start pill, and the privacy line', () => {
    render(<TunerView />);
    expect(screen.getByText('Tuner')).toBeInTheDocument(); // kicker
    expect(screen.getByRole('heading', { level: 1, name: 'Chromatic tuner' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tune your violin' })).toBeInTheDocument();
    // The Start affordance (the §17.6 {mint}-outline pill — a button, not a fill).
    expect(screen.getByRole('button', { name: 'Start tuning' })).toBeInTheDocument();
    // The on-device privacy line (§17.6) — the same posture README/SECURITY carry.
    expect(
      screen.getByText(/processed entirely in your browser.*nothing is recorded/i),
    ).toBeInTheDocument();
  });
});

describe('announcer exists EMPTY at load (§17.9 / §11.3)', () => {
  it('renders a visually-hidden polite role="status" region that is empty at load', () => {
    const { container } = render(<TunerView />);
    const announcer = container.querySelector('[data-live="tuner"]');
    expect(announcer).not.toBeNull();
    // Polite, atomic, status — the §11.3/§17.9 contract.
    expect(announcer?.getAttribute('role')).toBe('status');
    expect(announcer?.getAttribute('aria-live')).toBe('polite');
    expect(announcer?.getAttribute('aria-atomic')).toBe('true');
    // EMPTY at load — present before its first write, so the first announcement is
    // heard (NOT injected-then-written).
    expect(announcer?.textContent).toBe('');
    expect(announcer?.classList.contains('sr-only')).toBe(true);
  });
});

describe('unsupported state (§17.6)', () => {
  it('shows a graceful message and NO dead Start control once Start resolves unsupported', async () => {
    // No mediaDevices → isCaptureSupported() returns false → status 'unsupported'.
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    vi.stubGlobal('AudioContext', FakeAudioContext);
    render(<TunerView />);
    await act(async () => {
      screen.getByRole('button', { name: 'Start tuning' }).click();
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: /tuner unavailable/i })).toBeInTheDocument();
    // No dead Start / retry control in the unsupported state (§17.6).
    expect(screen.queryByRole('button', { name: /start tuning/i })).not.toBeInTheDocument();
  });
});

describe('denied state (§17.6)', () => {
  it('shows settings-recovery guidance — NOT a no-op mic retry — when the mic is blocked', async () => {
    const getUserMedia = vi.fn(() =>
      Promise.reject(new DOMException('blocked', 'NotAllowedError')),
    );
    installSupported(getUserMedia);
    render(<TunerView />);
    await act(async () => {
      screen.getByRole('button', { name: 'Start tuning' }).click();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Microphone blocked' })).toBeInTheDocument();
    });
    // Settings-recovery copy (§17.6), not a "retry mic" no-op.
    expect(screen.getByText(/re-enabled in your browser or system settings/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });
});

describe('listening state — readout / chips / colour-redundancy cues (§17.3 / §17.7 / §11.1)', () => {
  it('renders the live surface with the open-string chips once listening', async () => {
    const getUserMedia = vi.fn(() => Promise.resolve(fakeStream()));
    installSupported(getUserMedia);
    render(<TunerView />);
    await act(async () => {
      screen.getByRole('button', { name: 'Start tuning' }).click();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Open strings' })).toBeInTheDocument();
    });
    // The four open-string chips (§17.4), in order, Geist-Mono note names.
    const chips = within(screen.getByRole('group', { name: 'Open strings' }));
    for (const name of ['G3', 'D4', 'A4', 'E5']) {
      expect(chips.getByText(name)).toBeInTheDocument();
    }
    // The A4 calibration control (§17.5) is present and keyboard-operable.
    expect(screen.getByRole('group', { name: 'A4 calibration reference' })).toBeInTheDocument();
    // The meter is present (decorative img for the live readout, §17.9).
    expect(screen.getByRole('img', { name: /tuning meter/i })).toBeInTheDocument();
  });
});

describe('no red anywhere (§17.7 / §2.6)', () => {
  it('the rendered view references no red token / red literal', () => {
    const { container } = render(<TunerView />);
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain('#e5644e');
    expect(html).not.toContain('danger');
  });
});

// The rendered Readout (§17.3): every existing test fills the analyser with zeros,
// so `readout` stays null and the Readout sub-component never renders its real
// branches. These drive a real sine so the note name, the signed cents glyph, and
// the §17.7/§11.1 colour-redundancy words (IN TUNE ✓ / sharp ♯ / flat ♭) render.
describe('listening state — rendered readout (§17.3 / §17.7 / §11.1)', () => {
  it('renders A4, 0¢, and the IN TUNE ✓ cue when the pitch is dead-on', async () => {
    const analyser = await startListening();
    await driveReadout(analyser, 440); // exactly A4

    const readout = document.querySelector('.tuner-readout');
    expect(readout).not.toBeNull();
    // Note name + octave, the signed-cents text, and the in-tune state.
    expect(readout?.textContent).toContain('A4');
    expect(readout?.textContent).toContain('0¢');
    expect(readout?.textContent).toContain('IN TUNE ✓');
    // The in-tune class is the {mint} resolution (§17.3); no direction word.
    expect(readout?.classList.contains('is-in-tune')).toBe(true);
    expect(readout?.textContent).not.toContain('♯');
    expect(readout?.textContent).not.toContain('♭');
  });

  it('shows the `sharp ♯` direction word when sharp', async () => {
    const analyser = await startListening();
    await driveReadout(analyser, offA4(15)); // ~+15¢, still A4

    const readout = document.querySelector('.tuner-readout');
    expect(readout?.textContent).toContain('A4');
    expect(readout?.textContent).toContain('sharp ♯');
    expect(readout?.classList.contains('is-in-tune')).toBe(false);
    // A sharp reading carries a leading `+`, never the minus glyph.
    const cents = document.querySelector('.tuner-cents')?.textContent ?? '';
    expect(cents).toContain('+');
    expect(cents).toContain('¢');
  });

  it('shows the `flat ♭` word and the U+2212 MINUS glyph (not ASCII -) when flat', async () => {
    const analyser = await startListening();
    await driveReadout(analyser, offA4(-15)); // ~−15¢, still A4

    const readout = document.querySelector('.tuner-readout');
    expect(readout?.textContent).toContain('A4');
    expect(readout?.textContent).toContain('flat ♭');

    const cents = document.querySelector('.tuner-cents')?.textContent ?? '';
    // The flat sign is U+2212 MINUS, never an ASCII hyphen-minus (§17.3).
    expect(cents).toContain('−');
    expect(cents).not.toContain('-'); // ASCII 0x2D must not appear in the cents slot
    expect(cents).toContain('¢');
  });
});

// The signed-cents formatting contract (§17.3) exercised through the rendered
// Readout (`formatSignedCents` is a TunerView-private helper, kept private rather
// than exported to preserve the file's single-component fast-refresh boundary).
// Each case drives the readout to a known cents value and asserts the exact rendered
// string — covering the zero / positive-`+` / negative-`−` (U+2212) branches.
describe('signed cents formatting in the rendered readout (§17.3)', () => {
  it('renders a bare `0¢` (no sign) when dead-on', async () => {
    const analyser = await startListening();
    await driveReadout(analyser, 440);
    expect(document.querySelector('.tuner-cents')?.textContent).toBe('0¢');
  });

  it('renders a leading `+` with the ¢ glyph when sharp', async () => {
    const analyser = await startListening();
    await driveReadout(analyser, offA4(15));
    const cents = document.querySelector('.tuner-cents')?.textContent ?? '';
    expect(cents).toMatch(/^\+\d+¢$/); // e.g. +15¢
  });

  it('renders the U+2212 MINUS glyph (not ASCII -) with the ¢ glyph when flat', async () => {
    const analyser = await startListening();
    await driveReadout(analyser, offA4(-15));
    const cents = document.querySelector('.tuner-cents')?.textContent ?? '';
    expect(cents).toMatch(/^−\d+¢$/); // U+2212 lead, e.g. −15¢
    expect(cents.startsWith('−')).toBe(true);
    expect(cents).not.toContain('-'); // never ASCII hyphen-minus
  });
});

// The §17.9 TunerAnnouncer: the live-region announcement IS the tuner for a blind
// user, yet every existing test takes only its early-return arm (readout null), so
// the debounce timer, the dedupe, the first-in-tune suffix, and the clear-on-stop
// path are all dark. These drive them with fake timers.
describe('listening state — announcer (§17.9 / §11.3)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Reach listening (real timers, so RTL's `waitFor` resolves), then switch to fake
   * timers so the ~1.8s debounce is advanced deterministically. The rAF pump and
   * microtask flush in `feed` don't need real timers, so this is safe.
   */
  async function startListeningWithFakeTimers(): Promise<FakeAnalyser> {
    const analyser = await startListening();
    // Fake ONLY the debounce timer (setTimeout/clearTimeout). `performance.now()`
    // stays real so the useTuner readout pipeline (whose bounded-hold compares
    // frame timestamps, #103) keeps advancing across pumped frames — a fully-faked
    // clock freezes `performance.now()` and the smoothed readout never re-publishes.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    return analyser;
  }

  /** Point the analyser at `hz`, pump frames, and flush the React microtasks. */
  async function feed(analyser: FakeAnalyser, hz: number, frames = 10): Promise<void> {
    analyser.fillBuffer = sineFill(hz);
    await act(async () => {
      pumpFrames(frames);
      await Promise.resolve();
    });
  }

  const live = (): string => document.querySelector('[data-live="tuner"]')?.textContent ?? '';

  it('announces the spoken note after the debounce, not on the first frame', async () => {
    const analyser = await startListeningWithFakeTimers();
    await feed(analyser, 440);

    // The region is still empty immediately — the announcement is debounced ~1.8s.
    expect(live()).toBe('');

    act(() => {
      vi.advanceTimersByTime(1800);
    });
    // After the debounce: the spoken note + octave, with the `, in tune` suffix.
    expect(live()).toContain('A 4');
    expect(live()).toContain(', in tune');
  });

  it('does not re-announce the same note/octave when only the cents jitter', async () => {
    const analyser = await startListeningWithFakeTimers();
    await feed(analyser, offA4(15)); // A4, ~+15¢ sharp (not in tune)
    act(() => {
      vi.advanceTimersByTime(1800);
    });
    const first = live();
    expect(first).toContain('A 4');

    // Same note + octave, different cents — must NOT re-announce (dedupe).
    await feed(analyser, offA4(25)); // still A4, sharper
    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(live()).toBe(first);
  });

  it('announces the `, in tune` suffix on the first in-tune transition for a held note', async () => {
    const analyser = await startListeningWithFakeTimers();
    // First settle sharp (not in tune) so the held note is already A4 but off.
    await feed(analyser, offA4(20));
    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(live()).not.toContain(', in tune');

    // Now bring it dead-on: the first in-tune for the held note announces the suffix
    // even though note/octave are unchanged (the firstInTune arm, not note-change).
    // The EMA glides, so pump enough frames for the readout to actually settle to
    // in-tune before the debounce timer captures it.
    await feed(analyser, 440, 30);
    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(live()).toContain('A 4');
    expect(live()).toContain(', in tune');
  });

  it('clears the live region when the session stops (back to empty)', async () => {
    const analyser = await startListeningWithFakeTimers();
    await feed(analyser, 440);
    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(live()).not.toBe('');

    // Stop: status leaves 'listening', so the region is forced empty (§17.9) and the
    // dedupe ref resets for the next session.
    await act(async () => {
      screen.getByRole('button', { name: 'Stop' }).click();
      await Promise.resolve();
    });
    expect(live()).toBe('');
  });
});
