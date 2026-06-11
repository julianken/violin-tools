import { describe, expect, it } from 'vitest';

import {
  filterGroups,
  metaGlyph,
  selectableRows,
  type ScaleTarget,
  type ToolTarget,
} from './palette-data.ts';

// palette-data unit tests (§8.5 / §9 / §15.2). Pure data — no React/DOM — so the
// catalogue shape, grouping, glyph/meta assignment, filtering, header
// suppression, and the soon-skipping selectable list are pinned without a render.

describe('catalogue shape (§8.5 / §9)', () => {
  it('returns the two groups in §9 order on an empty query: Scales then Tools', () => {
    const groups = filterGroups('');
    expect(groups.map((g) => g.heading)).toEqual(['Scales', 'Tools']);
  });

  it('Scales group is 12 roots × 7 scales = 84 rows, all ♪ / ↵, kind scale', () => {
    const scales = filterGroups('')[0];
    expect(scales?.heading).toBe('Scales');
    expect(scales?.items).toHaveLength(84);
    for (const item of scales?.items ?? []) {
      expect(item.kind).toBe('scale');
      expect(item.glyph).toBe('♪'); // §8.5 Scales glyph
      expect(item.meta).toBe('enter'); // §8.5 actionable → ↵
    }
  });

  it('the first Scales row is "C Major" (§9.1 root order starts at C)', () => {
    const first = filterGroups('')[0]?.items[0] as ScaleTarget | undefined;
    expect(first?.label).toBe('C Major');
    expect(first?.root).toBe('C');
    expect(first?.scale).toBe('major');
  });

  it('spells full scale names (e.g. "A Natural Minor"), not the truncated pill labels', () => {
    const labels = (filterGroups('')[0]?.items ?? []).map((i) => i.label);
    expect(labels).toContain('A Major'); // the §15.2 worked-example row
    expect(labels).toContain('A Natural Minor'); // full, not "Nat. minor"
    expect(labels).toContain('A Major Pentatonic'); // full, not "Major Pent."
    expect(labels).not.toContain('A Nat. minor');
  });

  it('Tools group is Scale Map (open ▦), open Intonation (◴), open Tuner (◎)', () => {
    // S18 ph6 (§17.1): Tuner became an `open` Tools row (a live view).
    // C9: Intonation also became an `open` Tools row (a live view).
    const tools = filterGroups('')[1];
    expect(tools?.heading).toBe('Tools');
    const items = (tools?.items ?? []) as ToolTarget[];
    expect(items.map((i) => i.label)).toEqual(['Scale Map', 'Intonation', 'Tuner']);
    expect(items.map((i) => i.meta)).toEqual(['open', 'open', 'open']);
    expect(items.map((i) => i.glyph)).toEqual(['▦', '◴', '◎']);
  });
});

describe('metaGlyph (§8.5 trailing meta)', () => {
  it('renders ↵ for enter, and the literal word for open/soon', () => {
    expect(metaGlyph('enter')).toBe('↵');
    expect(metaGlyph('open')).toBe('open');
    expect(metaGlyph('soon')).toBe('soon');
  });
});

describe('filtering + header suppression (§8.5)', () => {
  it('filters case-insensitively on the label', () => {
    const groups = filterGroups('harmonic');
    const scales = groups.find((g) => g.heading === 'Scales');
    // 12 roots × the one Harmonic Minor scale.
    expect(scales?.items).toHaveLength(12);
    expect((scales?.items ?? []).every((i) => i.label.includes('Harmonic Minor'))).toBe(true);
  });

  it('drops a group entirely (suppressing its header) when nothing in it matches', () => {
    // "tuner" matches only the Tools group → the Scales group is suppressed.
    const groups = filterGroups('tuner');
    expect(groups.map((g) => g.heading)).toEqual(['Tools']);
  });

  it('returns no groups when nothing matches (the empty-state trigger)', () => {
    expect(filterGroups('zzzzz')).toEqual([]);
  });
});

describe('selectableRows skips soon (§8.5 / §11.3)', () => {
  it('crosses group boundaries and excludes the soon stubs', () => {
    const groups = filterGroups('');
    const rows = selectableRows(groups);
    // 84 Scales + 3 live tools (Scale Map + Intonation + Tuner) = 87; no soon tools
    // remain (Intonation promoted from soon to open in C9).
    expect(rows).toHaveLength(87);
    const labels = rows.map((r) => r.label);
    expect(labels).toContain('Scale Map'); // live tool is selectable
    expect(labels).toContain('Tuner'); // S18 ph6 — Tuner is now a live, selectable view
    expect(labels).toContain('Intonation'); // C9 — Intonation is now a live, selectable view
    // No selectable row is a soon row.
    expect(rows.every((r) => r.meta !== 'soon')).toBe(true);
  });
});
