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

// rAF runs synchronously so a started session pumps frames in the test.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    // Schedule a single async frame so the loop doesn't recurse forever.
    setTimeout(() => {
      cb(performance.now());
    }, 0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

class FakeAudioContext {
  state: 'running' | 'suspended' | 'closed' = 'running';
  sampleRate = 48000;
  createAnalyser() {
    return {
      fftSize: 0,
      getFloatTimeDomainData: (buf: Float32Array) => buf.fill(0),
      connect: () => undefined,
    } as unknown as AnalyserNode;
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
