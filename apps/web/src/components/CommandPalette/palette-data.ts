// palette-data.ts — the command palette's jump-target catalogue, as PURE data
// (no React/DOM). The palette READS this list and, on a Scales row, WRITES its
// `(root, scale)` into the shared selection state (S6); it never owns the scale
// vocabulary — the roots and scale types come from @violin-tools/theory and the
// controls content contract (state/controls.ts). DESIGN.md §8.5 / §9 / §15.2 win
// on any conflict (AGENTS.md).
//
// Two groups, in the §9 tree order: a **Scales** group (one jump target per
// root × scale, e.g. "A Major" — choosing one sets that `(root, scale)`), then a
// **Tools** group (Scale Map = the live tool, `open`; Intonation/Tuner = `soon`
// stubs). The glyphs are Unicode characters set as text (§0 `icon.glyph-char`,
// §8.5), never drawn SVG.

import { type Root, type ScaleType } from '@violin-tools/theory';

import { ROOT_PILLS } from '../../state/controls.ts';

/** The kind of meta chip a row carries (§8.5): `↵`, `open`, or `soon`. */
export type RowMeta = 'enter' | 'open' | 'soon';

/** The rendered text of a row's trailing meta chip (§8.5): `↵` / `open` / `soon`. */
export function metaGlyph(meta: RowMeta): string {
  if (meta === 'enter') return '↵';
  return meta; // 'open' | 'soon' render their own word
}

/** A Scales-group jump target — selecting it sets `(root, scale)` (§9, §15.2). */
export interface ScaleTarget {
  readonly kind: 'scale';
  /** Stable id (e.g. `scale:A:major`) for keys + selection identity. */
  readonly id: string;
  /** The human label, Inter (§8.5): `"{root} {ScaleName}"`, e.g. `"A Major"`. */
  readonly label: string;
  /** The §0 `icon.glyph-char` for a Scales row — always `♪` (§8.5). */
  readonly glyph: string;
  /** Trailing meta: a Scales row is always actionable → `↵` (`enter`) (§8.5). */
  readonly meta: 'enter';
  /** The root this row selects (§9). */
  readonly root: Root;
  /** The scale this row selects (§9). */
  readonly scale: ScaleType;
}

/** A Tools-group row — the live Scale Map (`open`) or a `soon` stub (§8.5). */
export interface ToolTarget {
  readonly kind: 'tool';
  readonly id: string;
  readonly label: string;
  readonly glyph: string;
  /** `open` for the live Scale Map; `soon` for the non-actionable stubs (§8.5). */
  readonly meta: 'open' | 'soon';
}

/** Any palette row — a Scales jump target or a Tools row. */
export type PaletteTarget = ScaleTarget | ToolTarget;

/** A rendered group: a mono uppercase header (§8.5) plus its rows. */
export interface PaletteGroup {
  readonly heading: string;
  readonly items: readonly PaletteTarget[];
}

/**
 * §8.5 full scale display names. The §9.1 Scale row uses TRUNCATED pill labels
 * ("Nat. minor") because the pill box is narrow; the palette row is wide and is
 * human language, so it spells the full name ("A Natural Minor"), matching the
 * §15.2 worked example ("A Major"). The truncation lives in `SCALE_PILLS`; the
 * full spelling lives here — the two are deliberately separate strings.
 */
const SCALE_DISPLAY_NAME: Readonly<Record<ScaleType, string>> = {
  major: 'Major',
  naturalMinor: 'Natural Minor',
  harmonicMinor: 'Harmonic Minor',
  melodicMinor: 'Melodic Minor',
  majorPentatonic: 'Major Pentatonic',
  minorPentatonic: 'Minor Pentatonic',
  chromatic: 'Chromatic',
};

/** The seven scales in §9.1 / §12.5(a) order — the Scales-group inner order. */
const SCALE_ORDER: readonly ScaleType[] = [
  'major',
  'naturalMinor',
  'harmonicMinor',
  'melodicMinor',
  'majorPentatonic',
  'minorPentatonic',
  'chromatic',
];

/**
 * Every Scales jump target — the 12 roots (§9.1 order) × the 7 scales
 * (§9.1 / §12.5(a) order), 84 rows. The label is `"{root} {ScaleName}"`; the
 * glyph is the Scales-group marker `♪`; the meta is `↵` (always actionable).
 */
const SCALE_TARGETS: readonly ScaleTarget[] = ROOT_PILLS.flatMap((root) =>
  SCALE_ORDER.map(
    (scale): ScaleTarget => ({
      kind: 'scale',
      id: `scale:${root}:${scale}`,
      label: `${root} ${SCALE_DISPLAY_NAME[scale]}`,
      glyph: '♪',
      meta: 'enter',
      root,
      scale,
    }),
  ),
);

/**
 * The Tools group (§8.5): the live **Scale Map** (`▦`, `open`), then the `soon`
 * stubs **Intonation** (`◴`) and **Tuner** (`◎`) — the two future tools the
 * §8.5 palette row names (Vibrato is a sidebar nav stub, not a palette row).
 */
const TOOL_TARGETS: readonly ToolTarget[] = [
  { kind: 'tool', id: 'tool:scale-map', label: 'Scale Map', glyph: '▦', meta: 'open' },
  { kind: 'tool', id: 'tool:intonation', label: 'Intonation', glyph: '◴', meta: 'soon' },
  { kind: 'tool', id: 'tool:tuner', label: 'Tuner', glyph: '◎', meta: 'soon' },
];

/** The two group headings, in §9 tree order. */
const SCALES_HEADING = 'Scales';
const TOOLS_HEADING = 'Tools';

/**
 * Filter the catalogue by `query` and return the visible groups in §9 order.
 * Matching is case-insensitive substring on the label; an empty query returns
 * everything. A group with no surviving rows is dropped entirely so its header
 * is suppressed (§8.5). A `soon` row is still listed (it is non-actionable, not
 * hidden) so a violinist can see the future tool exists.
 */
export function filterGroups(query: string): readonly PaletteGroup[] {
  const q = query.trim().toLowerCase();
  const match = (t: PaletteTarget): boolean => q === '' || t.label.toLowerCase().includes(q);

  const scales = SCALE_TARGETS.filter(match);
  const tools = TOOL_TARGETS.filter(match);

  const groups: PaletteGroup[] = [];
  if (scales.length > 0) groups.push({ heading: SCALES_HEADING, items: scales });
  if (tools.length > 0) groups.push({ heading: TOOLS_HEADING, items: tools });
  return groups;
}

/**
 * The flat, in-display-order list of the SELECTABLE rows across all visible
 * groups (a `soon` tool is excluded — it is non-selectable, §8.5). This is the
 * sequence roving ↑/↓ steps through, crossing group boundaries (§11.3): the
 * Scales rows then the live Scale Map row, skipping the `soon` stubs.
 */
export function selectableRows(groups: readonly PaletteGroup[]): readonly PaletteTarget[] {
  return groups.flatMap((g) => g.items.filter((t) => t.meta !== 'soon'));
}
