import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Content } from '../shell/Content.tsx';
import { useControls } from '../state/useControls.ts';

// Controls-card integration tests (§9.1 / §11.3 / §8.1 / §12.5). These mount the
// live Content and assert the controls drive the map. S9 lifted the `(root,
// scale, refs)` state up to the shell, so Content now RECEIVES the controls api
// as a prop; this harness owns the hook (the same `useControls` AppShell uses) so
// the integration is exercised end-to-end. Behaviour-level, not snapshots — they
// survive cosmetic change while pinning the load-bearing contracts: per-row
// content/order, per-row ARIA roles, roving tabindex + arrow selection, Refs
// independence (behavioural), the A-Major classify wiring, and the §9.1 dim logic.

function ContentHarness({ orientation }: { orientation?: 'horizontal' | 'vertical' } = {}) {
  const controls = useControls();
  // onSoundNote is the §11.3 live-region announce callback; these tests exercise
  // the controls → map wiring, not sounding, so a no-op satisfies the prop. The
  // orientation prop is spread only when given (exactOptionalPropertyTypes forbids
  // passing it as literal `undefined`), so the default harness stays horizontal.
  return (
    <Content
      controls={controls}
      onSoundNote={() => undefined}
      {...(orientation !== undefined ? { orientation } : {})}
    />
  );
}

function setup() {
  render(<ContentHarness />);
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
    openNote: (stringIndex: number) => board.querySelectorAll('g.note')[stringIndex * 15],
  };
}

describe('controls ARIA roles (§11.3)', () => {
  it('has exactly 2 radiogroups (Root, Scale) and a Refs group — not a radiogroup', () => {
    setup();
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Reference layers' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Reference layers' })).not.toBeInTheDocument();
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
    expect(
      within(root)
        .getAllByRole('radio')
        .map((p) => p.textContent),
    ).toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
  });

  it('Scale row renders the 7 exact truncated labels in order', () => {
    const { scale } = setup();
    expect(
      within(scale)
        .getAllByRole('radio')
        .map((p) => p.textContent),
    ).toEqual([
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
    expect(pills.map((p) => p.textContent)).toEqual(['Tapes', 'low 2', '3-tape', 'Landmarks']);
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
    expect(within(refs).getByRole('checkbox', { name: 'low 2' }).classList.contains('dim')).toBe(
      false,
    );
    expect(within(refs).getByRole('checkbox', { name: '3-tape' }).classList.contains('dim')).toBe(
      false,
    );
  });

  it('low 2 dims again while 3-tape is active (Tapes on)', () => {
    const { refs } = setup();
    fireEvent.click(within(refs).getByRole('checkbox', { name: 'Tapes' }));
    fireEvent.click(within(refs).getByRole('checkbox', { name: '3-tape' }));
    expect(within(refs).getByRole('checkbox', { name: 'low 2' }).classList.contains('dim')).toBe(
      true,
    );
  });
});

describe('§12.3 vertical-map Refs guard (U3b deferral — broken state unreachable)', () => {
  // The §12.3 overlay geometry is still horizontal-axis-only (not yet projected
  // through `axisOf` — the tracked U3b follow-up). Until it lands, a vertical map
  // must not let a user paint a mis-projected band: the Refs pills are disabled AND
  // <RefLayers> is skipped in the vertical render. These tests pin BOTH guards so a
  // future "un-disable on vertical" regression goes red here, not silently on phones.
  function setupVertical() {
    render(<ContentHarness orientation="vertical" />);
    const refs = screen.getByRole('group', { name: 'Reference layers' });
    const board = document.getElementById('board');
    if (board === null) throw new Error('no board');
    return { refs, board };
  }

  it('disables every Refs pill on the vertical map (dim + aria-disabled, non-interactive)', () => {
    const { refs } = setupVertical();
    const pills = within(refs).getAllByRole('checkbox');
    expect(pills).toHaveLength(4);
    for (const pill of pills) {
      expect(pill.classList.contains('dim')).toBe(true);
      expect(pill.getAttribute('aria-disabled')).toBe('true');
    }
  });

  it('clicking a disabled Refs pill on the vertical map never turns the layer on', () => {
    const { refs } = setupVertical();
    const tapes = within(refs).getByRole('checkbox', { name: 'Tapes' });
    expect(tapes.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(tapes); // the guard short-circuits onToggle
    expect(tapes.getAttribute('aria-checked')).toBe('false');
  });

  it('skips <RefLayers> entirely on the vertical render (no tape/land groups in the board)', () => {
    const { board } = setupVertical();
    // The mis-projectable overlay groups are absent on the vertical map.
    expect(board.querySelector('g.tape')).toBeNull();
    expect(board.querySelector('g.land')).toBeNull();
  });

  it('horizontal map keeps the Refs pills usable and renders <RefLayers> (today behavior)', () => {
    render(<ContentHarness orientation="horizontal" />);
    const refs = screen.getByRole('group', { name: 'Reference layers' });
    const board = document.getElementById('board');
    if (board === null) throw new Error('no board');
    // Tapes is interactive on horizontal: a click turns the layer on.
    const tapes = within(refs).getByRole('checkbox', { name: 'Tapes' });
    fireEvent.click(tapes);
    expect(tapes.getAttribute('aria-checked')).toBe('true');
    // The overlay groups are present (mounted, the .hide contract governs visibility).
    expect(board.querySelector('g.tape')).not.toBeNull();
    expect(board.querySelector('g.land')).not.toBeNull();
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

describe('§9.1 / §13 — pc-1 root pill + H1 relabel by scale family (S15)', () => {
  const h1 = () => document.querySelector('h1.h1')?.textContent;
  // The pc-1 pill is the SECOND pill (after `C`); pick it by its current label.
  const pc1Pill = (root: HTMLElement, label: string) =>
    within(root).getByRole('radio', { name: label });

  it('Db + Major: pc-1 pill reads Db and the H1 reads D♭ Major (regression guard)', () => {
    const { root, scale } = setup();
    fireEvent.click(within(root).getByRole('radio', { name: 'Db' }));
    fireEvent.click(within(scale).getByRole('radio', { name: 'Major' }));
    expect(pc1Pill(root, 'Db')).toBeInTheDocument();
    expect(h1()).toBe('D♭ Major');
  });

  it('Db + Natural Minor: pc-1 pill flips to C♯ and the H1 reads C♯ Natural Minor', () => {
    const { root, scale } = setup();
    fireEvent.click(within(root).getByRole('radio', { name: 'Db' }));
    fireEvent.click(within(scale).getByRole('radio', { name: 'Nat. minor' }));
    // The pill's text content IS its accessible name, so AT sees the flip too (§9.1).
    expect(pc1Pill(root, 'C♯')).toBeInTheDocument();
    expect(within(root).queryByRole('radio', { name: 'Db' })).not.toBeInTheDocument();
    expect(h1()).toBe('C♯ Natural Minor');
  });

  it('Db + Natural Minor: NO map dot label renders a B♭♭ (the #70 fix proof)', () => {
    const { root, scale, notes } = setup();
    fireEvent.click(within(root).getByRole('radio', { name: 'Db' }));
    fireEvent.click(within(scale).getByRole('radio', { name: 'Nat. minor' }));
    const labels = notes().map((n) => n.querySelector('text')?.textContent ?? '');
    expect(labels.some((t) => t.includes('♭♭'))).toBe(false);
    expect(labels.some((t) => t.includes('♯♯'))).toBe(false);
    // The C♯-minor root label is present on the map (open D4-string nodes etc.).
    expect(labels).toContain('C♯');
  });

  it('toggling Nat. minor → Major flips the pc-1 pill back from C♯ to Db', () => {
    const { root, scale } = setup();
    fireEvent.click(within(root).getByRole('radio', { name: 'Db' }));
    fireEvent.click(within(scale).getByRole('radio', { name: 'Nat. minor' }));
    expect(pc1Pill(root, 'C♯')).toBeInTheDocument();
    // Family toggles back: minor → major re-spells C♯ → Db (no double accidental either way).
    fireEvent.click(within(scale).getByRole('radio', { name: 'Major' }));
    expect(pc1Pill(root, 'Db')).toBeInTheDocument();
    expect(within(root).queryByRole('radio', { name: 'C♯' })).not.toBeInTheDocument();
  });
});
