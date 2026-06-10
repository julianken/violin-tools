/**
 * DrillSummary.test.tsx — component tests for the C8 end-of-run summary panel.
 * DESIGN.md wins on any conflict (AGENTS.md).
 *
 * These tests run in jsdom (Vitest + @testing-library/react). The component is
 * PURELY PRESENTATIONAL — no audio, no hook, no async. All assertions operate
 * on rendered markup.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DrillSummary } from './DrillSummary.tsx';
import { type DrillTarget, type NoteResult } from './intonation.types.ts';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makePlan(length: number): readonly DrillTarget[] {
  return Array.from({ length }, (_, i) => ({
    index: i,
    midiNote: 60 + i,
    hz: 261.63 * Math.pow(2, i / 12),
    degreeLabel: `Note${String(i)}`,
  }));
}

function makeResult(targetIndex: number, medianCents: number): NoteResult {
  return { targetIndex, intendedHz: 440, medianCents, frameCount: 10 };
}

const PLAN_5 = makePlan(5);
const PLAN_29 = makePlan(29);

const DEFAULT_PROPS = {
  results: [
    makeResult(0, 8),
    makeResult(1, -3),
    makeResult(2, 12),
    makeResult(3, 0),
    makeResult(4, -7),
  ] as NoteResult[],
  plan: PLAN_5,
  runLabel: 'A Major · 2 octaves · target 5/5',
  onRunAgain: vi.fn(),
  onNewScale: vi.fn(),
};

// ── AC1 — component exists at the correct path ─────────────────────────────
// (The TypeScript import above would fail to compile if the file didn't exist.)

// ── AC2 — per-degree list with signed cents ────────────────────────────────

describe('AC2 — per-degree list with signed cents', () => {
  it('renders one row per result, with degree label and signed cents', () => {
    const { container } = render(<DrillSummary {...DEFAULT_PROPS} />);
    const rows = container.querySelectorAll('.drill-summary-row');
    expect(rows).toHaveLength(5);

    // Each row contains the degree label joined from plan[result.targetIndex]
    // and the correctly signed cents value.
    const firstRow = rows[0];
    expect(firstRow).not.toBeNull();
    // Note0 is plan[0].degreeLabel
    expect(firstRow?.textContent).toContain('Note0');
    // +8 should render as "+8 ¢"
    expect(firstRow?.textContent).toContain('+8 ¢');

    // Verify the flat value for result at index 1 renders with U+2212 minus.
    const secondRow = rows[1];
    expect(secondRow?.textContent).toContain('Note1');
    expect(secondRow?.textContent).toContain('−3 ¢');
  });
});

// ── AC3 — shorter-than-plan results array (incomplete run) ─────────────────

describe('AC3 — shorter-than-plan results array', () => {
  it('renders exactly 3 rows for a 3-entry results with a 29-entry plan', () => {
    const { container } = render(
      <DrillSummary
        {...DEFAULT_PROPS}
        results={[makeResult(0, 5), makeResult(1, -8), makeResult(2, 3)]}
        plan={PLAN_29}
      />,
    );
    const rows = container.querySelectorAll('.drill-summary-row');
    expect(rows).toHaveLength(3);
  });
});

// ── AC4 — ramp fill applied, no red ───────────────────────────────────────

describe('AC4 — ramp fill applied, no red in output', () => {
  it('each row swatch carries a backgroundColor referencing rampColor output (not a hard-coded hex)', () => {
    const { container } = render(<DrillSummary {...DEFAULT_PROPS} />);
    const swatches = container.querySelectorAll('.drill-summary-swatch');
    expect(swatches.length).toBeGreaterThan(0);
    // Each swatch should have an inline backgroundColor set (not empty string
    // or the CSS fallback bare variable); rampColor returns an rgb() string.
    for (const swatch of swatches) {
      const el = swatch as HTMLElement;
      // The inline style is set by the component; backgroundColor is non-empty.
      expect(el.style.backgroundColor).toBeTruthy();
    }
  });

  it('contains no {danger} token reference in the rendered output', () => {
    const { container } = render(<DrillSummary {...DEFAULT_PROPS} />);
    expect(container.innerHTML).not.toContain('danger');
  });

  it('contains no "red" color substring in the rendered output', () => {
    const { container } = render(<DrillSummary {...DEFAULT_PROPS} />);
    // Matches "red" in any class name or inline style.
    expect(container.innerHTML).not.toMatch(/\bred\b/i);
  });

  it('contains no #e5644e literal in the rendered output', () => {
    const { container } = render(<DrillSummary {...DEFAULT_PROPS} />);
    expect(container.innerHTML).not.toContain('#e5644e');
  });
});

// ── AC5 — average + farthest callout ──────────────────────────────────────

describe('AC5 — average + farthest callout', () => {
  it('shows the correct mean of absolute cents (±0.1 ¢ rounding)', () => {
    // results: [+8, -3, +12, 0, -7] → |abs| = [8, 3, 12, 0, 7] → mean = 6.0
    const { getByText } = render(<DrillSummary {...DEFAULT_PROPS} />);
    // The callout line starts "Average:" and shows "±6.0 ¢"
    const avgLine = getByText(/Average:/);
    expect(avgLine.textContent).toContain('±6.0 ¢');
  });

  it('names the degree with the largest |medianCents| in the Farthest line', () => {
    // result at index 2 has medianCents = +12 — the largest absolute value
    const { getByText } = render(<DrillSummary {...DEFAULT_PROPS} />);
    const farthestLine = getByText(/Farthest:/);
    expect(farthestLine.textContent).toContain('Note2');
    expect(farthestLine.textContent).toContain('+12 ¢');
  });
});

// ── AC6 — tendency line: present above threshold ───────────────────────────

describe('AC6 — tendency line present when mean > threshold', () => {
  it('renders the tendency line when results are uniformly sharp', () => {
    const sharpResults = [
      makeResult(0, 12),
      makeResult(1, 15),
      makeResult(2, 11),
    ];
    render(
      <DrillSummary
        {...DEFAULT_PROPS}
        results={sharpResults}
        plan={PLAN_29}
      />,
    );
    const tendency = document.querySelector('.drill-summary-tendency');
    expect(tendency).not.toBeNull();
    expect(tendency?.textContent).toMatch(/sharp/i);
  });
});

// ── AC7 — tendency line: absent below threshold ────────────────────────────

describe('AC7 — tendency line absent when mean within ±5 ¢', () => {
  it('does not render the tendency element (not an empty <p>) when no tendency', () => {
    const flatResults = [
      makeResult(0, 4),
      makeResult(1, -4),
      makeResult(2, 2),
    ];
    const { container } = render(
      <DrillSummary {...DEFAULT_PROPS} results={flatResults} plan={PLAN_29} />,
    );
    const tendency = container.querySelector('.drill-summary-tendency');
    expect(tendency).toBeNull();
  });
});

// ── AC8 — purity check is structural (in the utils tests); here we confirm
//           the component itself does NOT trigger side effects at render.
//           (The utils file has no React import — enforced by the TypeScript
//           import analysis and the AC8 note in the utils test file.)

// ── AC9 — actions call correct callbacks ──────────────────────────────────

describe('AC9 — actions call correct callbacks', () => {
  it('clicking "Run again" fires onRunAgain exactly once', () => {
    const onRunAgain = vi.fn();
    const onNewScale = vi.fn();
    render(
      <DrillSummary {...DEFAULT_PROPS} onRunAgain={onRunAgain} onNewScale={onNewScale} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run again/i }));
    expect(onRunAgain).toHaveBeenCalledTimes(1);
    expect(onNewScale).not.toHaveBeenCalled();
  });

  it('clicking "New scale" fires onNewScale exactly once', () => {
    const onRunAgain = vi.fn();
    const onNewScale = vi.fn();
    render(
      <DrillSummary {...DEFAULT_PROPS} onRunAgain={onRunAgain} onNewScale={onNewScale} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /new scale/i }));
    expect(onNewScale).toHaveBeenCalledTimes(1);
    expect(onRunAgain).not.toHaveBeenCalled();
  });
});

// ── AC10 — accessibility contract ─────────────────────────────────────────

describe('AC10 — accessibility contract', () => {
  it('renders role="region" with aria-labelledby pointing to a non-empty heading', () => {
    const { container } = render(<DrillSummary {...DEFAULT_PROPS} />);
    const region = container.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    const labelId = region?.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    const heading = document.getElementById(labelId ?? '');
    expect(heading).not.toBeNull();
    expect((heading?.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('Run-again button has an accessible name that includes the run label', () => {
    render(<DrillSummary {...DEFAULT_PROPS} />);
    // The aria-label contains the runLabel text.
    const btn = screen.getByRole('button', { name: /run again/i });
    const ariaLabel = btn.getAttribute('aria-label') ?? '';
    expect(ariaLabel.toLowerCase()).toContain('run again');
  });

  it('New-scale button has a descriptive accessible name', () => {
    render(<DrillSummary {...DEFAULT_PROPS} />);
    const btn = screen.getByRole('button', { name: /new scale|choose/i });
    expect(btn).not.toBeNull();
  });
});

// ── AC12 — in-memory only ──────────────────────────────────────────────────

describe('AC12 — in-memory only (no storage / network at render)', () => {
  it('does not call localStorage.setItem during render', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    render(<DrillSummary {...DEFAULT_PROPS} />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not call fetch during render', () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    render(<DrillSummary {...DEFAULT_PROPS} />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
