import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NoteMap } from './NoteMap';

// §11.3 accessibility suite for the note-map composite widget: the roving
// tabindex (one tab stop), the per-marker spoken accessible names (recomputed on
// a key change), and the Enter/Space sounding (announce + the §12.2 static stroke
// cue). These are jsdom behaviour assertions; the LIVE focus-ring paint and the
// axe scan live in the Playwright suite (e2e/a11y.spec.ts).

function renderBoard(props?: Parameters<typeof NoteMap>[0]) {
  const { container, rerender } = render(
    <svg>
      <NoteMap {...props} />
    </svg>,
  );
  const svg = container.querySelector('svg');
  if (svg === null) throw new Error('no svg host');
  return {
    svg,
    markers: () => Array.from(svg.querySelectorAll('g.note')),
    rerender: (next?: Parameters<typeof NoteMap>[0]) => {
      rerender(
        <svg>
          <NoteMap {...next} />
        </svg>,
      );
    },
  };
}

describe('§11.3 roving tabindex — the note map is one tab stop', () => {
  it('exposes exactly one marker with tabindex 0; the other 59 are -1', () => {
    const { markers } = renderBoard();
    const all = markers();
    expect(all).toHaveLength(60);
    const tabbable = all.filter((m) => m.getAttribute('tabindex') === '0');
    const untabbable = all.filter((m) => m.getAttribute('tabindex') === '-1');
    expect(tabbable).toHaveLength(1);
    expect(untabbable).toHaveLength(59);
  });

  it('the initial tab stop is a root marker (§11.3 "initially the root")', () => {
    const { markers } = renderBoard({ rootPc: 9, root: 'A', scale: 'major' });
    const tabbable = markers().find((m) => m.getAttribute('tabindex') === '0');
    // The first root marker in flat (string × column) order is the tab stop; in
    // A Major that is E5 column 5 (pc 9 = A), so it reads "A, root".
    expect(tabbable).toBeDefined();
    expect(tabbable?.getAttribute('aria-label')).toBe('A, root');
  });

  it('ArrowRight moves the single tab stop one column along the string', () => {
    // Pass orientation explicitly so the horizontal arrow semantics stay pinned
    // even as the default render orientation can resolve to vertical (S16 ph2).
    const { markers } = renderBoard({
      rootPc: 9,
      root: 'A',
      scale: 'major',
      orientation: 'horizontal',
    });
    const before = markers();
    const start = before.find((m) => m.getAttribute('tabindex') === '0');
    if (start === undefined) throw new Error('no tab stop');
    fireEvent.keyDown(start, { key: 'ArrowRight' });
    const after = markers();
    const tabbable = after.filter((m) => m.getAttribute('tabindex') === '0');
    // Still exactly one tab stop, now one index further (the next column).
    expect(tabbable).toHaveLength(1);
    expect(after.indexOf(tabbable[0]!)).toBe(after.indexOf(start) + 1);
  });

  it('ArrowDown crosses to the next string spatially (same column, +15 indices)', () => {
    const { markers } = renderBoard({ orientation: 'horizontal' });
    const before = markers();
    const start = before.find((m) => m.getAttribute('tabindex') === '0');
    if (start === undefined) throw new Error('no tab stop');
    const startIndex = before.indexOf(start);
    fireEvent.keyDown(start, { key: 'ArrowDown' });
    const after = markers();
    const next = after.find((m) => m.getAttribute('tabindex') === '0');
    expect(after.indexOf(next!)).toBe(startIndex + 15);
  });

  it('ArrowLeft clamps at the open column (no wrap to the previous string)', () => {
    const { markers } = renderBoard({
      rootPc: 9,
      root: 'A',
      scale: 'major',
      orientation: 'horizontal',
    });
    // Drive the tab stop to the open column (col 0) of its string with Home, then
    // ArrowLeft must clamp there (no wrap to the previous string).
    const start = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (start === undefined) throw new Error('no tab stop');
    fireEvent.keyDown(start, { key: 'Home' });
    const atOpen = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (atOpen === undefined) throw new Error('no tab stop after Home');
    const openIndex = markers().indexOf(atOpen);
    expect(openIndex % 15).toBe(0); // Home landed on the open column
    fireEvent.keyDown(atOpen, { key: 'ArrowLeft' });
    const after = markers().find((m) => m.getAttribute('tabindex') === '0');
    expect(markers().indexOf(after!)).toBe(openIndex); // clamped, unchanged
  });
});

describe('§11.3 roving re-binds to the visual axis (vertical)', () => {
  // In vertical the ALONG axis (a string, by column) runs DOWN the screen, so
  // Up/Down step along a string and Left/Right cross strings — the mirror of the
  // horizontal binding. The flat index model (string × column) is unchanged; only
  // the physical-key → delta mapping flips per orientation. The A Major tab stop
  // starts at flat index 5 (E5 string, col 5 — the first root, as the horizontal
  // suite documents), so the tests navigate deterministically from there.
  const vertical = { rootPc: 9, root: 'A', scale: 'major', orientation: 'vertical' } as const;
  const tabIndex = (ms: Element[]) =>
    ms.indexOf(ms.find((m) => m.getAttribute('tabindex') === '0')!);

  it('ArrowDown moves +1 along a string (by column), one tab stop', () => {
    const { markers } = renderBoard(vertical);
    const before = markers();
    const start = before.find((m) => m.getAttribute('tabindex') === '0');
    if (start === undefined) throw new Error('no tab stop');
    const startIndex = before.indexOf(start); // index 5, E5 col 5 — room to move down
    fireEvent.keyDown(start, { key: 'ArrowDown' });
    const after = markers();
    const tabbable = after.filter((m) => m.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(after.indexOf(tabbable[0]!)).toBe(startIndex + 1); // +1 column (ALONG)
  });

  it('ArrowRight crosses strings by ±columns (15 indices), one tab stop', () => {
    const { markers } = renderBoard(vertical);
    const start = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (start === undefined) throw new Error('no tab stop');
    // E5 (string 0) is the RIGHTMOST string in vertical+right (descending order),
    // so ArrowRight there clamps. Step CROSS to an interior string first with
    // ArrowLeft (toward the smaller cross coord), then ArrowRight must move back.
    fireEvent.keyDown(start, { key: 'ArrowLeft' });
    const interior = tabIndex(markers());
    fireEvent.keyDown(markers()[interior]!, { key: 'ArrowRight' });
    const after = markers();
    const tabbable = after.filter((m) => m.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    // A CROSS move is exactly one string away: ±15 (a multiple of columns).
    expect(Math.abs(after.indexOf(tabbable[0]!) - interior)).toBe(15);
  });

  it('ArrowUp clamps at the open column (the along-axis extreme)', () => {
    const { markers } = renderBoard(vertical);
    const start = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (start === undefined) throw new Error('no tab stop');
    // Drive to the open column (col 0) with Home (always along-string), then
    // ArrowUp (ALONG −1) must clamp there — the along-axis extreme.
    fireEvent.keyDown(start, { key: 'Home' });
    const atOpen = tabIndex(markers());
    expect(atOpen % 15).toBe(0); // Home landed on the open column
    fireEvent.keyDown(markers()[atOpen]!, { key: 'ArrowUp' });
    expect(tabIndex(markers())).toBe(atOpen); // clamped, unchanged
  });

  it('keeps exactly one tabindex=0 after each vertical move', () => {
    const { markers } = renderBoard(vertical);
    const start = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (start === undefined) throw new Error('no tab stop');
    for (const key of ['ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight']) {
      const here = tabIndex(markers());
      fireEvent.keyDown(markers()[here]!, { key });
      expect(markers().filter((m) => m.getAttribute('tabindex') === '0')).toHaveLength(1);
    }
  });
});

describe('§11.3 roving preserves the focused note across a flip', () => {
  it('keeps the SAME flat index as the single tab stop when orientation flips', () => {
    const { markers, rerender } = renderBoard({
      rootPc: 9,
      root: 'A',
      scale: 'major',
      orientation: 'vertical',
    });
    // Arrow once so movedRef is set (the user has taken over navigation).
    const start = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (start === undefined) throw new Error('no tab stop');
    fireEvent.keyDown(start, { key: 'ArrowDown' }); // ALONG +1 in vertical
    const movedIndex = markers().indexOf(
      markers().find((m) => m.getAttribute('tabindex') === '0')!,
    );
    // Flip to horizontal — the SAME flat index stays the single tab stop.
    rerender({ rootPc: 9, root: 'A', scale: 'major', orientation: 'horizontal' });
    const after = markers().filter((m) => m.getAttribute('tabindex') === '0');
    expect(after).toHaveLength(1);
    expect(markers().indexOf(after[0]!)).toBe(movedIndex);
  });

  it('re-focuses the SAME marker element across a flip when focus is IN the map', () => {
    const { markers, rerender } = renderBoard({
      rootPc: 9,
      root: 'A',
      scale: 'major',
      orientation: 'vertical',
    });
    // Arrow once — moveTo() both sets movedRef AND focuses the active marker, so
    // document.activeElement is now a marker inside the widget.
    const start = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (start === undefined) throw new Error('no tab stop');
    fireEvent.keyDown(start, { key: 'ArrowDown' });
    const focused = markers().find((m) => m === document.activeElement);
    expect(focused).toBeDefined(); // focus is on a marker (the intra-widget case)
    // Flip — focus must STAY on the active marker (the visible ring follows the note).
    rerender({ rootPc: 9, root: 'A', scale: 'major', orientation: 'horizontal' });
    const tabbable = markers().find((m) => m.getAttribute('tabindex') === '0');
    expect(document.activeElement).toBe(tabbable);
  });

  it('does NOT yank focus into the map on a flip when focus has left the widget', () => {
    // WCAG 3.2 (no surprise focus change): a user who arrowed in the map and then
    // Tabbed AWAY must not be dragged back into the SVG by a device-rotation flip.
    const { container, rerender } = render(
      <div>
        {/* An external control the user can Tab focus to, OUTSIDE the map widget. */}
        <button type="button" data-testid="outside">
          outside
        </button>
        <svg>
          <NoteMap rootPc={9} root="A" scale="major" orientation="vertical" />
        </svg>
      </div>,
    );
    const svg = container.querySelector('svg');
    if (svg === null) throw new Error('no svg host');
    const markers = () => Array.from(svg.querySelectorAll('g.note'));
    // Arrow once so movedRef is set (the user has navigated the map).
    const start = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (start === undefined) throw new Error('no tab stop');
    fireEvent.keyDown(start, { key: 'ArrowDown' });
    // Now leave the widget: park focus on the external control.
    const outside = container.querySelector<HTMLButtonElement>('[data-testid="outside"]');
    if (outside === null) throw new Error('no outside control');
    outside.focus();
    expect(document.activeElement).toBe(outside);
    // Flip the orientation — focus must STAY on the outside control, never the SVG.
    rerender(
      <div>
        <button type="button" data-testid="outside">
          outside
        </button>
        <svg>
          <NoteMap rootPc={9} root="A" scale="major" orientation="horizontal" />
        </svg>
      </div>,
    );
    expect(document.activeElement).toBe(
      container.querySelector('[data-testid="outside"]'),
    );
    expect(markers().some((m) => m === document.activeElement)).toBe(false);
  });
});

describe('§11.3 cross-sign follows the visual order (delta level)', () => {
  it('vertical+right: ArrowRight and ArrowLeft move in OPPOSITE ±columns directions', () => {
    // vertical+right has a DESCENDING crossOrder ([3,2,1,0]); the cross sign must
    // invert so the on-screen direction still matches. Here we assert only that
    // the two cross keys go opposite ways at the delta level (screen-pixel
    // direction is verified in the U7 e2e). Start on an interior string (A4) so
    // both cross keys have room to move.
    const { markers } = renderBoard({
      rootPc: 9,
      root: 'A',
      scale: 'major',
      orientation: 'vertical',
    });
    const indexOfTab = () =>
      markers().indexOf(markers().find((m) => m.getAttribute('tabindex') === '0')!);
    const start = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (start === undefined) throw new Error('no tab stop');
    // From E5 col 5 (the rightmost string), one ArrowLeft steps CROSS to A4 col 5 —
    // an interior string with a neighbor on BOTH cross sides.
    fireEvent.keyDown(start, { key: 'ArrowLeft' });
    const base = indexOfTab();
    // ArrowRight from base, then back to base, then ArrowLeft from base.
    fireEvent.keyDown(markers()[base]!, { key: 'ArrowRight' });
    const right = indexOfTab();
    fireEvent.keyDown(markers()[right]!, { key: 'ArrowLeft' });
    expect(indexOfTab()).toBe(base); // ArrowLeft undoes ArrowRight
    fireEvent.keyDown(markers()[base]!, { key: 'ArrowLeft' });
    const left = indexOfTab();
    // The two cross keys move opposite ways: one +columns, one −columns.
    expect(right - base).toBe(-(left - base));
    expect(Math.abs(right - base)).toBe(15);
  });
});

describe('§11.3 / §12.2 per-marker spoken accessible names', () => {
  it('names each marker with its §13 spoken note + state suffix', () => {
    const { svg } = renderBoard({ rootPc: 9, root: 'A', scale: 'major' });
    const labels = Array.from(svg.querySelectorAll('g.note')).map((m) =>
      m.getAttribute('aria-label'),
    );
    // The §11.3 example strings must appear: a root, an in-scale, and an off.
    expect(labels).toContain('A, root'); // open A4 = root
    expect(labels).toContain('C sharp, in scale'); // C♯ = 3rd of A major
    expect(labels).toContain('G, not in scale'); // G (pc 7) off in A major
  });

  it('recomputes every accessible name when the key changes (root/scale)', () => {
    const { svg, rerender } = renderBoard({ rootPc: 9, root: 'A', scale: 'major' });
    // Open G3 (string 3, col 0 → index 45): off in A major.
    const openG3 = () => Array.from(svg.querySelectorAll('g.note'))[45];
    expect(openG3()?.getAttribute('aria-label')).toBe('G, not in scale');
    // Switch to G major: open G3 becomes the root → its name must update.
    rerender({ rootPc: 7, root: 'G', scale: 'major' });
    expect(openG3()?.getAttribute('aria-label')).toBe('G, root');
  });

  it('spells off-node names key-aware (B♭ Major speaks flats, never sharps)', () => {
    const { svg } = renderBoard({ rootPc: 10, root: 'Bb', scale: 'major' });
    const labels = Array.from(svg.querySelectorAll('g.note')).map(
      (m) => m.getAttribute('aria-label') ?? '',
    );
    // No marker name contains "sharp" in a flat key — off notes spell flat too.
    expect(labels.some((l) => l.includes('sharp'))).toBe(false);
    expect(labels).toContain('B flat, root');
  });

  it('hides the visual label from AT (the marker aria-label is the single name)', () => {
    const { svg } = renderBoard();
    for (const lbl of svg.querySelectorAll('g.note text.lbl')) {
      expect(lbl.getAttribute('aria-hidden')).toBe('true');
    }
  });
});

describe('§11.3 Enter/Space sounding — announce + the static stroke cue', () => {
  it('Enter on the focused marker announces its spoken note name', () => {
    const onSoundNote = vi.fn();
    const { markers } = renderBoard({ rootPc: 9, root: 'A', scale: 'major', onSoundNote });
    const tabStop = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (tabStop === undefined) throw new Error('no tab stop');
    fireEvent.keyDown(tabStop, { key: 'Enter' });
    // The root tab stop is A4 → spoken "A" (no suffix on the live-region phrase).
    expect(onSoundNote).toHaveBeenCalledWith('A');
  });

  it('Space sounds the focused marker (same as Enter)', () => {
    const onSoundNote = vi.fn();
    const { markers } = renderBoard({ rootPc: 9, root: 'A', scale: 'major', onSoundNote });
    const tabStop = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (tabStop === undefined) throw new Error('no tab stop');
    fireEvent.keyDown(tabStop, { key: ' ' });
    expect(onSoundNote).toHaveBeenCalledWith('A');
  });

  it('sounding toggles the §12.2 .is-sounding stroke on exactly the sounded marker', () => {
    const { markers } = renderBoard({ rootPc: 9, root: 'A', scale: 'major' });
    const tabStop = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (tabStop === undefined) throw new Error('no tab stop');
    fireEvent.keyDown(tabStop, { key: 'Enter' });
    const sounding = markers().filter((m) =>
      m.querySelector('circle.sound.is-sounding') !== null,
    );
    // Exactly one marker carries the sounding stroke — the one just sounded.
    expect(sounding).toHaveLength(1);
    expect(sounding[0]?.getAttribute('aria-label')).toBe('A, root');
  });

  it('does not announce when no onSoundNote is wired (static render is safe)', () => {
    const { markers } = renderBoard({ rootPc: 9, scale: 'major' });
    const tabStop = markers().find((m) => m.getAttribute('tabindex') === '0');
    if (tabStop === undefined) throw new Error('no tab stop');
    // Must not throw without the callback (the S5 static default omits it).
    expect(() => {
      fireEvent.keyDown(tabStop, { key: 'Enter' });
    }).not.toThrow();
  });
});
