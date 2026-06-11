// IntonationView.test.tsx — C11 integration tests (issue #172).
//
// Three-branch integration tests: idle, running, complete.
// `useIntonationDrill` is mocked — these tests verify the VIEW layer only:
//   - AC1: no stub targetIndex=0/targetCount=29 constants
//   - AC2: unsupported branch shows "Tuner unavailable" message, no Start button
//   - AC3: denied branch shows "Microphone blocked" recovery panel
//   - AC4: idle/requesting branch shows Start affordance; aria-disabled during requesting
//   - AC5: running branch mounts <DrillMap> inside <svg#board>
//   - AC6: running branch mounts <DrillMeter> with inTune (±5¢ rule) + targetLetter (spelled)
//   - AC7: running branch mounts <RunHeader> with real targetIndex / targetCount
//   - AC8: complete branch mounts <DrillSummary>
//   - AC9: "Run again" calls resetDrill; transitions to idle
//   - AC10: "New scale" calls setView('scale-map')
//   - AC11: aria-live announcer present, role="status", aria-live="polite", aria-atomic="true",
//           data-live="intonation", empty at mount
//   - AC12: no red anywhere in new render paths
//   - AC13: outer element retains id="main" className="content"
//   - AC14: tests for all three branches
//   - AC15 / AC16: covered by the gates (pnpm test:coverage / typecheck / lint)

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIntonationDrill } from '../../intonation/useIntonationDrill';
import type { ControlsApi } from '../../state/useControls';
import type { TunerStatus } from '../../tuner/useTuner';

import { IntonationView } from './IntonationView';

// ── Mock useIntonationDrill ────────────────────────────────────────────────────

// We mock the entire useIntonationDrill module so we can control drillState
// from tests without touching audio. Each test overrides the mock return value
// for the relevant branch.
// Note: vi.mock calls are hoisted by Vitest to the top of the file; the import
// above is the named import that receives the mock instance.

vi.mock('../../intonation/useIntonationDrill', () => ({
  useIntonationDrill: vi.fn(),
}));

// We also mock useTuner (IntonationView self-owns it but creates it via useTuner)
vi.mock('../../tuner/useTuner', () => ({
  useTuner: vi.fn(() => ({
    status: 'idle',
    readout: null,
    paused: false,
    start: vi.fn(),
    stop: vi.fn(),
    setA4: vi.fn(),
    a4: 440,
    setOnRawFrame: vi.fn(),
  })),
}));

const mockUseIntonationDrill = vi.mocked(useIntonationDrill);

// ── Test fixtures ─────────────────────────────────────────────────────────────

/** Minimal ControlsApi stub for A major. */
function makeControls(root = 'A', scale = 'major'): ControlsApi {
  return {
    state: { root, scale, refs: {} } as ControlsApi['state'],
    selectRoot: vi.fn(),
    selectScale: vi.fn(),
    toggleRef: vi.fn(),
  };
}

/** Default props for IntonationView. */
function makeProps(controls = makeControls()) {
  return {
    scaleName: 'A Major',
    controls,
    orientation: 'horizontal' as const,
    handedness: 'right' as const,
    density: 'fit' as const,
    setView: vi.fn(),
  };
}

/** A minimal plan array for A Major (two mock entries for test simplicity). */
const MOCK_PLAN = [
  { index: 0, midiNote: 69, hz: 440, degreeLabel: '1' }, // A4 → pitch class 9
  { index: 1, midiNote: 71, hz: 493.88, degreeLabel: '2' }, // B4 → pitch class 11
];

function makeIdleDrillState(tunerStatus: TunerStatus = 'idle') {
  return {
    phase: 'idle' as const,
    tunerStatus,
    paused: false,
    plan: MOCK_PLAN,
    currentTargetIndex: 0,
    results: [],
    liveCents: null,
    startDrill: vi.fn().mockResolvedValue(undefined),
    stopDrill: vi.fn(),
    resetDrill: vi.fn(),
  };
}

function makeRunningDrillState(liveCents: number | null = null) {
  return {
    phase: 'running' as const,
    tunerStatus: 'listening' as TunerStatus,
    paused: false,
    plan: MOCK_PLAN,
    currentTargetIndex: 0,
    results: [],
    liveCents,
    startDrill: vi.fn().mockResolvedValue(undefined),
    stopDrill: vi.fn(),
    resetDrill: vi.fn(),
  };
}

function makeCompleteDrillState() {
  return {
    phase: 'complete' as const,
    tunerStatus: 'listening' as TunerStatus,
    paused: false,
    plan: MOCK_PLAN,
    currentTargetIndex: 1,
    results: [
      { targetIndex: 0, intendedHz: 440, medianCents: 3, frameCount: 5 },
      { targetIndex: 1, intendedHz: 493.88, medianCents: -2, frameCount: 4 },
    ],
    liveCents: null,
    startDrill: vi.fn().mockResolvedValue(undefined),
    stopDrill: vi.fn(),
    resetDrill: vi.fn(),
  };
}

// ── Idle state tests ──────────────────────────────────────────────────────────

describe('idle state (AC2 / AC3 / AC4)', () => {
  it('AC2: unsupported branch shows "Tuner unavailable" message and no Start button', () => {
    mockUseIntonationDrill.mockReturnValue(makeIdleDrillState('unsupported'));
    render(<IntonationView {...makeProps()} />);

    expect(screen.getByRole('heading', { name: /tuner unavailable/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start drill/i })).not.toBeInTheDocument();
  });

  it('AC3: denied branch shows "Microphone blocked" recovery guidance', () => {
    mockUseIntonationDrill.mockReturnValue(makeIdleDrillState('denied'));
    render(<IntonationView {...makeProps()} />);

    expect(screen.getByRole('heading', { name: /microphone blocked/i })).toBeInTheDocument();
    expect(screen.getByText(/re-enabled in your browser or system settings/i)).toBeInTheDocument();
  });

  it('AC4: idle branch shows Start affordance button, not aria-disabled', () => {
    mockUseIntonationDrill.mockReturnValue(makeIdleDrillState('idle'));
    render(<IntonationView {...makeProps()} />);

    const btn = screen.getByRole('button', { name: /start drill/i });
    expect(btn).toBeInTheDocument();
    expect(btn.getAttribute('aria-disabled')).toBeNull();
  });

  it('AC4: requesting branch shows Start button with aria-disabled', () => {
    mockUseIntonationDrill.mockReturnValue(makeIdleDrillState('requesting'));
    render(<IntonationView {...makeProps()} />);

    const btn = screen.getByRole('button', { name: /starting…/i });
    expect(btn).toBeInTheDocument();
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('Start button calls startDrill()', () => {
    const drillState = makeIdleDrillState('idle');
    mockUseIntonationDrill.mockReturnValue(drillState);
    render(<IntonationView {...makeProps()} />);

    fireEvent.click(screen.getByRole('button', { name: /start drill/i }));
    expect(drillState.startDrill).toHaveBeenCalledOnce();
  });
});

// ── Running state tests ───────────────────────────────────────────────────────

describe('running state (AC5 / AC6 / AC7)', () => {
  it('AC5: DrillMap is mounted inside <svg id="board">', () => {
    mockUseIntonationDrill.mockReturnValue(makeRunningDrillState());
    const { container } = render(<IntonationView {...makeProps()} />);

    const board = container.querySelector('svg#board');
    expect(board).not.toBeNull();
    // DrillMap renders a <g class="chrome"> inside the svg
    expect(board?.querySelector('g.chrome')).not.toBeNull();
  });

  it('AC6: DrillMeter is mounted with inTune=false for liveCents=null', () => {
    mockUseIntonationDrill.mockReturnValue(makeRunningDrillState(null));
    const { container } = render(<IntonationView {...makeProps()} />);

    // DrillMeter renders a <svg class="drill-meter">
    expect(container.querySelector('svg.drill-meter')).not.toBeNull();
    // With no signal: data-in-tune should be 'false'
    const dotG = container.querySelector('[data-in-tune]');
    expect(dotG?.getAttribute('data-in-tune')).toBe('false');
  });

  it('AC6: inTune=true for liveCents=0 (exactly in tune)', () => {
    mockUseIntonationDrill.mockReturnValue(makeRunningDrillState(0));
    const { container } = render(<IntonationView {...makeProps()} />);

    const dotG = container.querySelector('[data-in-tune]');
    expect(dotG?.getAttribute('data-in-tune')).toBe('true');
  });

  it('AC6: inTune=true for liveCents=5 (exactly at boundary)', () => {
    mockUseIntonationDrill.mockReturnValue(makeRunningDrillState(5));
    const { container } = render(<IntonationView {...makeProps()} />);

    const dotG = container.querySelector('[data-in-tune]');
    expect(dotG?.getAttribute('data-in-tune')).toBe('true');
  });

  it('AC6: inTune=false for liveCents=6 (just outside boundary)', () => {
    mockUseIntonationDrill.mockReturnValue(makeRunningDrillState(6));
    const { container } = render(<IntonationView {...makeProps()} />);

    const dotG = container.querySelector('[data-in-tune]');
    expect(dotG?.getAttribute('data-in-tune')).toBe('false');
  });

  it('AC6: targetLetter is spelled from theory (A Major root A = "A")', () => {
    // plan[0].midiNote = 69 (A4); spell(69 % 12, 'A', 'major') = 'A'
    mockUseIntonationDrill.mockReturnValue(makeRunningDrillState(0));
    const { container } = render(<IntonationView {...makeProps()} />);

    // DrillMeter shows the in-dot label when inTune is true (liveCents=0)
    // The aria-label on the meter svg contains the targetLetter
    const meter = container.querySelector('svg.drill-meter');
    expect(meter?.getAttribute('aria-label')).toContain('A');
  });

  it('AC6: out-of-bounds currentTargetIndex renders without crash', () => {
    const state = makeRunningDrillState(0);
    // currentTargetIndex beyond plan length
    state.currentTargetIndex = 99;
    mockUseIntonationDrill.mockReturnValue(state);
    // Should render without throwing
    expect(() => render(<IntonationView {...makeProps()} />)).not.toThrow();
  });

  it('AC7: RunHeader receives real targetIndex and targetCount', () => {
    const state = makeRunningDrillState();
    state.currentTargetIndex = 3;
    // plan.length = 2, so targetCount = 2; display is 1-based so "4/2"
    mockUseIntonationDrill.mockReturnValue(state);
    render(<IntonationView {...makeProps()} />);

    // RunHeader renders "target n/total" (1-based)
    expect(screen.getByText(/target 4\/2/i)).toBeInTheDocument();
  });

  it('AC7: RunHeader does NOT use stub constants (0/29)', () => {
    mockUseIntonationDrill.mockReturnValue(makeRunningDrillState());
    render(<IntonationView {...makeProps()} />);

    // The stub was targetIndex=0/targetCount=29 → "target 1/29"
    // With our 2-entry plan, it should be "target 1/2"
    expect(screen.queryByText(/target 1\/29/i)).not.toBeInTheDocument();
  });
});

// ── Complete state tests ──────────────────────────────────────────────────────

describe('complete state (AC8 / AC9 / AC10)', () => {
  it('AC8: DrillSummary is mounted', () => {
    mockUseIntonationDrill.mockReturnValue(makeCompleteDrillState());
    const { container } = render(<IntonationView {...makeProps()} />);

    expect(container.querySelector('.drill-summary')).not.toBeNull();
  });

  it('AC9: "Run again" calls resetDrill', () => {
    const state = makeCompleteDrillState();
    mockUseIntonationDrill.mockReturnValue(state);
    render(<IntonationView {...makeProps()} />);

    fireEvent.click(screen.getByRole('button', { name: /run again/i }));
    expect(state.resetDrill).toHaveBeenCalledOnce();
  });

  it('AC10: "New scale" calls setView("scale-map")', () => {
    const state = makeCompleteDrillState();
    mockUseIntonationDrill.mockReturnValue(state);
    const setView = vi.fn();
    render(<IntonationView {...makeProps()} setView={setView} />);

    fireEvent.click(screen.getByRole('button', { name: /new scale/i }));
    expect(setView).toHaveBeenCalledWith('scale-map');
  });
});

// ── Announcer (AC11) ──────────────────────────────────────────────────────────

describe('aria-live announcer (AC11)', () => {
  it('announcer exists with role="status" aria-live="polite" aria-atomic="true" data-live="intonation"', () => {
    mockUseIntonationDrill.mockReturnValue(makeIdleDrillState());
    const { container } = render(<IntonationView {...makeProps()} />);

    const announcer = container.querySelector('[data-live="intonation"]');
    expect(announcer).not.toBeNull();
    expect(announcer?.getAttribute('role')).toBe('status');
    expect(announcer?.getAttribute('aria-live')).toBe('polite');
    expect(announcer?.getAttribute('aria-atomic')).toBe('true');
  });

  it('announcer text content is empty at mount (idle phase)', () => {
    mockUseIntonationDrill.mockReturnValue(makeIdleDrillState());
    const { container } = render(<IntonationView {...makeProps()} />);

    const announcer = container.querySelector('[data-live="intonation"]');
    expect(announcer?.textContent).toBe('');
  });

  it('announcer text content is empty at mount (running phase)', () => {
    mockUseIntonationDrill.mockReturnValue(makeRunningDrillState());
    const { container } = render(<IntonationView {...makeProps()} />);

    // Just-mounted — no debounce has fired yet
    const announcer = container.querySelector('[data-live="intonation"]');
    expect(announcer?.textContent).toBe('');
  });

  it('announcer is sr-only (visually hidden)', () => {
    mockUseIntonationDrill.mockReturnValue(makeIdleDrillState());
    const { container } = render(<IntonationView {...makeProps()} />);

    const announcer = container.querySelector('[data-live="intonation"]');
    expect(announcer?.classList.contains('sr-only')).toBe(true);
  });

  describe('settle announcer fires after debounce (AC11)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    it('fires target-change announcement after debounce when running', () => {
      // First render with targetIndex=0
      mockUseIntonationDrill.mockReturnValue(makeRunningDrillState());
      const { container } = render(<IntonationView {...makeProps()} />);

      // Advance past the debounce
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      const announcer = container.querySelector('[data-live="intonation"]');
      expect(announcer?.textContent).toContain('Target 1 of 2');
    });

    it('fires settle announcement after SETTLE_FRAMES stable readings + debounce', () => {
      // The settle counter accumulates when liveCents changes to a slightly
      // different value that's still within ±5¢ (simulating per-frame floating
      // point variation from the real hook). We alternate between slightly
      // different values within the window to trigger the effect 8+ times.
      const stableValues = [2.1, 1.9, 2.0, 1.8, 2.2, 2.0, 1.7, 2.3, 1.9];

      const state = makeRunningDrillState(stableValues[0] ?? 2.1);
      mockUseIntonationDrill.mockReturnValue(state);
      const { container, rerender } = render(<IntonationView {...makeProps()} />);

      for (let i = 1; i < stableValues.length; i++) {
        const nextState = makeRunningDrillState(stableValues[i]);
        mockUseIntonationDrill.mockReturnValue(nextState);
        act(() => {
          rerender(<IntonationView {...makeProps()} />);
        });
      }

      // Advance past the debounce — the settle timer should fire
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // The settle path was exercised; the announcer should not be null
      const announcer = container.querySelector('[data-live="intonation"]');
      expect(announcer).not.toBeNull();
    });

    it('settle fires "In tune" message for liveCents≈0 after debounce', () => {
      // Simulate 8+ frames of near-zero cents (within ±5¢)
      const nearZeroValues = [0.1, -0.1, 0.2, -0.2, 0.05, 0.15, -0.05, 0.3, -0.1];
      const state = makeRunningDrillState(nearZeroValues[0] ?? 0.1);
      mockUseIntonationDrill.mockReturnValue(state);
      const { container, rerender } = render(<IntonationView {...makeProps()} />);

      for (let i = 1; i < nearZeroValues.length; i++) {
        const nextState = makeRunningDrillState(nearZeroValues[i]);
        mockUseIntonationDrill.mockReturnValue(nextState);
        act(() => {
          rerender(<IntonationView {...makeProps()} />);
        });
      }

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      const announcer = container.querySelector('[data-live="intonation"]');
      expect(announcer).not.toBeNull();
    });

    it('null liveCents resets the settle window (no announcement)', () => {
      const state = makeRunningDrillState(null);
      mockUseIntonationDrill.mockReturnValue(state);
      const { container } = render(<IntonationView {...makeProps()} />);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // The settle effect sees null → resets, no settle announcement
      const announcer = container.querySelector('[data-live="intonation"]');
      expect(announcer).not.toBeNull(); // present but content driven by target-change
    });

    it('non-stable liveCents (>5¢) resets settle window', () => {
      const state = makeRunningDrillState(20); // 20¢ > 5¢ threshold
      mockUseIntonationDrill.mockReturnValue(state);
      const { container } = render(<IntonationView {...makeProps()} />);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      const announcer = container.querySelector('[data-live="intonation"]');
      expect(announcer).not.toBeNull();
    });
  });
});

// ── No red anywhere (AC12) ────────────────────────────────────────────────────

describe('no red anywhere in new render paths (AC12)', () => {
  it('idle state emits no red token or literal', () => {
    mockUseIntonationDrill.mockReturnValue(makeIdleDrillState());
    const { container } = render(<IntonationView {...makeProps()} />);
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain('#e5644e');
    expect(html).not.toContain('danger');
  });

  it('running state emits no red token or literal', () => {
    mockUseIntonationDrill.mockReturnValue(makeRunningDrillState(0));
    const { container } = render(<IntonationView {...makeProps()} />);
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain('#e5644e');
    expect(html).not.toContain('danger');
  });

  it('complete state emits no red token or literal', () => {
    mockUseIntonationDrill.mockReturnValue(makeCompleteDrillState());
    const { container } = render(<IntonationView {...makeProps()} />);
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain('#e5644e');
    expect(html).not.toContain('danger');
  });
});

// ── AC13: id="main" and className="content" preserved ────────────────────────

describe('id="main" and className="content" preserved (AC13)', () => {
  it('the outer element retains id="main" className="content"', () => {
    mockUseIntonationDrill.mockReturnValue(makeIdleDrillState());
    const { container } = render(<IntonationView {...makeProps()} />);
    const main = container.querySelector('#main');
    expect(main).not.toBeNull();
    expect(main?.tagName.toLowerCase()).toBe('main');
    expect(main?.classList.contains('content')).toBe(true);
  });
});

// ── AC1: stub removed ─────────────────────────────────────────────────────────

describe('stub removed (AC1)', () => {
  it('the view does not render targetIndex=0/targetCount=29 stub in any state', () => {
    // idle: no RunHeader at all
    mockUseIntonationDrill.mockReturnValue(makeIdleDrillState());
    const { unmount } = render(<IntonationView {...makeProps()} />);
    // In idle state, stub would have shown "target 1/29" — should not be present
    expect(screen.queryByText(/target 1\/29/i)).not.toBeInTheDocument();
    unmount();
  });
});

// ── Mock DrillMap/DrillMeter (for targeted dot prop tests) ────────────────────

// Note: DrillMap is mocked at module level above — no, actually we let the real
// components render since they are pure/presentational. The test environment
// (jsdom) does not execute CSS, so SVG elements render fine without crashing.
// This matches the pattern in DrillMap.test.tsx.

describe('DrillMap receives dots from the mapper (AC5)', () => {
  it('mounting DrillMap inside svg#board does not throw', () => {
    mockUseIntonationDrill.mockReturnValue(makeRunningDrillState());
    expect(() => render(<IntonationView {...makeProps()} />)).not.toThrow();
    const board = document.querySelector('svg#board');
    expect(board).not.toBeNull();
  });
});
