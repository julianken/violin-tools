import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NoteMap } from './NoteMap';

// NoteMap renders an SVG fragment (the inner content of `<svg id="board">`), so
// every test mounts it inside an <svg> host and queries that subtree. These are
// structural/behavioural assertions against §12.2 / §12.5 / §15.1 — not snapshots
// — so they survive cosmetic change while pinning the load-bearing contract.

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
    notes: () => Array.from(svg.querySelectorAll('g.note')),
    rerender: (next?: Parameters<typeof NoteMap>[0]) => {
      rerender(
        <svg>
          <NoteMap {...next} />
        </svg>,
      );
    },
  };
}

describe('NoteMap render (§12)', () => {
  it('renders exactly 60 note <g> nodes (4 strings × 15 columns)', () => {
    const { notes } = renderBoard();
    expect(notes()).toHaveLength(60);
  });

  it('each node holds the three persistent children glow / dot / lbl (§15.1)', () => {
    const { notes } = renderBoard();
    for (const node of notes()) {
      expect(node.querySelector('circle.glow')).not.toBeNull();
      expect(node.querySelector('circle.dot')).not.toBeNull();
      expect(node.querySelector('text.lbl')).not.toBeNull();
    }
  });

  it('every node carries the glow ring r=19 fill=none, shown only on root (§12.2)', () => {
    const { notes } = renderBoard();
    for (const node of notes()) {
      const glow = node.querySelector('circle.glow');
      expect(glow?.getAttribute('r')).toBe('19');
      expect(glow?.getAttribute('fill')).toBe('none');
    }
    // The root PITCH CLASS recurs across strings/columns, so several nodes are
    // root-state (A Major default → 6 root nodes); the glow shows on each via the
    // `.note.is-root .glow` CSS rule, while non-root nodes keep it at opacity 0.
    expect(
      notes().filter((n) => n.classList.contains('is-root')).length,
    ).toBeGreaterThan(0);
  });

  it('carries state as a class on the wrapper — is-off | is-scale | is-root (§15.1)', () => {
    const { notes } = renderBoard();
    for (const node of notes()) {
      const classed = ['is-off', 'is-scale', 'is-root'].filter((c) =>
        node.classList.contains(c),
      );
      expect(classed).toHaveLength(1); // exactly one state class
    }
  });

  // §12.2 dot radii are the redundant non-color cue (§11.1): off 6, in-scale 14,
  // root 15. Pin the radius matches the state class on every node.
  it('sets the §12.2 dot radius per state (off 6 / in-scale 14 / root 15)', () => {
    const { notes } = renderBoard();
    const radiusForState: Record<string, string> = {
      'is-off': '6',
      'is-scale': '14',
      'is-root': '15',
    };
    for (const node of notes()) {
      const state = ['is-off', 'is-scale', 'is-root'].find((c) =>
        node.classList.contains(c),
      );
      const dot = node.querySelector('circle.dot');
      expect(dot?.getAttribute('r')).toBe(radiusForState[state ?? '']);
    }
  });

  it('off nodes carry no label text; scale/root nodes do (§12.2)', () => {
    const { notes } = renderBoard();
    // Build a (state, hasLabelText) pair per node, then assert on the collected
    // data — no `expect` inside the loop/branch (vitest/no-conditional-expect).
    const rows = notes().map((node) => ({
      isOff: node.classList.contains('is-off'),
      hasText: (node.querySelector('text.lbl')?.textContent ?? '').length > 0,
    }));
    for (const row of rows) {
      // An off node must have NO label text; a scale/root node must have some.
      expect(row.hasText).toBe(!row.isOff);
    }
  });

  // §12.5 worked check (A Major, rootPc 9): open A4 = root, open E5 = in-scale,
  // open D4 = in-scale, open G3 = off. Column 0 is the open string of each.
  it('matches the §12.5 A-Major open-string worked check', () => {
    const { svg } = renderBoard({ rootPc: 9, scale: 'major' });
    const nodes = Array.from(svg.querySelectorAll('g.note'));
    // String order is E5, A4, D4, G3 (top-to-bottom); 15 columns each, so the
    // open node of string i is index i × 15.
    const openOf = (stringIndex: number) => nodes[stringIndex * 15];
    expect(openOf(0)?.classList.contains('is-scale')).toBe(true); // open E5
    expect(openOf(1)?.classList.contains('is-root')).toBe(true); // open A4
    expect(openOf(2)?.classList.contains('is-scale')).toBe(true); // open D4
    expect(openOf(3)?.classList.contains('is-off')).toBe(true); // open G3
  });

  it('renders no off node in Chromatic — every non-root dot is in-scale (§12.5)', () => {
    const { notes } = renderBoard({ rootPc: 9, scale: 'chromatic' });
    const all = notes();
    // Chromatic contains every pitch class, so no node is ever off; the root pc
    // (A = 9) recurs on 6 nodes and the other 54 are in-scale (§12.5 note).
    expect(all.filter((n) => n.classList.contains('is-off'))).toHaveLength(0);
    expect(all.filter((n) => n.classList.contains('is-root'))).toHaveLength(6);
    expect(all.filter((n) => n.classList.contains('is-scale'))).toHaveLength(54);
  });
});

describe('NoteMap transition-readiness (§7.5 / §15.1)', () => {
  // The S8 attach contract: on a (root, scale) change the SAME 60 DOM elements
  // persist (stable identity per (string, column)) and are re-classed in place —
  // never destroyed and recreated.
  it('re-classes the SAME 60 elements in place on a (root, scale) change', () => {
    const { notes, rerender } = renderBoard({ rootPc: 9, scale: 'major' });
    const before = notes();
    expect(before).toHaveLength(60);
    // Capture the actual DOM element identities (not copies).
    const beforeRefs = [...before];
    const beforeOpenA4 = before[1 * 15]; // open A4 = root in A Major

    rerender({ rootPc: 0, scale: 'naturalMinor' });

    const after = notes();
    expect(after).toHaveLength(60); // still 60 — nothing unmounted/remounted
    // Same element objects, in the same order — React reused them by key.
    for (let i = 0; i < 60; i++) {
      expect(after[i]).toBe(beforeRefs[i]);
    }
    // The open-A4 element is the SAME node, now re-classed off the A-Major root.
    expect(after[1 * 15]).toBe(beforeOpenA4);
    expect(beforeOpenA4?.classList.contains('is-root')).toBe(false);
  });

  it('a node leaving the scale becomes is-off in the same element, not removed', () => {
    const { svg, rerender } = renderBoard({ rootPc: 9, scale: 'major' });
    const openA4 = svg.querySelectorAll('g.note')[1 * 15];
    expect(openA4?.classList.contains('is-root')).toBe(true);

    // Switch to C Major: A4 (pc 9) is the 6th degree of C, still in scale, so
    // pick C# major instead → rootPc 1, A4 degree (9−1)=8 ∉ major set → off.
    rerender({ rootPc: 1, scale: 'major' });
    const sameNode = svg.querySelectorAll('g.note')[1 * 15];
    expect(sameNode).toBe(openA4); // same element
    expect(sameNode?.classList.contains('is-off')).toBe(true);
    // Its label element still EXISTS (hidden-not-unmounted), just empty.
    expect(sameNode?.querySelector('text.lbl')).not.toBeNull();
  });
});
