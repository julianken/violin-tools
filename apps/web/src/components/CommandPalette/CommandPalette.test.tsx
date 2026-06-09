import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppShell } from '../../shell/AppShell.tsx';

// Command-palette integration tests (§8.5 / §9 / §11.3 / §15.2). These mount the
// live AppShell — the same wiring that ships — so they exercise the real entry
// paths (⌘K / Ctrl-K, the sidebar trigger), the dismiss paths (Esc, backdrop),
// roving selection across groups, the shared {raised} `.sel` state for keyboard
// AND pointer, the empty state, the verbatim ARIA names, and the load-bearing
// behaviour that choosing a Scales row sets (root, scale) and re-renders the map.
// Behaviour-level, not snapshots, so they survive cosmetic change.

function openWithChord(opts: { ctrl?: boolean } = {}) {
  render(<AppShell />);
  fireEvent.keyDown(window, opts.ctrl ? { key: 'k', ctrlKey: true } : { key: 'k', metaKey: true });
  return screen.getByRole('dialog', { name: 'Scale search' });
}

function board() {
  const el = document.getElementById('board');
  if (el === null) throw new Error('no board');
  return el;
}
function openNote(stringIndex: number): Element {
  const node = board().querySelectorAll('g.note')[stringIndex * 15];
  if (node === undefined) throw new Error(`no open note for string ${String(stringIndex)}`);
  return node;
}

describe('entry paths (§9)', () => {
  it('⌘K opens the palette', () => {
    expect(openWithChord()).toBeInTheDocument();
  });

  it('Ctrl-K opens the palette', () => {
    expect(openWithChord({ ctrl: true })).toBeInTheDocument();
  });

  it('the same ⌘K chord toggles the palette closed', () => {
    render(<AppShell />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog', { name: 'Scale search' })).toBeInTheDocument();
    // Toggle closed: the close animation starts; the dialog leaves the DOM after
    // the close-duration timeout (jsdom resolves --modal-out to 160 → fallback).
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    // It is now `.is-closing`; assert it has lost `.is-open` (the closing phase).
    const dialog = screen.getByRole('dialog', { name: 'Scale search' });
    expect(dialog.classList.contains('is-open')).toBe(false);
    expect(dialog.classList.contains('is-closing')).toBe(true);
  });

  it('clicking the sidebar search trigger opens the palette (§8.3)', () => {
    render(<AppShell />);
    // S16 ph3 (U7): the mobile top-bar search ALSO carries "Search scales and
    // tools" and jsdom applies no media query, so scope to the sidebar (<header>
    // banner) — the desktop palette opener.
    const banner = screen.getByRole('banner');
    fireEvent.click(within(banner).getByRole('button', { name: /search scales and tools/i }));
    expect(screen.getByRole('dialog', { name: 'Scale search' })).toBeInTheDocument();
  });
});

describe('dismiss paths (§9)', () => {
  it('Esc starts the close (drops .is-open, adds .is-closing)', () => {
    const dialog = openWithChord();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(dialog.classList.contains('is-open')).toBe(false);
    expect(dialog.classList.contains('is-closing')).toBe(true);
  });

  it('a backdrop (scrim) click starts the close; a click inside the modal does not', () => {
    const dialog = openWithChord();
    const overlay = dialog.parentElement;
    if (overlay === null) throw new Error('no overlay');
    // Click inside the modal: must NOT close.
    fireEvent.mouseDown(dialog);
    expect(dialog.classList.contains('is-closing')).toBe(false);
    // Click the backdrop itself: closes.
    fireEvent.mouseDown(overlay);
    expect(dialog.classList.contains('is-closing')).toBe(true);
  });
});

describe('ARIA names (§11.3)', () => {
  it('dialog "Scale search", input "Search scales and tools", listbox "Results"', () => {
    const dialog = openWithChord();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('textbox', { name: 'Search scales and tools' })).toBeVisible();
    expect(within(dialog).getByRole('listbox', { name: 'Results' })).toBeInTheDocument();
  });

  it('soon-stub tool rows carry aria-disabled="true" (§11.3)', () => {
    const dialog = openWithChord();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'intonation' } });
    const intonation = within(dialog).getByText('Intonation').closest('.pitem');
    expect(intonation).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('grouped results + structure (§8.5 / §9)', () => {
  it('renders the Scales and Tools group headers', () => {
    const dialog = openWithChord();
    expect(within(dialog).getByText('Scales')).toBeInTheDocument();
    expect(within(dialog).getByText('Tools')).toBeInTheDocument();
  });

  it('a Scales row label is in Inter (plabel), not the mono meta chip', () => {
    const dialog = openWithChord();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'A Major' } });
    const row = within(dialog).getByText('A Major');
    expect(row.classList.contains('plabel')).toBe(true);
  });
});

describe('roving selection (§8.5 / §11.3)', () => {
  it('exactly one row is selected at a time; ArrowDown moves it', () => {
    const dialog = openWithChord();
    const listbox = within(dialog).getByRole('listbox', { name: 'Results' });
    const selected = () => listbox.querySelectorAll('.pitem.sel');
    expect(selected()).toHaveLength(1); // top match pre-selected
    const firstBefore = selected()[0];
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    expect(selected()).toHaveLength(1);
    expect(selected()[0]).not.toBe(firstBefore); // selection moved
  });

  it('↓ crosses the group boundary from the last Scales row into the Scale Map tool', () => {
    const dialog = openWithChord();
    const listbox = within(dialog).getByRole('listbox', { name: 'Results' });
    // Hover the LAST Scales row (the selectable list is [84 scales…, Scale Map]),
    // then ArrowDown must step across the Scales→Tools boundary onto Scale Map.
    const scaleRows = listbox.querySelectorAll('.pgroup:first-child .pitem');
    const lastScale = scaleRows[scaleRows.length - 1];
    if (lastScale === undefined) throw new Error('no scales rows');
    fireEvent.mouseMove(lastScale);
    expect(listbox.querySelector('.pitem.sel')).toBe(lastScale);
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    const selectedRow = listbox.querySelector('.pitem.sel');
    expect(selectedRow?.textContent).toContain('Scale Map'); // crossed Scales→Tools
  });

  it('pointer hover and keyboard share the same .sel state (never two fills)', () => {
    const dialog = openWithChord();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'major' } });
    const listbox = within(dialog).getByRole('listbox', { name: 'Results' });
    const rows = listbox.querySelectorAll('.pitem:not(.soon)');
    const target = rows[2];
    if (target === undefined) throw new Error('expected a third row');
    fireEvent.mouseMove(target);
    const sel = listbox.querySelectorAll('.pitem.sel');
    expect(sel).toHaveLength(1); // still exactly one fill
    expect(sel[0]).toBe(target); // and it followed the pointer
  });
});

describe('empty state (§8.5)', () => {
  it('shows a single "No matches" line, suppresses headers, keeps the footer', () => {
    const dialog = openWithChord();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'zzzzz' } });
    expect(within(dialog).getByText('No matches')).toBeInTheDocument();
    expect(within(dialog).queryByText('Scales')).not.toBeInTheDocument(); // header suppressed
    expect(within(dialog).queryByText('Tools')).not.toBeInTheDocument();
    expect(within(dialog).queryAllByRole('option')).toHaveLength(0); // no rows
    expect(within(dialog).getByText('navigate')).toBeInTheDocument(); // footer remains
  });
});

describe('soon rows are non-actionable (§8.5)', () => {
  it('clicking a soon row neither selects nor closes the palette', () => {
    // Intonation is still a `soon` stub (Tuner became an `open` Tools row in S18
    // ph6, §17.1). Clicking the soon row is inert.
    const dialog = openWithChord();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'intonation' } });
    const intonation = within(dialog).getByText('Intonation').closest('.pitem');
    if (intonation === null) throw new Error('no intonation row');
    fireEvent.click(intonation);
    // Still open (not closing), and the soon row never gets the .sel fill.
    expect(dialog.classList.contains('is-closing')).toBe(false);
    expect(intonation.classList.contains('sel')).toBe(false);
  });
});

describe('Tuner palette row opens the Tuner view (§17.1)', () => {
  it('clicking the Tuner row swaps the main panel to the Tuner surface and closes', () => {
    const dialog = openWithChord();
    // Sanity: the note map is showing (its board exists in the main panel).
    expect(document.getElementById('board')).not.toBeNull();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'tuner' } });
    const tuner = within(dialog).getByText('Tuner').closest('.pitem');
    if (tuner === null) throw new Error('no tuner row');
    // The Tuner row is now actionable (`open`, not `soon`).
    expect(tuner.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(tuner);
    // The view swapped: the note-map board is gone, the Tuner H1 is shown, and the
    // palette began closing.
    expect(document.getElementById('board')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Chromatic tuner' })).toBeInTheDocument();
    expect(dialog.classList.contains('is-closing')).toBe(true);
  });
});

describe('Enter on a Scales row sets (root, scale) + re-renders the map (§9)', () => {
  it('choosing "C Major" sets root C, scale Major, and re-renders the note map', () => {
    // Default state is A Major: open A4 (string 1) is the root, open G3 (string
    // 3) is off (the §12.5 worked check). After choosing C Major, open A4 (pc 9)
    // is the 6th of C → in-scale, open G3 (pc 7) is the 5th of C → in-scale.
    const dialog = openWithChord();
    expect(openNote(1).classList.contains('is-root')).toBe(true); // A4 root in A
    expect(openNote(3).classList.contains('is-off')).toBe(true); // G3 off in A
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'C Major' } });
    // "C Major" is the unique top match; Enter activates it.
    fireEvent.keyDown(dialog, { key: 'Enter' });
    // Map re-rendered from the new (root, scale): open A4 + G3 now in-scale.
    expect(openNote(1).classList.contains('is-scale')).toBe(true);
    expect(openNote(3).classList.contains('is-scale')).toBe(true);
    // …and the palette began closing (Enter on a Scales row closes, §9).
    expect(dialog.classList.contains('is-closing')).toBe(true);
  });
});
