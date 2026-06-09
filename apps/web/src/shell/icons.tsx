// The two drawn glyphs in the product (DESIGN.md §0 `icon.svg`). Transcribed
// verbatim from the spec so they reproduce exactly rather than by description.
// Both stroke with `currentColor` so they inherit the consuming element's text
// token — which is why the active Scales mark turns {mint} along with its label.
// The three "soon" tools and the palette glyphs are Unicode characters, not SVG
// (DESIGN.md §0 `icon.glyph-char`), so they are NOT components here.

/**
 * `ic-scales` — the Scales nav mark: three stacked neck-lines on a 14×10 box
 * (NOT four lines, NO dot), evoking strings on the neck (DESIGN.md §0, §8.2).
 * `aria-hidden` because the nav item carries the accessible name.
 */
export function IcScales() {
  return (
    <svg width="14" height="10" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1.1">
        <line x1="1" y1="2" x2="13" y2="2" />
        <line x1="1" y1="5" x2="13" y2="5" />
        <line x1="1" y1="8" x2="13" y2="8" />
      </g>
    </svg>
  );
}

/**
 * `ic-check` — the copy-success checkmark beside the ghost button (§8.4 / §2.6).
 * A single `<path>` stroked with `currentColor` so the success ✓ inherits the
 * caption's `{text2}` — it is NOT painted `{mint}` (§2.6: success reuses `{mint}`
 * but here the check is `currentColor`, no second solid fill on the topbar). The
 * single path is what the §10 success-check recipe's stroke-draw animates.
 * `aria-hidden` — the spoken outcome is the polite live region, not this glyph.
 */
export function IcCheck() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M2.5 6.5 L5 9 L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * `ic-search` — the magnifier that leads the sidebar search trigger (rendered
 * ~14px, stroked at {text3} via currentColor) (DESIGN.md §0, §8.3). The same
 * glyph leads the palette search row at a larger size; that consumer is a later
 * step. `aria-hidden` — the trigger's own label names the action.
 */
export function IcSearch() {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" />
      <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
