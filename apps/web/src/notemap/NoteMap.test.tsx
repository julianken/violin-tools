import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NoteMap } from './NoteMap';
import { axisOf } from './geometry';

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

  it('off nodes carry no label text — except the §12.2 column-0 name slot; scale/root nodes do', () => {
    const { notes } = renderBoard();
    // Build a (state, hasLabelText) pair per node, then assert on the collected
    // data — no `expect` inside the loop/branch (vitest/no-conditional-expect).
    const rows = notes().map((node) => ({
      // The one sanctioned off-node label: an OFF OPEN string's marker carries
      // its string name in the slot (`is-open-name`, §12.2 column-0 rule).
      isBareOff:
        node.classList.contains('is-off') && !node.classList.contains('is-open-name'),
      hasText: (node.querySelector('text.lbl')?.textContent ?? '').length > 0,
    }));
    for (const row of rows) {
      // A bare off node has NO label text; every other node has some.
      expect(row.hasText).toBe(!row.isBareOff);
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

describe('NoteMap §13 scale-aware spelling — the flat-key regression guard', () => {
  // The original bug: a sharp-only pitch-class table plotted Bb's root dot as A♯.
  // These pin that the labels now spell letter-correct per the selected key, so a
  // revert to a sharp-only table fails the gate.
  function labelsOf(svg: Element): string[] {
    return Array.from(svg.querySelectorAll('g.note text.lbl'))
      .map((el) => el.textContent)
      .filter((t) => t.length > 0);
  }

  it('B♭ Major spells the root as B♭ — never A♯ (the original defect)', () => {
    // Bb = rootPc 10, root 'Bb'. The root dots must read B♭; A♯ must NOT appear.
    const { svg } = renderBoard({ rootPc: 10, root: 'Bb', scale: 'major' });
    const labels = labelsOf(svg);
    expect(labels).toContain('B♭');
    expect(labels).not.toContain('A♯');
    // No sharp glyph at all in B♭ Major (its accidentals are B♭ and E♭).
    expect(labels.some((l) => l.includes('♯'))).toBe(false);
  });

  it('B♭ Major spells E♭ (not D♯) for pitch class 3', () => {
    const { svg } = renderBoard({ rootPc: 10, root: 'Bb', scale: 'major' });
    expect(labelsOf(svg)).toContain('E♭');
    expect(labelsOf(svg)).not.toContain('D♯');
  });

  it('A Major still spells sharps (C♯ / F♯ / G♯), proving the labels are key-aware', () => {
    const { svg } = renderBoard({ rootPc: 9, root: 'A', scale: 'major' });
    const labels = labelsOf(svg);
    expect(labels).toContain('C♯');
    expect(labels).toContain('F♯');
    expect(labels).toContain('G♯');
    expect(labels.some((l) => l.includes('♭'))).toBe(false);
  });

  it('B♭ Chromatic uses flats — no A♯ / no sharp glyph anywhere', () => {
    const { svg } = renderBoard({ rootPc: 10, root: 'Bb', scale: 'chromatic' });
    const labels = labelsOf(svg);
    expect(labels).toContain('B♭');
    expect(labels).not.toContain('A♯');
    expect(labels.some((l) => l.includes('♯'))).toBe(false);
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

describe('§12.1 axis-aware dot placement', () => {
  // The 60 markers are walked in flat (stringIndex × columnOffset) order, so node
  // `i*15 + o` is (string i, column offset o). COLUMN_OFFSETS is [0..14], so the
  // flat column index IS the columnOffset. Sample the two open dots called out by
  // the U1 spec: node 0 = open E5 (string 0, offset 0); node 15 = open A4
  // (string 1, offset 0).
  const dotCenterOf = (node: Element) => {
    const dot = node.querySelector('circle.dot');
    return { cx: dot?.getAttribute('cx'), cy: dot?.getAttribute('cy') };
  };
  const expectedCenter = (
    layout: ReturnType<typeof axisOf>,
    stringIndex: number,
    columnOffset: number,
  ) => {
    const { cx, cy } = layout.dotCenter(stringIndex, columnOffset);
    return { cx: String(cx), cy: String(cy) };
  };

  it('prop-absent default reproduces horizontal+right+fit centers (§12.1 regression)', () => {
    // Render bare — no orientation/handedness/density props. After U0 this is the
    // byte-identical horizontal-fit geometry, pinned at the render boundary.
    const { notes } = renderBoard();
    const nodes = notes();
    const layout = axisOf({ orientation: 'horizontal', handedness: 'right', density: 'fit' });
    // Sample a few nodes across both strings and a stopped column.
    const samples: [number, number, number][] = [
      [0, 0, 0], // node 0  — open E5  (string 0, offset 0)
      [15, 1, 0], // node 15 — open A4  (string 1, offset 0)
      [7, 0, 7], // node 7  — string 0, stopped column 7
      [22, 1, 7], // node 22 — string 1, stopped column 7
    ];
    for (const [index, stringIndex, columnOffset] of samples) {
      expect(dotCenterOf(nodes[index]!)).toEqual(
        expectedCenter(layout, stringIndex, columnOffset),
      );
    }
  });

  it('vertical+comfort+right places dots on the swapped axis (G3 left of E5)', () => {
    const { notes } = renderBoard({
      orientation: 'vertical',
      handedness: 'right',
      density: 'comfort',
    });
    const nodes = notes();
    const layout = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    const samples: [number, number, number][] = [
      [0, 0, 0], // open E5
      [15, 1, 0], // open A4
      [45, 3, 0], // open G3 (string 3, offset 0)
      [7, 0, 7], // string 0, column 7
    ];
    for (const [index, stringIndex, columnOffset] of samples) {
      expect(dotCenterOf(nodes[index]!)).toEqual(
        expectedCenter(layout, stringIndex, columnOffset),
      );
    }
    // vertical+right puts G3 (string 3) open dot at a SMALLER cx than E5 (string 0)
    // open dot (mirrors geometry.test.ts:106-109; G3 open cx=56, E5 open cx=302).
    const g3OpenCx = Number(dotCenterOf(nodes[45]!).cx);
    const e5OpenCx = Number(dotCenterOf(nodes[0]!).cx);
    expect(g3OpenCx).toBe(56);
    expect(e5OpenCx).toBe(302);
    expect(g3OpenCx).toBeLessThan(e5OpenCx);
  });

  it('projects the static chrome through the axis (vertical string lines run down)', () => {
    // U3a: the chrome (string lines / nut / guides / labels) follows the render
    // axis. In vertical a string line runs DOWN the neck (x1===x2, y2>y1) at the
    // string's cross x, matching the resolved layout.
    const { svg } = renderBoard({
      orientation: 'vertical',
      handedness: 'right',
      density: 'comfort',
    });
    const layout = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
    const stringLines = Array.from(svg.querySelectorAll('line.string-line'));
    expect(stringLines).toHaveLength(4);
    // The G3 string (index 3) sits at the smallest cross x (56) in vertical+right.
    const g3 = layout.stringLine(3);
    const g3Line = stringLines.find((l) => l.getAttribute('x1') === String(g3.x1));
    expect(g3Line?.getAttribute('x1')).toBe(g3Line?.getAttribute('x2')); // runs down
    expect(g3Line?.getAttribute('x1')).toBe('56');
    expect(Number(g3Line?.getAttribute('y2'))).toBeGreaterThan(
      Number(g3Line?.getAttribute('y1')),
    );
  });

  it('keeps ALL chrome <text> upright in vertical — no rotation/transform (§3, §8)', () => {
    // CRUCIAL: a naive 90° map transform would rotate the labels. The chrome text
    // (the in-slot string name + the "open" label) must carry NO transform
    // attribute so the glyphs stay upright on the vertical map.
    const { svg } = renderBoard({
      orientation: 'vertical',
      handedness: 'right',
      density: 'comfort',
    });
    // A major default: open G is the lone off open string, so exactly ONE
    // string-name glyph renders — in the G string's column-0 slot (§12.2).
    const names = Array.from(svg.querySelectorAll('text.string-name'));
    const open = svg.querySelector('text.open-label');
    expect(names).toHaveLength(1);
    expect(open).not.toBeNull();
    for (const t of [...names, open]) {
      expect(t?.getAttribute('transform')).toBeNull();
    }
    // The per-dot note labels stay upright too (the lbl <text>).
    for (const lbl of Array.from(svg.querySelectorAll('g.note text.lbl'))) {
      expect(lbl.getAttribute('transform')).toBeNull();
    }
  });

  // ── §12.2 column-0 rule (issue #180): an OFF open string renders its string
  // name in the slot; in-scale/root opens keep their labeled dot as the string
  // identifier; there is NO separate chrome label row. ──────────────────────
  describe('column-0 string-name slot (§12.2, issue #180)', () => {
    const openMarker = (svg: SVGElement, stringIndex: number) =>
      Array.from(svg.querySelectorAll('g.note')).find(
        (n, i) => n.getAttribute('data-col') === '0' && Math.floor(i / 15) === stringIndex,
      );

    it('A major: exactly one string-name — G3 in the G string open slot, at dotCenter(G,0)', () => {
      const { svg } = renderBoard({
        orientation: 'vertical',
        handedness: 'right',
        density: 'comfort',
      });
      const names = Array.from(svg.querySelectorAll('text.string-name'));
      expect(names.map((n) => n.textContent)).toEqual(['G3']);
      // The name IS the marker's lbl, anchored at the open slot — vertical
      // comfort dotCenter(G3, 0) = (56, 30), baseline +4 (§12.1).
      const layout = axisOf({ orientation: 'vertical', handedness: 'right', density: 'comfort' });
      const g3Center = layout.dotCenter(3, 0);
      expect(names[0]?.getAttribute('x')).toBe(String(g3Center.cx));
      expect(names[0]?.getAttribute('y')).toBe(String(g3Center.cy + 4));
      expect(names[0]?.classList.contains('lbl')).toBe(true);
      expect(names[0]?.closest('g.note')?.classList.contains('is-open-name')).toBe(true);
    });

    it('A major: the D/A/E open markers carry NO string-name and keep their dot labels', () => {
      const { svg } = renderBoard();
      for (const [stringIndex, letter] of [
        [0, 'E'],
        [1, 'A'],
        [2, 'D'],
      ] as const) {
        const marker = openMarker(svg, stringIndex);
        expect(marker?.classList.contains('is-open-name')).toBe(false);
        expect(marker?.querySelector('text.lbl')?.textContent).toBe(letter);
        expect(marker?.querySelector('text.string-name')).toBeNull();
      }
    });

    it('D♭ major (all four opens off): four names G3/D4/A4/E5, dots persist hidden (§7.5)', () => {
      const { svg } = renderBoard({ rootPc: 1, root: 'Db', scale: 'major' });
      const names = Array.from(svg.querySelectorAll('text.string-name'));
      expect(names.map((n) => n.textContent).sort()).toEqual(['A4', 'D4', 'E5', 'G3']);
      // The §7.5 morph contract: the dot circle is HIDDEN (via .is-open-name
      // CSS), never unmounted — every name marker still holds its circle.dot.
      for (const name of names) {
        const marker = name.closest('g.note');
        expect(marker?.classList.contains('is-open-name')).toBe(true);
        expect(marker?.querySelector('circle.dot')).not.toBeNull();
      }
    });

    it('C major (all four opens in scale): zero names; open dots read E/A/D/G', () => {
      const { svg } = renderBoard({ rootPc: 0, root: 'C', scale: 'major' });
      expect(svg.querySelectorAll('text.string-name')).toHaveLength(0);
      const openLetters = [0, 1, 2, 3].map(
        (i) => openMarker(svg, i)?.querySelector('text.lbl')?.textContent,
      );
      expect(openLetters).toEqual(['E', 'A', 'D', 'G']);
    });

    it('keeps the marker aria-label untouched — open G still speaks "G, not in scale"', () => {
      const { svg } = renderBoard();
      const marker = openMarker(svg, 3);
      expect(marker?.getAttribute('aria-label')).toBe('G, not in scale');
    });

    it('the name-slot sounding ring takes the fixed r=13 (§12.2); stopped off dots keep r=6', () => {
      const { svg } = renderBoard();
      const nameMarker = openMarker(svg, 3);
      expect(nameMarker?.querySelector('circle.sound')?.getAttribute('r')).toBe('13');
      // A stopped off marker's sound ring still follows its dot radius (6).
      const stoppedOff = Array.from(svg.querySelectorAll('g.note.is-off')).find(
        (n) => n.getAttribute('data-col') !== '0',
      );
      expect(stoppedOff?.querySelector('circle.sound')?.getAttribute('r')).toBe('6');
    });

    it('morphs name ↔ dot IN PLACE on a root change — same DOM element (§7.5)', () => {
      const { svg, rerender } = renderBoard();
      const before = openMarker(svg, 3);
      expect(before?.classList.contains('is-open-name')).toBe(true);
      expect(before?.querySelector('text.lbl')?.textContent).toBe('G3');
      // C major puts open G in scale: the SAME element re-classifies — the
      // name yields to the in-scale dot without an unmount (§7.5).
      rerender({ rootPc: 0, root: 'C', scale: 'major' });
      const after = openMarker(svg, 3);
      expect(after).toBe(before);
      expect(after?.classList.contains('is-open-name')).toBe(false);
      expect(after?.classList.contains('is-scale')).toBe(true);
      expect(after?.querySelector('text.lbl')?.textContent).toBe('G');
    });
  });

  it('keeps the 60 nodes and their identity across an orientation prop flip', () => {
    const { notes, rerender } = renderBoard({
      orientation: 'horizontal',
      handedness: 'right',
      density: 'fit',
    });
    const before = notes();
    expect(before).toHaveLength(60);
    const beforeRefs = [...before];

    rerender({ orientation: 'vertical', handedness: 'right', density: 'comfort' });

    const after = notes();
    expect(after).toHaveLength(60); // still 60 — nothing unmounted/remounted
    // Same element objects, in the same order — React reused them by key (the key
    // is (stringIndex, columnOffset), orientation-invariant).
    for (let i = 0; i < 60; i++) {
      expect(after[i]).toBe(beforeRefs[i]);
    }
  });
});
