import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type Handedness, type Orientation } from './mapView';
import { useRovingNoteMap } from './useRovingNoteMap';

// Direct unit tests for useRovingNoteMap — the §11.3 roving-keyboard hook. The
// NoteMapA11y suite drives this through the NoteMap component and covers the
// common moves, but two reachable branches are untested at the hook level:
//   • the `End` key (L199–202) — jump to the LAST column of the current string
//     (off-by-one-able `row*columns + (columns-1)` arithmetic); and
//   • `ArrowUp` under `orientation === 'horizontal'` (L191, `cross(-1)`) — the
//     mirror of the existing ArrowDown-horizontal CROSS move; a swapped branch
//     (cross(+1) vs cross(-1)) would slip every existing test.
// A tiny harness renders the grid so the hook's focus-moving refs are real SVG
// `<g>` elements (its `moveTo` focuses the active marker), matching how NoteMap
// wires it — but the assertions target the hook's `tabIndexFor`, not NoteMap.

const ROWS = 4;
const COLUMNS = 15;

function Harness(props: {
  orientation: Orientation;
  handedness: Handedness;
  initialIndex?: number;
  onSound?: (index: number) => void;
}) {
  const roving = useRovingNoteMap({
    rows: ROWS,
    columns: COLUMNS,
    initialIndex: props.initialIndex ?? 0,
    onSound: props.onSound ?? (() => undefined),
    orientation: props.orientation,
    handedness: props.handedness,
  });
  return (
    <svg>
      <g className="notes">
        {Array.from({ length: ROWS * COLUMNS }, (_unused, index) => (
          <g
            key={index}
            className="note"
            data-index={index}
            tabIndex={roving.tabIndexFor(index)}
            ref={roving.registerMarker(index)}
            onKeyDown={roving.onKeyDown}
          />
        ))}
      </g>
    </svg>
  );
}

function renderGrid(props: Parameters<typeof Harness>[0]) {
  const { container } = render(<Harness {...props} />);
  const markers = () => Array.from(container.querySelectorAll('g.note'));
  const activeIndex = () => {
    const el = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (el === undefined) throw new Error('no tab stop');
    return Number(el.getAttribute('data-index'));
  };
  return { markers, activeIndex };
}

describe('useRovingNoteMap — End key (§11.3 along-string jump)', () => {
  it('End from the open column lands on the LAST column of the same string', () => {
    // Start at flat index 0 (string 0, col 0). End jumps along-string to the last
    // column: row*columns + (columns-1) = 0*15 + 14 = 14 — the same string, far end.
    const { markers, activeIndex } = renderGrid({
      orientation: 'horizontal',
      handedness: 'right',
      initialIndex: 0,
    });
    fireEvent.keyDown(markers()[0]!, { key: 'End' });
    expect(activeIndex()).toBe(14); // last column of string 0
  });

  it('End from a mid-string marker stays on that string (string * columns + last)', () => {
    // Start mid-string on string 2 (index 2*15 + 5 = 35). End is orientation-
    // invariant (always along-string): it must land on string 2's last column =
    // 2*15 + 14 = 44 — NOT the last column of the whole grid (59).
    const { markers, activeIndex } = renderGrid({
      orientation: 'vertical',
      handedness: 'right',
      initialIndex: 35,
    });
    fireEvent.keyDown(markers()[35]!, { key: 'End' });
    expect(activeIndex()).toBe(44); // string 2, last column — not 59
  });
});

describe('useRovingNoteMap — horizontal ArrowUp (§11.3 cross(-1))', () => {
  it('ArrowUp (horizontal) is the inverse of ArrowDown — it CROSSES one string back', () => {
    // In horizontal, Up/Down are the CROSS axis. ArrowDown from string 1 (index 20)
    // moves +columns to string 2 (35); ArrowUp must move the mirror −columns back to
    // string 1 (20). horizontal+right has an ASCENDING crossOrder, so cross(+1) =
    // +15 and cross(-1) = −15. Pinning ArrowUp catches a swapped cross-branch typo.
    const { markers, activeIndex } = renderGrid({
      orientation: 'horizontal',
      handedness: 'right',
      initialIndex: 20, // string 1, col 5
    });
    fireEvent.keyDown(markers()[20]!, { key: 'ArrowDown' });
    const down = activeIndex();
    expect(down).toBe(35); // crossed to string 2 (+15)
    fireEvent.keyDown(markers()[down]!, { key: 'ArrowUp' });
    expect(activeIndex()).toBe(20); // ArrowUp undid it (−15) — cross(-1)
  });

  it('ArrowUp (horizontal) clamps at the first string (no wrap past row 0)', () => {
    // From string 0 (index 5), ArrowUp would step to row −1; the cross guard
    // (`nextRow >= 0`) clamps, so the tab stop stays put.
    const { markers, activeIndex } = renderGrid({
      orientation: 'horizontal',
      handedness: 'right',
      initialIndex: 5, // string 0
    });
    fireEvent.keyDown(markers()[5]!, { key: 'ArrowUp' });
    expect(activeIndex()).toBe(5); // clamped — no move off the top string
  });
});

describe('useRovingNoteMap — Enter/Space still sound (harness sanity)', () => {
  it('Enter sounds the active marker (the hook wiring is live in the harness)', () => {
    const onSound = vi.fn();
    const { markers } = renderGrid({
      orientation: 'horizontal',
      handedness: 'right',
      initialIndex: 7,
      onSound,
    });
    fireEvent.keyDown(markers()[7]!, { key: 'Enter' });
    expect(onSound).toHaveBeenCalledWith(7);
  });
});
