/**
 * tokens.ts — type-safe names for the design tokens declared in tokens.css /
 * typography.css.
 *
 * This is a THIN NAME MAP, not a re-declaration of values: the CSS files
 * (tokens.css, typography.css) are the single source of every token VALUE
 * (DESIGN.md §0 is the source of truth above them). This module exists so a
 * consumer that references a token by name gets a COMPILE-TIME error if the name
 * is not declared — `cssVar('--no-such-token')` does not type-check.
 *
 * Keeping the names here (rather than reading them off the stylesheet) means a
 * typo'd `var(--…)` is caught by `tsc`, not discovered as a silently-unresolved
 * custom property at runtime. When a token is added to / removed from the CSS,
 * update the matching tuple below in the same change.
 */

/** TIER-1 color primitives — the only place a hex is written in CSS (§0). */
export const colorPrimitiveTokens = [
  '--gray-950',
  '--gray-945',
  '--gray-935',
  '--gray-930',
  '--gray-925',
  '--gray-915',
  '--gray-900',
  '--gray-880',
  '--gray-870',
  '--gray-820',
  '--gray-600',
  '--gray-500',
  '--gray-300',
  '--gray-100',
  '--mint-500',
  '--mint-600',
  '--amber-400',
  '--teal-500',
  '--violet-500',
  '--red-500',
  '--ink-string',
  '--ink-guide',
  '--ink-off-fill',
  '--ink-off-edge',
  '--ink-root-lbl',
  '--ink-scale-lbl',
  '--ink-strname',
  '--ink-tape-num',
  '--ink-heel-dash',
  '--ink-heel-lbl',
  '--ink-oct-lbl',
  '--ink-pos-lbl',
  '--ink-tape-fg',
  '--ink-land-fg',
  '--ink-pal-soon',
] as const;

/** TIER-2 semantic color tokens (§0). */
export const colorSemanticTokens = [
  '--canvas',
  '--sidebar',
  '--surface',
  '--raised',
  '--panel',
  '--panel-bd',
  '--panelcard-bg',
  '--hairline',
  '--hairline2',
  '--hairline3',
  '--nav-hover-bg',
  '--text',
  '--text2',
  '--text3',
  '--muted',
  '--mint',
  '--mint-deep',
  '--tape',
  '--teal',
  '--violet',
  '--success',
  '--danger',
] as const;

/** color-alpha translucents — resolved rgba() literals (§0). */
export const colorAlphaTokens = [
  '--in-scale-fill',
  '--in-scale-swatch',
  '--pill-active-wash',
  '--root-glow',
  '--root-glow-snappy',
  '--tape-pill-wash',
  '--tape-swatch',
  '--tape-band',
  '--land-pill-wash',
  '--octave-band',
  '--heel-band',
  '--overlay-scrim',
] as const;

/** TIER-3 component color tokens (§0). */
export const colorComponentTokens = [
  '--fingerboard-plate',
  '--open-label',
  '--string-line',
  '--guide-line',
  '--off-fill',
  '--off-stroke',
  '--root-label',
  '--scale-label',
  '--string-name',
  '--tape-num',
  '--heel-dash',
  '--heel-label',
  '--octave-label',
  '--pos-label',
  '--tape-pill-fg',
  '--land-pill-fg',
  '--palette-soon',
] as const;

/** Spacing scale — 4px base (§0; flat). */
export const spaceTokens = [
  '--space-100',
  '--space-200',
  '--space-300',
  '--space-400',
  '--space-500',
  '--space-600',
  '--space-800',
  '--space-1000',
  '--space-1200',
  '--space-1600',
] as const;

/** Radius scale (§0; flat). */
export const radiusTokens = [
  '--radius-chip',
  '--radius-kbd',
  '--radius-nav',
  '--radius-control',
  '--radius-plate',
  '--radius-card',
  '--radius-frame',
  '--radius-pill',
] as const;

/** Elevation scale (§0; flat). */
export const elevationTokens = [
  '--elevation-resting',
  '--elevation-raised',
  '--elevation-overlay',
  '--elevation-modal',
] as const;

/** Motion durations (§0 motion). */
export const motionDurationTokens = [
  '--press',
  '--color-shift',
  '--color-shift-snappy',
  '--label-fade',
  '--lbl-fill',
  '--pop',
  '--overlay-out',
  '--glow-fade',
  '--state-color',
  '--palette-in',
  '--palette-out',
  '--modal-out',
  '--modal-in',
  '--dot-radius',
  '--tape-slide',
] as const;

/** Motion easings (§0 motion). */
export const motionEasingTokens = [
  '--ease-standard',
  '--ease-spring',
  '--ease-spring-2',
  '--ease-overshoot',
  '--ease-modal-in',
  '--ease-modal-out',
] as const;

/** Motion stagger constants (§0 motion). */
export const motionStaggerTokens = [
  '--stagger-per-column-stateful',
  '--stagger-per-column-snappy',
] as const;

/** Layout measurements (§0; flat). */
export const layoutTokens = [
  '--sidebar-w',
  '--content-max-w',
  '--topbar-h',
  '--nav-item-h',
  '--search-h',
  '--pill-h',
  '--palette-w',
  '--palette-row-h',
  '--board-viewbox',
  '--board-min-width',
  '--shell-min-width',
  '--touch-target-min',
] as const;

/** Typography tokens declared in typography.css (§0 type / §3). */
export const typographyTokens = [
  '--family-ui',
  '--family-mono',
  '--lh-tight',
  '--lh-normal',
  '--lh-flush',
  '--features-mono',
  '--features-ui',
] as const;

/** Every declared token name, one flat tuple. */
export const allTokens = [
  ...colorPrimitiveTokens,
  ...colorSemanticTokens,
  ...colorAlphaTokens,
  ...colorComponentTokens,
  ...spaceTokens,
  ...radiusTokens,
  ...elevationTokens,
  ...motionDurationTokens,
  ...motionEasingTokens,
  ...motionStaggerTokens,
  ...layoutTokens,
  ...typographyTokens,
] as const;

/** A CSS custom-property name that is actually declared by the token surface. */
export type TokenName = (typeof allTokens)[number];

/** Color-tier token-name unions, for consumers that want to constrain by tier. */
export type ColorPrimitiveToken = (typeof colorPrimitiveTokens)[number];
export type ColorSemanticToken = (typeof colorSemanticTokens)[number];
export type ColorAlphaToken = (typeof colorAlphaTokens)[number];
export type ColorComponentToken = (typeof colorComponentTokens)[number];
export type MotionDurationToken = (typeof motionDurationTokens)[number];
export type MotionEasingToken = (typeof motionEasingTokens)[number];

/**
 * Build a `var(--token)` reference for a DECLARED token name. Referencing an
 * undeclared name is a compile-time error — that is the whole point of this
 * module. The value still resolves from the CSS at runtime; this only types the
 * name. An optional fallback is appended as the CSS `var()` second argument.
 */
export function cssVar(name: TokenName, fallback?: string): string {
  return fallback === undefined ? `var(${name})` : `var(${name}, ${fallback})`;
}
