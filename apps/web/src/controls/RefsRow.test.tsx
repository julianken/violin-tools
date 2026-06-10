import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type RefsState } from '../state/controls.ts';

import { RefsRow } from './RefsRow.tsx';

// RefsRow §9.1 keyboard-guard tests (§9.1 / §11.3 / §8.1). The dim logic gives a
// `.pill.dim` `pointer-events:none` — but that blocks the MOUSE only. A keyboard
// user can still Tab to a dimmed pill and press Space/Enter, which fires a click
// event the CSS can't intercept. `RefsRow.tsx` L52 `if (unavailable) return;` is
// the ONLY keyboard defense for the "low 2 / 3-tape unavailable while Tapes off"
// invariant, and it is 0-hit on main. These pin it: a click on a dimmed pill must
// NOT call onToggle; once the pill is available the same click fires.

function renderRow(refs: RefsState) {
  const onToggle = vi.fn();
  render(<RefsRow refs={refs} onToggle={onToggle} />);
  return { onToggle };
}

describe('RefsRow §9.1 keyboard guard (the dim pill is inert)', () => {
  it('clicking the dimmed "low 2" while Tapes is off does NOT call onToggle', () => {
    // Tapes off ⇒ `isRefDimmed(refs, 'low2')` is true (`!refs.tapes`). The pill is
    // `.dim` and aria-disabled; a keyboard-driven activation reaches the onClick,
    // where the L52 guard returns before onToggle. (pointer-events:none stops the
    // mouse in the browser; the guard is what stops the KEYBOARD.)
    const { onToggle } = renderRow({
      tapes: false,
      low2: false,
      threeTape: false,
      landmarks: false,
    });
    const low2 = screen.getByRole('checkbox', { name: 'low 2' });
    expect(low2).toHaveClass('dim');
    expect(low2).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(low2); // the click Space/Enter dispatches past pointer-events:none
    expect(onToggle).not.toHaveBeenCalled(); // guard held — no toggle
  });

  it('enabling Tapes makes "low 2" available — the same click now fires onToggle', () => {
    // With Tapes on (and 3-tape off), `isRefDimmed(refs, 'low2')` is false: the pill
    // is no longer `.dim`, the L52 guard passes, and the click toggles `low2`.
    const { onToggle } = renderRow({
      tapes: true,
      low2: false,
      threeTape: false,
      landmarks: false,
    });
    const low2 = screen.getByRole('checkbox', { name: 'low 2' });
    expect(low2).not.toHaveClass('dim');
    expect(low2).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(low2);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('low2');
  });

  it('"low 2" is ALSO dimmed (and inert) while 3-tape is active even with Tapes on', () => {
    // The second dim branch (`refs.threeTape`): low 2 dims when 3-tape is active
    // regardless of Tapes — the guard must hold here too.
    const { onToggle } = renderRow({
      tapes: true,
      low2: false,
      threeTape: true,
      landmarks: false,
    });
    const low2 = screen.getByRole('checkbox', { name: 'low 2' });
    expect(low2).toHaveClass('dim');
    fireEvent.click(low2);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
