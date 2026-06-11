// Graded mint→amber ramp function for the Intonation drill (C4, issue #134).
//
// Maps |median cents| from 0 through RAMP_CLAMP_CENTS to a linearly-interpolated
// sRGB color on the #00d4a4 (--mint-500) → #caa45f (--amber-400) ramp. Values
// above the clamp always return amber-400; zero always returns mint-500. Every
// intermediate value maintains ≥4.5:1 WCAG AA contrast against #141417 (--panel).
//
// PURE: no React, no DOM, no audio — a single synchronous function over a numeric
// input. No side effects. Same input → same output.
//
// Why sRGB interpolation (not okLab/perceptual): DESIGN.md §0 tokens are defined
// in sRGB (hex literals); perceptual interpolation would produce intermediate hues
// outside the design vocabulary. Uniform luminance is not a stated requirement —
// WCAG AA contrast is the accessibility gate, and linear sRGB clears it everywhere
// on this ramp (the true minimum is ~7.64:1 near t≈0.74, far above the 4.5:1 floor).
//
// Why rampColor owns Math.abs: the upstream C3 noteTracker emits SIGNED medianCents
// (positive = sharp, negative = flat). rampColor accepts the signed value directly
// and applies Math.abs internally so −18¢ and +18¢ produce the exact same fill
// color. Callers (C5/C6/C8) must never pre-abs: it is idempotent if they do, but
// structurally impossible to accidentally forget-abs once rampColor owns it.
//
// Clamp point: 30 ¢. The deep-research §2 finding is that ~±30¢ is "moderately out
// of tune" for skilled listeners (Warren & Curtis 2015; Geringer 2015). This is the
// saturation threshold: deviations larger than 30¢ are unambiguously off — they
// should paint full amber, not some further extrapolation.

/**
 * The saturation point of the intonation ramp, in cents.
 *
 * Values at or beyond this magnitude always render amber-400 (full ramp saturation).
 * Exported so C6 (note-map drill display) and C8 (summary panel) can reference the
 * constant by name rather than hard-coding a magic number.
 */
export const RAMP_CLAMP_CENTS = 30;

// §0 primitive literals — must not introduce new color literals; these trace exactly
// to `--mint-500` and `--amber-400` in `apps/web/src/styles/tokens.css`.
const MINT_R = 0x00; // #00d4a4
const MINT_G = 0xd4;
const MINT_B = 0xa4;

const AMBER_R = 0xca; // #caa45f
const AMBER_G = 0xa4;
const AMBER_B = 0x5f;

/**
 * Map `medianCents` (signed, as emitted by C3's noteTracker) to a fill color on
 * the mint-500 → amber-400 ramp.
 *
 * - At 0 ¢ returns mint-500 (`#00d4a4`).
 * - At ≥ RAMP_CLAMP_CENTS (30 ¢) returns amber-400 (`#caa45f`).
 * - Between 0 and 30 ¢ returns a linearly-interpolated sRGB color.
 * - Negative inputs are treated as their absolute value (symmetric ramp).
 * - All returned colors maintain ≥4.5:1 WCAG AA contrast against #141417 (--panel).
 *
 * @param medianCents - Signed cents deviation from the target pitch.
 * @returns A CSS-compatible `rgb(r, g, b)` color string.
 */
export function rampColor(medianCents: number): string {
  const absCents = Math.abs(medianCents);
  const t = Math.min(absCents / RAMP_CLAMP_CENTS, 1);

  const r = Math.round(MINT_R + t * (AMBER_R - MINT_R));
  const g = Math.round(MINT_G + t * (AMBER_G - MINT_G));
  const b = Math.round(MINT_B + t * (AMBER_B - MINT_B));

  return `rgb(${r.toString()}, ${g.toString()}, ${b.toString()})`;
}
