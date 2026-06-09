import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { A4Calibration } from './A4Calibration.tsx';

// A4Calibration unit tests (DESIGN.md §17.5). DESIGN.md §17 wins on any conflict
// (AGENTS.md). The control is the §17.5 reference-pitch stepper: `A = 440 Hz`,
// 415–446, default 440, −/+ steppers that are keyboard-operable (real <button>s)
// and clamp at the range ends.

/** A tiny controlled harness so the steppers' onChange is observable. */
function Harness({ initial = 440 }: { initial?: number }) {
  const [a4, setA4] = useState(initial);
  return <A4Calibration a4={a4} onChange={setA4} />;
}

describe('A4 calibration steppers (§17.5)', () => {
  it('renders the default 440 value and labelled −/+ steppers', () => {
    render(<Harness />);
    expect(screen.getByText(/A = 440/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lower the a4 reference/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /raise the a4 reference/i })).toBeInTheDocument();
  });

  it('+ raises and − lowers the reference by 1 Hz', () => {
    render(<Harness initial={440} />);
    fireEvent.click(screen.getByRole('button', { name: /raise the a4 reference/i }));
    expect(screen.getByText(/A = 441/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /lower the a4 reference/i }));
    fireEvent.click(screen.getByRole('button', { name: /lower the a4 reference/i }));
    expect(screen.getByText(/A = 439/)).toBeInTheDocument();
  });

  it('clamps at the 415 floor — − is disabled and the value cannot go below 415', () => {
    render(<Harness initial={415} />);
    const down = screen.getByRole('button', { name: /lower the a4 reference/i });
    expect(down).toBeDisabled();
    expect(screen.getByText(/A = 415/)).toBeInTheDocument();
  });

  it('clamps at the 446 ceiling — + is disabled and the value cannot go above 446', () => {
    render(<Harness initial={446} />);
    const up = screen.getByRole('button', { name: /raise the a4 reference/i });
    expect(up).toBeDisabled();
    expect(screen.getByText(/A = 446/)).toBeInTheDocument();
  });
});
