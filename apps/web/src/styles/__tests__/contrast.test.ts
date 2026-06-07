import { describe, expect, it } from 'vitest';

/**
 * §2.5 contrast verification — an executable guard on the DESIGN.md §2.5
 * "Contrast pairs (computed)" table.
 *
 * §2.5 / §11.2 make a note-map contrast failure a P0 blocker, so the table is
 * encoded here as a test: every row recomputes the WCAG 2.x relative-luminance
 * ratio, translucent fills are FIRST composited over their backing surface, and
 * each computed ratio must match §2.5 to the hundredth. A future hex edit that
 * breaks a documented pair fails this gate loudly.
 *
 * The hex literals below are duplicated from DESIGN.md §0 / the tokens.css
 * primitives ON PURPOSE: the point of this test is to recompute §2.5 from the
 * raw literals independently and assert the published ratios, so it must read
 * the literals, not the (untestable-from-JS) resolved CSS custom properties.
 *
 * Two documented sub-threshold pairings are asserted as ALLOWED exemptions, not
 * failures: {text3} on {surface} (3.37:1, placeholder/section-header/meta only)
 * and {sidebar}/{muted} (2.23:1, disabled-only — WCAG 1.4.3 exempts disabled UI
 * components; the "soon" nav items are never enabled).
 */

// ── §0 primitives referenced by §2.5 (hex literals, transcribed from §0) ──
const GRAY_950 = '#0a0a0a'; // canvas
const GRAY_945 = '#0c0c0d'; // sidebar
const GRAY_930 = '#141417'; // panel
const GRAY_925 = '#161618'; // surface
const GRAY_915 = '#1c1c1f'; // raised
const GRAY_600 = '#4a4a52'; // muted
const GRAY_500 = '#6a6a72'; // text3
const GRAY_300 = '#9a9aa2'; // text2
const GRAY_100 = '#ededed'; // text
const MINT_500 = '#00d4a4'; // mint (solid root dot)

// ink-* primitives consumed as foregrounds in §2.5
const INK_ROOT_LBL = '#08130f'; // root-label
const INK_SCALE_LBL = '#ffffff'; // scale-label
const INK_STRNAME = '#cfcfd4'; // string-name
const INK_TAPE_NUM = '#d6b878'; // tape-num
const INK_OCT_LBL = '#5ecabb'; // octave-label
const INK_HEEL_LBL = '#a99fc4'; // heel-label
const INK_POS_LBL = '#b9a7e8'; // pos-label
const INK_TAPE_FG = '#f0e2c4'; // tape-pill-fg
const INK_LAND_FG = '#bfeae3'; // land-pill-fg

// color-alpha fills (base primitive @ opacity → resolved rgba, §0). Composited
// over their backing surface before measuring.
const IN_SCALE_FILL = { r: 0, g: 212, b: 164, a: 0.13 }; // {mint-500} @ 13%
const PILL_ACTIVE_WASH = { r: 0, g: 212, b: 164, a: 0.12 }; // {mint-500} @ 12%
const TAPE_PILL_WASH = { r: 202, g: 164, b: 95, a: 0.14 }; // {amber-400} @ 14%
const LAND_PILL_WASH = { r: 42, g: 157, b: 143, a: 0.16 }; // {teal-500} @ 16%

interface Rgb {
  r: number;
  g: number;
  b: number;
}
interface Rgba extends Rgb {
  a: number;
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Source-over composite of a translucent fill onto an OPAQUE backing surface. */
function compositeOver(fill: Rgba, backingHex: string): Rgb {
  const bg = hexToRgb(backingHex);
  const blend = (f: number, b: number): number => Math.round(f * fill.a + b * (1 - fill.a));
  return { r: blend(fill.r, bg.r), g: blend(fill.g, bg.g), b: blend(fill.b, bg.b) };
}

/** sRGB 8-bit channel → linear-light (WCAG 2.x). */
function channelToLinear(value8bit: number): number {
  const c = value8bit / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance. */
function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** WCAG contrast ratio between two opaque colors. */
function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function ratioHex(fgHex: string, bgHex: string): number {
  return contrastRatio(hexToRgb(fgHex), hexToRgb(bgHex));
}

/** Round to the hundredth — §2.5 ratios are stated to two decimals. */
function toHundredth(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Pair {
  /** §2.5 row label */
  name: string;
  /** computed ratio to the hundredth */
  ratio: number;
  /** published §2.5 value */
  expected: number;
  /** WCAG normal-text floor (4.5) unless this pair is a documented exemption */
  exemption?: 'placeholder-only' | 'disabled-only';
}

// Composited fills resolve to the exact hex §2.5 documents in parentheses; that
// resolution is asserted separately below so a drift in either the alpha or the
// backing surface is caught, not just the final ratio.
const inScaleOnPanel = compositeOver(IN_SCALE_FILL, GRAY_930); // → #112d29
const pillActiveOnSurface = compositeOver(PILL_ACTIVE_WASH, GRAY_925); // → #132d29
const tapePillOnSurface = compositeOver(TAPE_PILL_WASH, GRAY_925); // → #2f2a22
const landPillOnSurface = compositeOver(LAND_PILL_WASH, GRAY_925); // → #192c2b

const pairs: Pair[] = [
  { name: '{canvas} / {text}', ratio: toHundredth(ratioHex(GRAY_100, GRAY_950)), expected: 16.91 },
  { name: '{canvas} / {text2}', ratio: toHundredth(ratioHex(GRAY_300, GRAY_950)), expected: 7.09 },
  { name: '{surface} / {text}', ratio: toHundredth(ratioHex(GRAY_100, GRAY_925)), expected: 15.44 },
  { name: '{surface} / {text2}', ratio: toHundredth(ratioHex(GRAY_300, GRAY_925)), expected: 6.47 },
  {
    name: '{surface} / {text3}',
    ratio: toHundredth(ratioHex(GRAY_500, GRAY_925)),
    expected: 3.37,
    exemption: 'placeholder-only',
  },
  {
    name: '{sidebar} / {text2} (nav item)',
    ratio: toHundredth(ratioHex(GRAY_300, GRAY_945)),
    expected: 7.0,
  },
  {
    name: '{sidebar} / {muted} (.ni.soon)',
    ratio: toHundredth(ratioHex(GRAY_600, GRAY_945)),
    expected: 2.23,
    exemption: 'disabled-only',
  },
  {
    name: '{raised} / {text} (active nav item)',
    ratio: toHundredth(ratioHex(GRAY_100, GRAY_915)),
    expected: 14.52,
  },
  {
    name: '{panel} / scale-label (#ffffff)',
    ratio: toHundredth(ratioHex(INK_SCALE_LBL, GRAY_930)),
    expected: 18.39,
  },
  {
    name: '{panel} / pos-label (#b9a7e8)',
    ratio: toHundredth(ratioHex(INK_POS_LBL, GRAY_930)),
    expected: 8.54,
  },
  {
    name: 'in-scale-fill on {panel} (#112d29) / scale-label',
    ratio: toHundredth(contrastRatio(hexToRgb(INK_SCALE_LBL), inScaleOnPanel)),
    expected: 14.67,
  },
  {
    name: '{mint} (solid root dot) / root-label (#08130f)',
    ratio: toHundredth(ratioHex(INK_ROOT_LBL, MINT_500)),
    expected: 9.86,
  },
  {
    name: '{panel} / string-name (#cfcfd4)',
    ratio: toHundredth(ratioHex(INK_STRNAME, GRAY_930)),
    expected: 11.84,
  },
  {
    name: '{panel} / tape-num (#d6b878)',
    ratio: toHundredth(ratioHex(INK_TAPE_NUM, GRAY_930)),
    expected: 9.62,
  },
  {
    name: '{panel} / octave-label (#5ecabb)',
    ratio: toHundredth(ratioHex(INK_OCT_LBL, GRAY_930)),
    expected: 9.32,
  },
  {
    name: '{panel} / heel-label (#a99fc4)',
    ratio: toHundredth(ratioHex(INK_HEEL_LBL, GRAY_930)),
    expected: 7.39,
  },
  {
    name: 'pill-active-wash on {surface} (#132d29) / {text}',
    ratio: toHundredth(contrastRatio(hexToRgb(GRAY_100), pillActiveOnSurface)),
    expected: 12.5,
  },
  {
    name: 'tape-pill-wash on {surface} (#2f2a22) / tape-pill-fg (#f0e2c4)',
    ratio: toHundredth(contrastRatio(hexToRgb(INK_TAPE_FG), tapePillOnSurface)),
    expected: 11.1,
  },
  {
    name: 'land-pill-wash on {surface} (#192c2b) / land-pill-fg (#bfeae3)',
    ratio: toHundredth(contrastRatio(hexToRgb(INK_LAND_FG), landPillOnSurface)),
    expected: 11.2,
  },
];

const WCAG_NORMAL_TEXT_FLOOR = 4.5;

describe('DESIGN.md §2.5 contrast pairs (computed)', () => {
  it('composites translucent fills to the exact backing-surface hex §2.5 documents', () => {
    expect(rgbToHex(inScaleOnPanel)).toBe('#112d29');
    expect(rgbToHex(pillActiveOnSurface)).toBe('#132d29');
    expect(rgbToHex(tapePillOnSurface)).toBe('#2f2a22');
    expect(rgbToHex(landPillOnSurface)).toBe('#192c2b');
  });

  it.each(pairs)('$name matches §2.5 to the hundredth ($expected:1)', ({ ratio, expected }) => {
    expect(ratio).toBe(expected);
  });

  it.each(pairs.filter((p) => p.exemption === undefined))(
    '$name clears the WCAG normal-text floor (4.5:1)',
    ({ ratio }) => {
      expect(ratio).toBeGreaterThanOrEqual(WCAG_NORMAL_TEXT_FLOOR);
    },
  );

  it('treats {text3} on {surface} (3.37:1) as the allowed placeholder-only exemption', () => {
    const text3OnSurface = pairs.find((p) => p.name === '{surface} / {text3}');
    expect(text3OnSurface?.exemption).toBe('placeholder-only');
    // Below the 4.5 floor, but sanctioned: placeholder / section-header / meta
    // only, never body copy that must be read to operate the tool (§2.3, §2.5).
    expect(text3OnSurface?.ratio).toBeLessThan(WCAG_NORMAL_TEXT_FLOOR);
    expect(text3OnSurface?.ratio).toBe(3.37);
  });

  it('treats {sidebar}/{muted} (2.23:1) as the documented disabled-only exemption', () => {
    const mutedOnSidebar = pairs.find((p) => p.name === '{sidebar} / {muted} (.ni.soon)');
    expect(mutedOnSidebar?.exemption).toBe('disabled-only');
    // WCAG 1.4.3 exempts disabled UI components; the "soon" nav items are never
    // enabled, so this pairing is intentional, not a failure (§2.5).
    expect(mutedOnSidebar?.ratio).toBeLessThan(WCAG_NORMAL_TEXT_FLOOR);
    expect(mutedOnSidebar?.ratio).toBe(2.23);
  });

  it('asserts every §2.5 row (none silently dropped)', () => {
    // 19 rows in the §2.5 table; guard against a row being deleted from `pairs`.
    expect(pairs).toHaveLength(19);
  });

  it('keeps the two P0 root/in-scale label invariants at AAA (§11.2)', () => {
    const inScale = pairs.find((p) => p.name.startsWith('in-scale-fill on {panel}'));
    const rootDot = pairs.find((p) => p.name.startsWith('{mint} (solid root dot)'));
    // §11.2: the in-scale dot fill must stay dark enough; root-label is fixed.
    expect(inScale?.ratio).toBeGreaterThanOrEqual(7); // AAA normal text
    expect(rootDot?.ratio).toBeGreaterThanOrEqual(7);
  });
});
