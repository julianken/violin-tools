import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Content } from '../shell/Content.tsx';

// Controls-card integration tests (§9.1 / §11.3 / §8.1 / §12.5). These mount the
// live Content (which owns the single `(root, scale, refs)` state, the three
// rows, and the note map) and assert the controls drive the map. Behaviour-level,
// not snapshots — they survive cosmetic change while pinning the load-bearing
// contracts: per-row content/order, per-row ARIA roles, roving tabindex + arrow
// selection, Refs independence (behavioural), the A-Major classify wiring, and
// the §9.1 dim logic.

function setup() {
  render(<Content />);
  const root = screen.getByRole('radiogroup', { name: 'Root note' });
  const scale = screen.getByRole('radiogroup', { name: 'Scale type' });
  const refs = screen.getByRole('group', { name: 'Reference layers' });
  const board = document.getElementById('board');
  if (board === null) throw new Error('no board');
  return {
    root,
    scale,
    refs,
    board,
    notes: () => Array.from(board.querySelectorAll('g.note')),
    openNote: (stringIndex: number) =>
      board.querySelectorAll('g.note')[stringIndex * 15],
  };
}

describe('controls ARIA roles (§11.3)', () => {
  it('has exactly 2 radiogroups (Root, Scale) and a Refs group — not a radiogroup', () => {
    setup();
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Reference layers' })).toBeInTheDocument();
    expect(
      screen.queryByRole('radiogroup', { name: 'Reference layers' }),
    ).not.toBeInTheDocument();
  });

  it('Root/Scale pills are role=radio; Refs pills are role=checkbox', () => {
    const { root, scale, refs } = setup();
    expect(within(root).getAllByRole('radio')).toHaveLength(12);
    expect(within(scale).getAllByRole('radio')).toHaveLength(7);
    expect(within(refs).getAllByRole('checkbox')).toHaveLength(4);
  });
});

describe('pill content / order / labels (§9.1)', () => {
  it('Root row renders the 12 default-spelling pills in chromatic order', () => {
    const { root } = setup();
    expect(within(root).getAllByRole('radio').map((p) => p.textContent)).toEqual([
      'C',
      'Db',
      'D',
      'Eb',
      'E',
      'F',
      'F#',
      'G',
      'Ab',
      'A',
      'Bb',
      'B',
    ]);
  });

  it('Scale row renders the 7 exact truncated labels in order', () => {
    const { scale } = setup();
    expect(within(scale).getAllByRole('radio').map((p) => p.textContent)).toEqual([
      'Major',
      'Nat. minor',
      'Harm. minor',
      'Mel. minor',
      'Major Pent.',
      'Minor Pent.',
      'Chromatic',
    ]);
  });

  it('Refs row renders the 4 pills in order with the §8.1 accent classes', () => {
    const { refs } = setup();
    const pills = within(refs).getAllByRole('checkbox');
    expect(pills.map((p) => p.textContent)).toEqual([
      'Tapes',
      'low 2',
      '3-tape',
      'Landmarks',
    ]);
    // The three tape pills carry pill-tape, the last carries pill-landmark (§8.1).
    expect(pills[0]?.classList.contains('pill-tape')).toBe(true);
    expect(pills[1]?.classList.contains('pill-tape')).toBe(true);
    expect(pills[2]?.classList.contains('pill-tape')).toBe(true);
    expect(pills[3]?.classList.contains('pill-landmark')).toBe(true);
  });
});

describe('static active highlight (§8.1) — Root/Scale only', () => {
  it('Root and Scale each render one highlight element; Refs renders none', () => {
    const { root, scale, refs } = setup();
    expect(root.querySelectorAll('.pill-highlight')).toHaveLength(1);
    expect(scale.querySelectorAll('.pill-highlight')).toHaveLength(1);
    expect(refs.querySelectorAll('.pill-highlight')).toHaveLength(0);
  });
});

describe('roving tabindex + arrow selection-follows-focus (§11.3)', () => {
  it('exactly one pill per radiogroup is tabbable (tabindex 0); rest are -1', () => {
    const { root } = setup();
    const radios = within(root).getAllByRole('radio');
    const tabbable = radios.filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    // The tabbable one is the selected (default A) pill.
    expect(tabbable[0]?.textContent).toBe('A');
    expect(radios.filter((r) => r.getAttribute('tabindex') === '-1')).toHaveLength(11);
  });

  it('ArrowRight selects the next pill (selection follows focus)', () => {
    const { root } = setup();
    const a = within(root).getByRole('radio', { name: 'A' });
    expect(a.getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    // A → Bb (the next in §9.1 order).
    const bb = within(root).getByRole('radio', { name: 'Bb' });
    expect(bb.getAttribute('aria-checked')).toBe('true');
    expect(within(root).getByRole('radio', { name: 'A' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(bb.getAttribute('tabindex')).toBe('0'); // roving tabindex moved
  });

  it('ArrowLeft selects the previous pill and clamps at the start', () => {
    const { root } = setup();
    fireEvent.keyDown(within(root).getByRole('radio', { name: 'A' }), { key: 'ArrowLeft' });
    expect(within(root).getByRole('radio', { name: 'Ab' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    // Clamp: from C, ArrowLeft stays on C (no wrap).
    fireEvent.keyDown(within(root).getByRole('radio', { name: 'Ab' }), { key: 'Home' });
    fireEvent.keyDown(within(root).getByRole('radio', { name: 'C' }), { key: 'ArrowLeft' });
    expect(within(root).getByRole('radio', { name: 'C' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });
});

describe('Refs independence — behavioural (the checkbox guard)', () => {
  it('toggling one Refs pill does NOT change any other Refs pill state', () => {
    const { refs } = setup();
    const tapes = within(refs).getByRole('checkbox', { name: 'Tapes' });
    const landmarks = within(refs).getByRole('checkbox', { name: 'Landmarks' });

    // Turn Tapes on, then Landmarks on — both must stay on (NOT mutually
    // exclusive, the exact bug single-select Refs wiring would cause).
    fireEvent.click(tapes);
    expect(tapes.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(landmarks);
    expect(landmarks.getAttribute('aria-checked')).toBe('true');
    // Tapes is UNCHANGED by toggling Landmarks.
    expect(tapes.getAttribute('aria-checked')).toBe('true');

    // Toggling Landmarks off again leaves Tapes on.
    fireEvent.click(landmarks);
    expect(landmarks.getAttribute('aria-checked')).toBe('false');
    expect(tapes.getAttribute('aria-checked')).toBe('true');
  });
});

describe('§9.1 dim logic in the DOM', () => {
  it('low 2 and 3-tape are .dim when Tapes is off (default), never hidden', () => {
    const { refs } = setup();
    const low2 = within(refs).getByRole('checkbox', { name: 'low 2' });
    const threeTape = within(refs).getByRole('checkbox', { name: '3-tape' });
    expect(low2.classList.contains('dim')).toBe(true);
    expect(threeTape.classList.contains('dim')).toBe(true);
    // dimmed != hidden — the elements are still in the DOM (§8.1 Do/Don't).
    expect(low2).toBeInTheDocument();
    expect(threeTape).toBeInTheDocument();
  });

  it('turning Tapes on un-dims low 2 and 3-tape', () => {
    const { refs } = setup();
    fireEvent.click(within(refs).getByRole('checkbox', { name: 'Tapes' }));
    expect(
      within(refs).getByRole('checkbox', { name: 'low 2' }).classList.contains('dim'),
    ).toBe(false);
    expect(
      within(refs).getByRole('checkbox', { name: '3-tape' }).classList.contains('dim'),
    ).toBe(false);
  });

  it('low 2 dims again while 3-tape is active (Tapes on)', () => {
    const { refs } = setup();
    fireEvent.click(within(refs).getByRole('checkbox', { name: 'Tapes' }));
    fireEvent.click(within(refs).getByRole('checkbox', { name: '3-tape' }));
    expect(
      within(refs).getByRole('checkbox', { name: 'low 2' }).classList.contains('dim'),
    ).toBe(true);
  });
});

describe('control → state → classify → map re-render (§12.5)', () => {
  it('default A Major matches the §12.5 worked check on the open strings', () => {
    const { openNote } = setup();
    // String order E5, A4, D4, G3; open node of string i is index i × 15.
    expect(openNote(0)?.classList.contains('is-scale')).toBe(true); // open E5
    expect(openNote(1)?.classList.contains('is-root')).toBe(true); // open A4 = root
    expect(openNote(2)?.classList.contains('is-scale')).toBe(true); // open D4
    expect(openNote(3)?.classList.contains('is-off')).toBe(true); // open G3 = off
  });

  it('selecting a different root re-renders the map in place', () => {
    const { root, openNote, notes } = setup();
    const before = notes();
    // Switch root A → C (pc 0). Open A4 (pc 9) is the 6th of C major → in-scale,
    // open G3 (pc 7) is the 5th of C → in-scale (was off in A major).
    fireEvent.click(within(root).getByRole('radio', { name: 'C' }));
    expect(openNote(1)?.classList.contains('is-scale')).toBe(true); // A4 now in-scale
    expect(openNote(3)?.classList.contains('is-scale')).toBe(true); // G3 now in-scale
    // The map re-rendered in place: still 60 nodes, same elements (S5/§7.5).
    const after = notes();
    expect(after).toHaveLength(60);
    expect(after[0]).toBe(before[0]);
  });

  it('selecting Chromatic leaves no off node', () => {
    const { scale, notes } = setup();
    fireEvent.click(within(scale).getByRole('radio', { name: 'Chromatic' }));
    expect(notes().filter((n) => n.classList.contains('is-off'))).toHaveLength(0);
  });
});
