import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RunHeader } from './RunHeader.tsx';

// RunHeader unit tests — the dumb presentational run-header for the Intonation
// view (C9). No React/DOM state is involved; these tests pin the §13 copy contract:
//   "<scaleName> · 2 octaves · target <n>/<total>"
// The 1-based index conversion (0 → "target 1/29") is also verified.

describe('RunHeader — copy contract (§13)', () => {
  it('renders the scale name', () => {
    render(<RunHeader scaleName="B♭ Major" targetIndex={0} targetCount={29} />);
    expect(screen.getByText('B♭ Major')).toBeInTheDocument();
  });

  it('always renders "2 octaves" (fixed for v1)', () => {
    render(<RunHeader scaleName="A Major" targetIndex={0} targetCount={29} />);
    expect(screen.getByText('2 octaves')).toBeInTheDocument();
  });

  it('renders "target 1/29" for targetIndex=0, targetCount=29 (1-based display)', () => {
    render(<RunHeader scaleName="A Major" targetIndex={0} targetCount={29} />);
    expect(screen.getByText('target 1/29')).toBeInTheDocument();
  });

  it('advances the displayed index by 1 (1-based) for any targetIndex', () => {
    render(<RunHeader scaleName="G Major" targetIndex={5} targetCount={29} />);
    expect(screen.getByText('target 6/29')).toBeInTheDocument();
  });

  it('reflects totalCount in the progress text', () => {
    render(<RunHeader scaleName="D Natural Minor" targetIndex={2} targetCount={15} />);
    expect(screen.getByText('target 3/15')).toBeInTheDocument();
  });

  // #177 defense-in-depth: the displayed ordinal is clamped to targetCount so a
  // terminal index (targetIndex === targetCount) can never overflow the total.
  it('clamps a terminal targetIndex (=== targetCount) to "target 29/29", not 30/29', () => {
    render(<RunHeader scaleName="A Major" targetIndex={29} targetCount={29} />);
    expect(screen.getByText('target 29/29')).toBeInTheDocument();
    expect(screen.queryByText('target 30/29')).not.toBeInTheDocument();
  });

  it('clamps an above-terminal targetIndex to targetCount', () => {
    render(<RunHeader scaleName="A Major" targetIndex={99} targetCount={29} />);
    expect(screen.getByText('target 29/29')).toBeInTheDocument();
  });

  it('updates when props change', () => {
    const { rerender } = render(
      <RunHeader scaleName="A Major" targetIndex={0} targetCount={29} />,
    );
    expect(screen.getByText('target 1/29')).toBeInTheDocument();

    rerender(<RunHeader scaleName="A Major" targetIndex={3} targetCount={29} />);
    expect(screen.getByText('target 4/29')).toBeInTheDocument();
  });
});
