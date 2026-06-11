# DESIGN.md — Violin Tools

> **This file is the whole truth.** An agent that has never opened this app must be able to rebuild any surface to pixel fidelity from this document alone — no design file, no component browser, no follow-up questions. Every value here is concrete and current. Where an earlier draft and the working build disagreed, the build wins; this file reflects the build.
>
> Violin Tools is one product with one deliberate look: a dark, quiet instrument panel. It credits no outside product and borrows no idiom from any other instrument. **The violin's fingerboard is smooth and unmarked — it has no fixed pitch divisions.** This document always names locations as *fingerboard*, *neck*, *position*, and *semitone column*. That is not a style note; it is a correctness rule, because the entire pedagogy of the note map depends on the student understanding the fingerboard has no fixed divisions.

---

## 0. Token Manifest

The authoritative source of truth for every value. The prose below references these tokens by name and never repeats a raw hex.

Tokens are **three-tier**: a **primitive** holds the raw literal; a **semantic** token aliases a primitive and names its job in the system; a **component** token aliases a semantic and names where it is used. Aliases are written `{token}`. To recolor the product, edit one primitive and the change flows down every chain — you never hunt individual call sites. Two deliberate, documented departures from the strict chain (both tagged at their declaration so they are not silent): (a) some semantic tokens alias a primitive directly when no component layer exists for that role (e.g. `canvas`); (b) the 15 single-use note-map SVG component tokens alias an `ink-*` **primitive** directly — `[ink→primitive]` in the manifest — because each has exactly one SVG call site and no system-wide job, so a semantic middle tier would be empty indirection (see TIER 3 note). Everything else follows component → semantic → primitive. Three chains, end to end:

```
# component        → semantic   → primitive  → literal
fingerboard-plate   {panel}       {gray-930}   #141417    (full three-tier chain)
canvas (page)       {gray-950}    —            #0a0a0a    (semantic aliases primitive directly — case a)
scale-label         —             {ink-scale-lbl} #ffffff  (component aliases primitive directly — case b, [ink→primitive])
root-dot fill       {mint}        {mint-500}   #00d4a4
```

```yaml
meta:
  name: Violin Tools
  product: A web app of focused practice tools for violinists.
  v1: Scales — a whole-neck fingerboard note map.
  wordmark: "Violin Tools."   # trailing period is a mint glyph
  mode: dark-native           # the only mode; not a dark variant of a light theme

# ─────────────────────────────────────────────────────────────────────────
# TIER 1 — PRIMITIVES. Raw literals. The only place a hex is written.
# ─────────────────────────────────────────────────────────────────────────
primitive:
  # Near-black grey ramp. INVARIANT: the numeric suffix tracks WCAG relative
  # luminance MONOTONICALLY — a HIGHER suffix is DARKER (lower luminance), a
  # LOWER suffix is lighter. So gray-950 (L≈0.0030) is the darkest surface and
  # gray-100 (L≈0.847) the lightest text; reading suffixes top-to-bottom walks
  # luminance strictly upward. Every entry below is in ascending-luminance order
  # and its trailing comment gives the measured L. Never insert a value whose
  # suffix would break this ordering.
  gray-950: "#0a0a0a"   # L≈0.0030 — darkest (page canvas)
  gray-945: "#0c0c0d"   # L≈0.0037
  gray-935: "#0f0f11"   # L≈0.0048
  gray-930: "#141417"   # L≈0.0071 — note-map plate (formerly gray-940; absorbs the 1-bit-identical gray-905, see note)
  gray-925: "#161618"   # L≈0.0081
  gray-915: "#1c1c1f"   # L≈0.0118
  # line greys
  gray-900: "#1f1f1f"   # L≈0.0137
  gray-880: "#26262b"   # L≈0.0197
  gray-870: "#28282c"   # L≈0.0215
  gray-820: "#3a3a40"   # L≈0.0430
  # text greys
  gray-600: "#4a4a52"   # L≈0.0696
  gray-500: "#6a6a72"   # L≈0.1459
  gray-300: "#9a9aa2"   # L≈0.3259
  gray-100: "#ededed"   # L≈0.8469 — lightest (primary text)
  # accents
  mint-500:  "#00d4a4"
  mint-600:  "#00b48a"
  amber-400: "#caa45f"
  teal-500:  "#2A9D8F"
  violet-500: "#7C5CBF"
  # status — NONE of these are emitted by either build. They exist ONLY so a
  # future status surface (form validation, an intonation read-out) has a
  # sanctioned literal instead of an invented one. See §2.6. red-500 is the
  # single reserved error candidate; it is deliberately desaturated so it never
  # reads as a second brand accent next to mint.
  red-500:   "#e5644e"  # RESERVED error candidate — not applied anywhere in v1
  # note-map literals (live only in the SVG; primitives so they still alias)
  ink-string:    "#3a3a3f"  # string lines + nut rect
  ink-guide:     "#1d1d22"  # vertical position guides
  ink-off-fill:  "#17171c"  # off-state dot fill
  ink-off-edge:  "#2a2a30"  # off-state dot stroke
  ink-root-lbl:  "#08130f"  # text inside root dot (INVARIANT)
  ink-scale-lbl: "#ffffff"  # text on in-scale dot
  ink-strname:   "#cfcfd4"  # string-name labels + palette row text
  ink-tape-num:  "#d6b878"  # tape number label
  ink-heel-dash: "#8a83a6"  # heel underline
  ink-heel-lbl:  "#a99fc4"  # "heel ⌄"
  ink-oct-lbl:   "#5ecabb"  # "octave ◈" + "½ string"
  ink-pos-lbl:   "#b9a7e8"  # "3rd/4th/5th/7th pos"
  ink-tape-fg:   "#f0e2c4"  # active tape pill text
  ink-land-fg:   "#bfeae3"  # active landmark pill text
  ink-pal-soon:  "#55555d"  # palette "soon" meta

# ─────────────────────────────────────────────────────────────────────────
# TIER 2 — SEMANTIC. Each names a job and aliases ONE primitive.
# ─────────────────────────────────────────────────────────────────────────
color:
  canvas:        "{gray-950}"   # page body
  sidebar:       "{gray-945}"   # left rail
  surface:       "{gray-925}"   # raised card / palette body
  raised:        "{gray-915}"   # active/hover-selected interactive surface
  panel:         "{gray-930}"   # inner note-map plate
  panel-bd:      "{gray-880}"   # note-map plate border
  panelcard-bg:  "{gray-935}"   # frame wrapping the plate
  hairline:      "{gray-900}"   # primary dividers
  hairline2:     "{gray-870}"   # secondary / resting-interactive borders
  hairline3:     "{gray-820}"   # hover border on pills + search; breadcrumb "/"
  nav-hover-bg:  "{gray-930}"   # nav item hover fill (was gray-905 #141416 — 1 blue-bit off gray-930 #141417; merged)
  text:          "{gray-100}"   # primary
  text2:         "{gray-300}"   # secondary
  text3:         "{gray-500}"   # tertiary / placeholder
  muted:         "{gray-600}"   # disabled-only
  mint:          "{mint-500}"   # BRAND + "in scale / where sound lives"
  mint-deep:     "{mint-600}"   # reserved deeper mint — see note below
  tape:          "{amber-400}"  # functional: beginner TAPE overlay only
  teal:          "{teal-500}"   # functional: OCTAVE landmark only
  violet:        "{violet-500}" # functional: POSITION/HEEL landmark only
  # status roles — see §2.6. success has NO own token (it reuses {mint});
  # error is reserved and unused in v1; warning/info are out of scope (no token).
  success:       "{mint}"       # in-tune / success === the acoustic anchor; NO separate token
  danger:        "{red-500}"    # RESERVED error role — unbound in v1 (do not apply yet)

color-alpha:                    # semantic translucents, inline as rgba() in the build.
                                # Each is its base PRIMITIVE at an opacity — written
                                # "{primitive} @ N%" so a re-theme of the base hue flows
                                # here too; the resolved rgba() literal the build emits is
                                # in the trailing comment (it is derived, never hand-keyed).
  in-scale-fill:    "{mint-500} @ 13%"      # rgba(0,212,164,.13)   in-scale dot fill
  in-scale-swatch:  "{mint-500} @ 14%"      # rgba(0,212,164,.14)   legend swatch
  pill-active-wash: "{mint-500} @ 12%"      # rgba(0,212,164,.12)   active default pill bg
  root-glow:        "{mint-500} @ 28%"      # rgba(0,212,164,.28)   root ring — value the STATEFUL build writes
  root-glow-snappy: "{mint-500} @ 25%"      # rgba(0,212,164,.25)   root ring — value the SNAPPY build writes in its :root (overrides root-glow)
  tape-pill-wash:   "{amber-400} @ 14%"     # rgba(202,164,95,.14)  active tape pill bg
  tape-swatch:      "{amber-400} @ 30%"     # rgba(202,164,95,.30)  legend swatch
  tape-band:        "{amber-400} @ 16%"     # rgba(202,164,95,.16)  tape band in note map
  land-pill-wash:   "{teal-500} @ 16%"      # rgba(42,157,143,.16)  active landmark pill bg
  octave-band:      "{teal-500} @ 34%"      # rgba(42,157,143,.34)  teal octave band
  heel-band:        "{violet-500} @ 30%"    # rgba(124,92,191,.30)  violet heel band
  overlay-scrim:    "black @ 55%"           # rgba(0,0,0,.55)       palette backdrop (blur 2px) — pure black, the one non-brand-hue translucent

# ─────────────────────────────────────────────────────────────────────────
# TIER 3 — COMPONENT. Names WHERE a color is used.
# INVARIANT: a component token aliases a SEMANTIC (or color-alpha) token —
# EXCEPT the single-use note-map SVG literals, which alias an `ink-*` PRIMITIVE
# directly BY DESIGN (tagged `[ink→primitive]` below). Those ink colors are
# consumed by exactly one <text>/<line>/<circle> in the SVG and carry no
# system-wide "job," so minting a semantic alias for each would be 15 tokens of
# pure indirection with one caller apiece; the primitive is the honest tier. The
# remaining component tokens (untagged) DO alias a semantic, so recoloring "the
# note-map plate" edits the chain, not a literal. (Re-theming an ink color is a
# one-line primitive edit; see §14.)
component-color:
  # ── alias a SEMANTIC token ──
  fingerboard-plate: "{panel}"        # the SVG plate ( → gray-930 → #141417 )
  open-label:        "{text3}"        # "open" label ( = gray-500 )
  # ── [ink→primitive] single-use SVG literals: alias an `ink-*` PRIMITIVE directly ──
  string-line:       "{ink-string}"   # [ink→primitive] 4 string lines + nut rect
  guide-line:        "{ink-guide}"    # [ink→primitive] vertical position guides
  off-fill:          "{ink-off-fill}" # [ink→primitive] off-state dot
  off-stroke:        "{ink-off-edge}" # [ink→primitive] off-state dot ring
  root-label:        "{ink-root-lbl}" # [ink→primitive] text inside root dot (never overridden)
  scale-label:       "{ink-scale-lbl}"# [ink→primitive] text on in-scale dot
  string-name:       "{ink-strname}"  # [ink→primitive] string labels + palette row text
  tape-num:          "{ink-tape-num}" # [ink→primitive]
  heel-dash:         "{ink-heel-dash}"# [ink→primitive]
  heel-label:        "{ink-heel-lbl}" # [ink→primitive]
  octave-label:      "{ink-oct-lbl}"  # [ink→primitive]
  pos-label:         "{ink-pos-lbl}"  # [ink→primitive]
  tape-pill-fg:      "{ink-tape-fg}"  # [ink→primitive]
  land-pill-fg:      "{ink-land-fg}"  # [ink→primitive]
  palette-soon:      "{ink-pal-soon}" # [ink→primitive]

type:
  family-ui:   "'Inter', -apple-system, sans-serif"          # all human language
  family-mono: "'Geist Mono','SF Mono',Menlo,monospace"      # all music/technical notation
  weights-ui:        [400, 500, 600, 700]
  weights-ui-italic: [400]    # Inter Italic 400 — a REAL loaded face, not synthesis.
                              # Only consumer: the SVG "heel ⌄" label (§3, §12.3),
                              # which sets font-style:italic. The roman cuts have no
                              # italic, so without this face the browser would
                              # synthesize an oblique slant; load the true italic instead.
  weights-mono: [400, 500, 600]
  smoothing: antialiased
  # line-heights (named; mirrored per-role in the §3 table)
  lh-tight:  1.1     # large display — Page H1 (scale name)
  lh-normal: 1.5     # body copy / legend / caveat / palette text (the document default)
  lh-flush:  1       # single-line chrome set by fixed height — nav/pill/search/kbd/labels
  body-line-height: "{lh-normal}"   # = 1.5, on <body>
  # font-feature-settings — tabular figures are LOAD-BEARING for column alignment.
  # Note names, finger/tape numbers, and position labels must NOT use proportional
  # figures or they drift inside the fixed-diameter dots and off the column grid.
  features-mono: "'tnum', 'lnum'"   # Geist Mono numeric roles: tape/octave numbers, formula, position labels in mono roles
  features-ui:   "'tnum'"           # Inter numeric roles: in-scale/root dot note names, position labels
  # Scale is intentionally NON-MODULAR: there is no ratio. Sizes are fixed to
  # the §3 table and chosen per role; do NOT interpolate a new size between them.
  base-ui: "14px"   # nav/pill/search baseline; the most common UI size

space:                       # 4px base. Multiplier = value / 4 → the name reconstructs the value.
  space-100: "4px"           # 1×
  space-200: "8px"           # 2×
  space-300: "12px"          # 3×
  space-400: "16px"          # 4×
  space-500: "20px"          # 5×
  space-600: "24px"          # 6×
  space-800: "32px"          # 8×
  space-1000: "40px"         # 10×
  space-1200: "48px"         # 12×
  space-1600: "64px"         # 16×
  bands:                     # which steps do which work (see §4)
    micro:     [space-100]                          # icon gaps, swatch→label, inter-pill
    component: [space-200, space-300, space-400]    # internal padding, row gaps, card padding
    layout:    [space-500, space-600, space-800]    # topbar padding, content gutters, section gaps
    page:      [space-1200, space-1600]             # content-column bottom padding / breathing room

radius:
  chip:      "3px"    # legend swatches; palette kbd; tape/heel band rx
  kbd:       "4px"    # kbd, esc, "soon" badge
  nav:       "6px"    # nav items; theme toggle
  control:   "8px"    # search bar; palette rows
  plate:     "10px"   # note-map inner plate
  card:      "12px"   # controls card
  frame:     "14px"   # panelcard frame; command palette
  pill:      "9999px" # pills; ghost button; note-map dots (circles)

elevation:                   # see §5 — depth is surface-tint + hairline FIRST
  resting:  "none"
  raised:   "none"                          # surface step + hairline only
  overlay:  "none"                          # scrim carries the float for the scrim itself
  modal:    "0 24px 64px rgba(0,0,0,.6)"    # the ONLY heavy shadow in the product

motion:
  # durations (ms)
  press:        90
  color-shift:  140       # 120 in snappy build. Used by: pill border-color/background/color
                          #   (stateful adds color; snappy omits it) and search border-color/background.
                          #   NOT the dot fill transition — that is state-color (200).
  label-fade:   160       # Used by: .note .lbl opacity transition (§7.1).
  lbl-fill:     190       # Used by: .note .lbl fill transition (§7.1).
  pop:          150
  overlay-out:  180       # scrim opacity — applies BOTH directions (base rule)
  glow-fade:    200       # .note .glow opacity
  state-color:  200       # dot fill/stroke/stroke-width; .land opacity
  palette-in:   200       # palette OPACITY on open
  palette-out:  150       # palette OPACITY on close
  modal-out:    160       # palette TRANSFORM on close
  modal-in:     250       # palette TRANSFORM on open
  dot-radius:   230
  tape-slide:   230
  # easings — each carries a "never use for" guard
  ease-standard:  "ease"                            # the default; safe anywhere
  ease-spring:    "cubic-bezier(.34,1.45,.64,1)"    # dot RADIUS morph only — never a button press or panel enter
  ease-spring-2:  "cubic-bezier(.34,1.4,.64,1)"     # tape SLIDE only — never chrome
  ease-overshoot: "cubic-bezier(.34,1.56,.64,1)"    # snappy dot-POP only — never overlay or nav
  ease-modal-in:  "cubic-bezier(.22,1,.36,1)"       # palette OPEN only
  ease-modal-out: "cubic-bezier(.4,0,.2,1)"         # palette CLOSE only
  stagger-per-column-stateful: "6ms"
  stagger-per-column-snappy:   "10ms"

layout:
  sidebar-w:        "248px"
  content-max-w:    "880px"
  topbar-h:         "52px"
  nav-item-h:       "32px"
  search-h:         "36px"
  pill-h:           "30px"
  palette-w:        "560px"
  palette-row-h:    "40px"
  board-viewbox:    "0 0 760 264"   # the HORIZONTAL/desktop default; the vertical (mobile auto) viewBox lives in §12.1
  board-min-width:  "760px"   # HORIZONTAL/desktop floor only; the vertical map sets .board min-width:0 (shell.css) so it fits a phone (§10/§12.1)
  shell-min-width:  "760px"   # the §10 mobile-reflow breakpoint: below this the sidebar is hidden (its drawer was dropped in S16 ph3) + the page reflows to one column with a controls bottom sheet; on desktop/horizontal the plate scrolls the 760px SVG inside itself, on a portrait phone the map renders vertical and fits the plate width — no 760px scroll (§10/§12.1)
  touch-target-min: "44px"    # WCAG 2.5.5 floor for any pointer target
  sheet-peek-h:     "52px"    # mobile (§10) bottom-sheet PEEK band height — the slice
                              # left on screen at translateY(calc(100% - sheet-peek-h)).
                              # Derived on the 4px scale (not a bare magic number):
                              # touch-target-min (44px, the summary-row tap height) +
                              # space-200 (8px, a §4 component gutter for the drag
                              # handle to breathe above it) = 52px (13× the 4px base).

icon:
  # The product ships NO third-party icon library and NO <symbol>/<use> sprite.
  # Iconography is exactly TWO kinds, and the build mixes them deliberately:
  #   (A) two hand-authored inline <svg> line glyphs (search + the Scales
  #       nav mark), stroked (not filled) with currentColor so each inherits
  #       its element's text token — which is why the active Scales icon turns
  #       mint with the .ni.active row while resting/palette icons sit at the
  #       row's grey; and
  #   (B) single Unicode glyph CHARACTERS for every other slot (the three
  #       "soon" tools, the palette scale/tool/open markers), set as plain
  #       text inside a fixed-width icon <span> so they inherit color the same
  #       way. These are NOT drawn paths — do not redraw them as custom SVG.
  # The full <svg> source for the three real glyphs is given verbatim below so an
  # agent reproduces them exactly rather than interpreting a description.
  set: inline-svg-trio + unicode-glyphs   # NOT a sprite, NOT a vendor set
  svg:                                     # the three drawn glyphs in the product
    ic-search:    |   # magnifier — sidebar .search trigger AND palette .psearch
      <svg viewBox="0 0 14 14" fill="none">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor"/>
        <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" stroke-width="1.4"/>
      </svg>
      # rendered 14×14 in the sidebar search, 16×16 in palette .psearch; stroke
      # is currentColor (resolves to {text3} / {text2} at the consuming element).
    ic-scales:    |   # the Scales nav mark — three stacked neck-lines (NOT four, NO dot)
      <svg width="14" height="10">
        <g stroke="currentColor" stroke-width="1.1">
          <line x1="1" y1="2" x2="13" y2="2"/>
          <line x1="1" y1="5" x2="13" y2="5"/>
          <line x1="1" y1="8" x2="13" y2="8"/>
        </g>
      </svg>
      # three horizontal rules on a 14×10 box, evoking strings on the neck.
      # currentColor → {text3} at rest, promoted to {mint} by .ni.active .ic.
    ic-menu:      |   # FORWARD-PREP — NOT currently rendered (the S16 ph3 mobile build drops the drawer hamburger; §10)
      <svg width="16" height="12">
        <g stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="1" y1="2" x2="15" y2="2"/>
          <line x1="1" y1="6" x2="15" y2="6"/>
          <line x1="1" y1="10" x2="15" y2="10"/>
        </g>
      </svg>
      # three rounded rules on a 16×12 box. NOTE: this glyph is NOT in the current
      # build — S16 ph3 dropped the off-canvas drawer + its hamburger, so no .topbar-menu
      # trigger is rendered (the mobile top bar carries a SEARCH trigger instead, §10).
      # IcMenu is absent from icons.tsx; the spec is retained here as forward-prep for a
      # possible future hamburger/tab-bar. currentColor → {text2} if it ever ships.
  glyph-char:                # element → the literal Unicode character it renders (kind B)
    nav-intonation: "◴"      # U+25F4 — Intonation tool (live view, C9)
    nav-vibrato:    "∿"      # U+223F — "soon" Vibrato tool (sine-wave glyph)
    nav-tuner:      "◎"      # U+25CE — Tuner tool (live view, S18 ph6)
    palette-scale:  "♪"      # U+266A — a Scales jump-target row (e.g. "A Major")
    palette-scalemap: "▦"    # U+25A6 — the "Scale Map (open)" tool row
    palette-intonation: "◴"  # reuses the nav glyph in the Tools group (open, C9)
    palette-tuner:  "◎"      # reuses the nav glyph in the Tools group
  box:                       # fixed icon-column widths that hold A and B identically
    nav:     "15px"          # .ni .ic span width (§4.2, §8.2)
    palette: "18px"          # .pitem .pico span width (§4.2, §8.5)
```

> **`mint-deep` scope.** `mint-deep` (→ `mint-600` → `#00b48a`) is declared in the **snappy build's `:root` only**; the stateful build's `:root` does not declare it at all, and it is not applied in visible markup in either. Its role is reserved, not yet assigned.
>
> **Build-specific root-glow.** `root-glow` (`.28`) is the value the **stateful** build writes; `root-glow-snappy` (`.25`) is the value the **snappy** build writes in its `:root`, overriding it. Both are real primitives so each build's literal is explicit — emit the one that matches the build you are generating (§7.2).
>
> **Grey-ramp ordering (INVARIANT).** The `gray-*` suffix tracks WCAG relative luminance **monotonically: higher suffix = darker** (`gray-950` darkest surface, `gray-100` lightest text). The primitive list is printed in ascending-luminance order with each measured `L` in-comment; a new grey must be inserted at the suffix its luminance demands, never appended out of order. (An earlier draft mis-described this as "steps up in lightness" and had `gray-940` filed lighter-than-but-numbered-above `gray-935`; both are corrected here.)
>
> **`gray-905` merged.** A former `gray-905` (`#141416`) differed from `gray-930` (`#141417`, formerly `gray-940`) by a single bit in the blue channel (B 22 vs 23) — visually identical and within one channel bit — and was mis-filed under "line greys" while actually used as the `nav-hover-bg` surface fill. It has been **merged into `gray-930`**; `nav-hover-bg` now aliases `gray-930`. There is no `gray-905` and no `gray-940` token anymore.
>
> **Non-token symbols referenced by prose.** Two identifiers the prose cites are **build logic / constants, not color or layout tokens**, so they have no entry in the tiers above: **`spell()`** — the deterministic root-spelling function (flat set when the root name carries a flat or is `F`, else sharp; **scale-family-aware (S15)**, so the pc-1 root flips `Db`/`C♯` between the major and minor families and no key reaches a double accidental; defined in §13 and applied in §9.1); and **`NMAX = 15`** — the per-string column count that fixes the node grid (1 open + 14 stopped columns; operationalized in §12.1). They are named here so a reader does not hunt for them among the tokens.
>
> **Tiers without a component layer (known, not omissions).** `radius`, `space`, `motion`, `elevation`, and `layout` are primitive scales consumed by name directly at call sites — they have **no component tier** by design (a `card`-radius, a `space-400` gap, and a `52px` topbar are used as-is, not aliased per component). `radius` specifically is flagged in §16 Known Gaps so its missing component tier is explicit rather than silently implied by the three-tier framing, which is a *color*-system rule.

---

## 1. Design Philosophy

Read this first. Six principles generate every decision below; when a value here seems arbitrary, one of these is why.

**Key Characteristics (the non-negotiables, at a glance):**

- **Near-black canvas.** `{canvas}` = `#0a0a0a` is the only page-body color; surfaces step up from it, never away from it.
- **One subject.** The fingerboard note map is the single hero; nothing else on the page may compete with it for attention.
- **Single brand accent.** `{mint}` (`#00d4a4`) is the only brand color and the lone solid fill on screen (the root dot). The three functional accents (`{tape}`/`{teal}`/`{violet}`) each carry exactly one reference layer.
- **Hairline over shadow.** Depth is surface-tint + a hairline rule first; the one heavy shadow in the product is the command palette's `elevation.modal`.
- **Dense but quiet.** Information is tight at the core (data rows, the map) and calm at the edges (generous gutters, no chrome noise, no marketing copy).
- **Unmarked fingerboard, always.** Name locations only as "position", "semitone column", "fingerboard", "neck"; the neck has no fixed pitch divisions and nothing in the UI may imply otherwise. A correctness rule, not a style note.

These are the absolutes; the six principles below explain why.

1. **One subject, no rivals.** The fingerboard note map is the product. The wordmark, search, navigation, and controls exist only to configure or read that one panel. The layout makes this literal: a slim controls card sits directly above the note-map plate, and the map holds the visual center of gravity. Nothing on the page competes with it for attention.

2. **Dark is the medium, not a theme.** Surfaces are near-black and step **up** in lightness as they rise toward the user — `{canvas}` → `{panel}` → `{surface}` → `{raised}`. There is no light mode to invert into. Depth is built from surface-tint and hairline rules first, shadow only for a genuine float; the one heavy shadow in the product belongs to the command palette (§5), because a modal really does lift off the page.

3. **Color is meaning, and meaning is redundant.** `{mint}` is the acoustic anchor — it marks where sound lives (scale tones, the root, the active control). The three functional accents each name exactly one reference overlay: `{tape}` = beginner tape, `{teal}` = octave landmark, `{violet}` = position/heel landmark. No color is ever the *only* signal: every distinction it draws is also carried by size, shape, position, or a label (see §11).

4. **Two type systems, partitioned by what the words mean.** Human language is Inter. Music and technical notation — the interval formula, section kickers, keycaps, tape/octave numbers — are Geist Mono, for tabular figures that align the formula into a tidy grid. (The one musical value assigned to *Inter* is the note-name label inside an SVG dot: it must center inside a fixed-diameter circle at Inter's metrics, not Geist Mono's — see §3 and §15.1. That is the sole exception to "music = mono.") A third typeface is never admitted.

5. **Morph, never flash.** Stateful elements persist and tween between states; they are not torn down and rebuilt. A scale change re-classifies the existing note dots and animates their radius, fill, and label in place, sweeping left-to-right up the neck. Motion is snappy and satisfying, never decorative. It is also strictly optional: `prefers-reduced-motion` collapses everything to instant, and the interface stays fully legible.

6. **Encouraging, never salesy.** The product speaks like a good teacher: it states musical facts, names the characteristic interval a student must learn, and never explains what the player already knows. There is no marketing copy anywhere in the interface.

---

## 2. Color

All values resolve through the Token Manifest's three tiers (§0). This section assigns roles and documents the contrast of every load-bearing pairing. The prose references tokens by name; resolve hexes in §0.

### 2.1 Surfaces — stack upward from black

| Token | Role | Sits on | Never use as |
|---|---|---|---|
| `{canvas}` | Page body | — | text color; a card fill stacked on top of itself |
| `{sidebar}` | Left rail | `{canvas}` | a card fill in the main column; text |
| `{surface}` | Controls card; command-palette body | `{canvas}` | the page body; a text color |
| `{raised}` | Active nav item; palette row hover/selected | `{surface}`/`{sidebar}` | a resting (non-active) fill; text |
| `{panelcard-bg}` | Frame wrapping the note-map plate | `{canvas}` | the plate itself; a generic card |
| `{panel}` | Inner note-map (SVG) plate | `{panelcard-bg}` | a chrome surface outside the map; text |

The note map nests two surfaces deep on purpose: `{panelcard-bg}` is a frame (its outer edge a `1px {hairline}`), `{panel}` is the plate inside it, and the plate's own `1px {panel-bd}` border draws the seam between plate and frame. This double-frame — two stacked surfaces, two hairlines — is what makes the map read as a discrete instrument readout rather than a region of the page.

### 2.2 Lines — depth comes from hairlines

`{hairline}` draws every primary divider (rail edge, topbar underline, card borders). `{hairline2}` is one step lighter for interactive chrome that needs to read as touchable at rest (search box, default pills, kbd chips, palette border). `{hairline3}` is the hover border for pills and search. Borders do this product's structural work; reach for a hairline before a shadow, always (see §5).

### 2.3 Text — three steps plus disabled

`{text}` primary · `{text2}` secondary · `{text3}` tertiary/placeholder · `{muted}` disabled-only (the "soon" nav items). Pair these with surfaces exactly as the build does; do not invent intermediate greys.

Per-entry prohibitions: **`{text}`** is never a surface or border fill. **`{text3}`** is never body copy that must be read to operate the tool — it is placeholder/section-header/meta only (it is the one sub-4.5:1 pairing, §2.5). **`{muted}`** is never applied to an enabled, actionable element — it reads as "disabled," so using it on a live control miscommunicates state.

### 2.4 Accent discipline — one anchor, three single-purpose signals

`{mint}` is the only brand color and the acoustic anchor. **The only solid mint fill on screen at any moment is the root dot.** The active-pill wash (`pill-active-wash`) is desaturated enough that it never reads as a second solid anchor — that is deliberate and load-bearing.

The three functional accents are mutually exclusive in meaning and each appears **only** when its reference layer is enabled:

| Token | Means | Appears as |
|---|---|---|
| `{tape}` | Beginner tape guide | tape band, active "Tapes/low 2/3-tape" pill, caveat text, tape legend swatch |
| `{teal}` | Octave landmark | octave band, active "Landmarks" pill, octave labels |
| `{violet}` | Position / heel landmark | heel band, heel labels, landmark-swatch gradient endpoint |

A second solid-mint anchor, or any functional accent used for something other than its one assigned job, is a design-review violation.

### 2.5 Contrast pairs (computed)

Every load-bearing background+foreground combination, with its computed ratio and WCAG level. A new surface must clear the same bar; check a new pairing against this table before shipping it. Large text = ≥18.66px bold or ≥24px (AA 3:1); everything else uses the normal-text bar (AA 4.5:1).

All ratios below are **computed** (WCAG 2.x relative-luminance formula; translucent fills first composited over their backing surface, then measured). They are accurate to the hundredth, not eyeballed; an earlier draft's "measured" column ran 15–30% conservative and is replaced.

| Background | Foreground | Ratio | Level |
|---|---|---|---|
| `{canvas}` | `{text}` | 16.91:1 | ✓ AAA |
| `{canvas}` | `{text2}` | 7.09:1 | ✓ AAA |
| `{surface}` | `{text}` | 15.44:1 | ✓ AAA |
| `{surface}` | `{text2}` | 6.47:1 | ✓ AA |
| `{surface}` | `{text3}` | 3.37:1 | ✓ AA large / placeholder only |
| `{sidebar}` | `{text2}` (nav item) | 7.00:1 | ✓ AAA |
| `{sidebar}` | `{muted}` (`.ni.soon` text + icon) | 2.23:1 | Intentional — disabled-only (WCAG 1.4.3 exempts disabled UI components; "soon" nav items are never enabled) |
| `{raised}` | `{text}` (active nav item) | 14.52:1 | ✓ AAA |
| `{panel}` | `scale-label` (`#ffffff`) | 18.39:1 | ✓ AAA |
| `{panel}` | `pos-label` (`#b9a7e8`) | 8.54:1 | ✓ AAA |
| `in-scale-fill` on `{panel}` (composited `#112d29`) | `scale-label` | 14.67:1 | ✓ AAA |
| `{mint}` (solid root dot) | `root-label` (`#08130f`) | 9.86:1 | ✓ AAA |
| `{panel}` | `string-name` (`#cfcfd4`) | 11.84:1 | ✓ AAA |
| `{panel}` | `tape-num` (`#d6b878`) | 9.62:1 | ✓ AAA |
| `{panel}` | `octave-label` (`#5ecabb`) | 9.32:1 | ✓ AAA |
| `{panel}` | `heel-label` (`#a99fc4`) | 7.39:1 | ✓ AAA |
| `pill-active-wash` on `{surface}` (composited `#132d29`) | `{text}` | 12.50:1 | ✓ AAA |
| `tape-pill-wash` on `{surface}` (composited `#2f2a22`) | `tape-pill-fg` (`#f0e2c4`) | 11.10:1 | ✓ AAA |
| `land-pill-wash` on `{surface}` (composited `#192c2b`) | `land-pill-fg` (`#bfeae3`) | 11.20:1 | ✓ AAA |

`{text3}` on `{surface}` (3.37:1) is the one sub-4.5:1 pairing and is allowed **only** as placeholder/section-header/meta text (the `.lab` row labels, the View row's `.view-cap` control captions, the sidebar section header, the breadcrumb base segment, the `⌘K` chip), never as body copy that must be read to operate the tool. The View captions name their radiogroup via `aria-labelledby`, so assistive tech gets the label at full fidelity regardless of this visual exemption. The root-dot and non-root-label pairings are P0 invariants (§11.2). Note the in-scale label clears AAA, not merely AA: `in-scale-fill` is a low-opacity mint over the near-black `{panel}`, so it composites to a very dark teal (`#112d29`) against which white sits ≈14.7:1 — the AA-floor concern (§11.2) is the *fill staying dark enough*, and it does so with wide margin.

### 2.6 Semantic / status colors

The functional accents in §2.4 (`{tape}`/`{teal}`/`{violet}`) cover **reference-overlay** meaning — they are not system-status colors. This subsection is the sanctioned contract for *system status* (success, error, warning, info) so that a future intonation read-out, a form with validation, or any status-bearing surface inherits a decision instead of inventing one (which would break the single-accent discipline of §2.4). The governing rule: **do not invent a status color. Use the role defined here, or — where the role is an open gap — leave it open until a tool actually needs it.**

| Role | Token | Resolves to | Use it for | Never use as |
|---|---|---|---|---|
| **Success / in-tune** | `{success}` → `{mint}` | `#00d4a4` | The one positive-status color. In this product "in tune," "in scale," and "where sound lives" are the *same* idea, so success **deliberately reuses `{mint}`** rather than adding a green; a separate success token would split the acoustic anchor into two near-identical greens and weaken it. | a *second* solid fill competing with the root dot; a generic "OK" tint on chrome that has nothing to do with pitch |
| **Error / danger** | `{danger}` → `{red-500}` | `#e5644e` | **Reserved, still unbound (#88 deliberately did NOT bind it).** The first failable action — the §16 Share-scale copy/share branch — expresses failure as a **neutral `{text2}` caption beside the button** (§8.4), *not* a status color: a one-off "couldn't copy, the link is in the address bar" hint is not a danger state, and recoloring would split the single-accent discipline. `{red-500}` stays the *expected candidate* for a genuine validation surface (e.g. a future text input). It is intentionally a **desaturated, muted red** so it never reads as a brand accent beside `{mint}`. | a tape/landmark band or any note-map element (red carries no musical meaning here); anything decorative; the Share-scale failure caption (it is `{text2}`, by §8.4); a value applied *before* a real error surface exists |
| **Warning** | — (no token) | — | **Out of scope in v1.** No amber-on-different-surface warning role exists, and `{tape}` (amber) is **off-limits** for it — `{tape}` means "beginner tape overlay" and nothing else (§2.4). If a warning is ever needed, it requires a *new* primitive distinct from `{amber-400}`, decided then. | `{tape}`/`{amber-400}` repurposed as a warning tint |
| **Info** | — (no token) | — | **Out of scope in v1.** No info/notice (blue) role exists. Teaching copy is plain `{text2}` prose (§13), not a colored callout, so no info color is required yet. | inventing a blue; recoloring `{teal}` (which means "octave landmark") into a notice tint |

**When error/danger ships, it must clear contrast like everything else (§2.5):** `{red-500}` (`#e5644e`) on `{surface}` (`#161618`) computes to **5.39:1** — clears AA for normal text as a foreground/border accent — and it must **not** be placed where it could be mistaken for an in-scale or root dot. Until then, `{danger}` stays declared-but-unapplied, exactly like `mint-deep` (§0).

---

## 3. Typography

Two families, partitioned by meaning (Principle 4). Inter loads weights 400/500/600/700; Geist Mono loads 400/500/600. Body is `lh-normal` (1.5), antialiased. Mono labels are typically uppercase, letter-spaced, and small.

**Inter Italic 400 is also loaded** (`weights-ui-italic`, §0) as a **real face**, not a synthesized slant. Its single consumer is the SVG "heel ⌄" label, which sets `font-style:italic`; because none of the roman cuts carry an italic, omitting the true italic would make the browser fake an oblique. Load Inter Italic 400 alongside the roman cuts — do not rely on synthesis.

**The type scale is intentionally non-modular.** There is no ratio and no base-times-step formula; the sizes in the table below are fixed per role (`base-ui` 14px is the most common UI size). When adding a new text role, pick the nearest existing size — do **not** interpolate a new value between two listed sizes.

**Line-height** is named, not free: `lh-tight` (1.1) for the large display heading, `lh-normal` (1.5) for multi-line copy, `lh-flush` (1) for single-line chrome whose height is already fixed by its box (nav, pill, search, kbd, labels). The column below gives the value per role.

**Tabular figures are load-bearing.** Every role marked **tnum** in the Notes column sets `font-feature-settings` (`features-mono` on Geist Mono, `features-ui` on Inter). Without it, note names drift inside the fixed-diameter dots and tape/position numerals fall off the column grid. Apply it to *every* numeric role — dot note-name labels, tape numbers, position labels, and the interval formula — not just the obviously tabular ones.

| Role | Family | Size | Weight | Line-height | Tracking | Color | Notes |
|---|---|---|---|---|---|---|---|
| Wordmark | Inter | 16px | 600 | `lh-flush` | `-0.02em` | `{text}` (period `{mint}`) | |
| Page H1 (scale name) | Inter | 32px | 600 | `lh-tight` (1.1) | `-0.7px` | `{text}` | |
| Kicker ("Scale map") | Geist Mono | 11px | 500 | `lh-flush` | `1px` | `{mint}`, `opacity .85`, uppercase | |
| Interval formula | Geist Mono | 14px | 400 | `lh-flush` | `1px` | `{text2}` | **tnum** (`features-mono`) |
| Nav item | Inter | 14px | 500 | `lh-flush` | — | `{text2}` (active `{text}`) | |
| Controls row label `.lab` | Inter | 11px | 600 | `lh-flush` | `0.5px` | `{text3}`, uppercase, width 52px | |
| View sub-row caption `.view-cap` | Inter | 11px | 500 | `lh-flush` | — | `{text3}`, sentence-case | the §9.1 View-row control caption — one tier below `.lab` |
| Pill text | Inter | 13px | 500 | `lh-flush` | — | `{text2}` (active `{text}`) | |
| Search placeholder | Inter | 13px | 500 | `lh-flush` | — | `{text3}` | |
| Breadcrumb — base | Inter | 13px | 500 | `lh-flush` | — | `{text3}` | separator `/` in `{hairline3}` |
| Breadcrumb — active segment (`b`) | Inter | 13px | 500 | `lh-flush` | — | **`{text2}`** | matches §9 shell tree |
| Ghost button | Inter | 13px | 500 | `lh-flush` | — | `{text}` | |
| Section header `.sec-h` | Geist Mono | 10px | 500 | `lh-flush` | `1px` | `{text3}`, uppercase | |
| kbd chip | Geist Mono | 10px | 400 | `lh-flush` | — | `{text3}`, bordered, radius 4px, pad `1px 5px` | |
| "esc" chip | Geist Mono | 10px | 400 | `lh-flush` | — | `{text3}`, bordered, radius 4px, pad `2px 6px` | taller/wider dismiss target |
| "soon" badge | Geist Mono | 9px | 400 | `lh-flush` | — | `{text3}`, bordered, radius 4px, pad `1px 4px` | |
| Legend text | Inter | 12px | 400 | `lh-normal` | — | `{text2}` | |
| Caveat text | Inter | 12px | 400 | `lh-normal` | — | `{tape}` | |
| Palette input | Inter | 16px | 400 | `lh-flush` | — | `{text}` | |
| Palette row text | Inter | 14px | 400 | `lh-flush` | — | `string-name` (`#cfcfd4`) | |
| Palette group header | Geist Mono | 10px | 400 | `lh-flush` | `1px` | `{text3}`, uppercase | |
| Palette row meta | Geist Mono | 11px | 400 | `lh-flush` | — | `{text3}` (`soon` → `palette-soon`) | **tnum** where numeric |
| Palette footer | Inter | 11px | 400 | `lh-flush` | — | `{text3}` | |

The active breadcrumb segment is **`{text2}`** — note the split row above. Do not read the old single "search / breadcrumb / ghost" row as putting the active crumb at `{text}`; only the ghost button is `{text}`.

**Note-map (SVG) text.** Each label below is one `<text>` element. `text-anchor:middle` throughout; the build uses **no `dominant-baseline`** — vertical centering is the explicit `+4px` baseline offset noted per row. The octave landmark stacks **two separate labels** ("octave ◈" and "½ string") that share the `octave-label` color but differ in family *and* size — they are two rows here, not one slash.

| SVG label | Family | Size | Weight | Color | Baseline / position | Notes |
|---|---|---|---|---|---|---|
| String name | Inter | 11px | 600 | `string-name` | `x=24`, `y = S.y + 4` | no `dominant-baseline` |
| In-scale dot label | Inter | 12px | 500 | `scale-label` (`#ffffff`) | `cy + 4` | **tnum** (`features-ui`) |
| Root dot label | Inter | 12px | 700 | `root-label` (`#08130f`) | `cy + 4` | **tnum**; color invariant (§11.2) |
| "open" label | Inter | 10px | 400 | `open-label` | `(42, 252)` | |
| Tape number | Geist Mono | 9px | — | `tape-num` | `y=48`, column center | **tnum** (`features-mono`), e.g. `2 (+4)` |
| Octave label "octave ◈" | Geist Mono | 9px | — | `octave-label` (`#5ecabb`) | `y=48` | **top** label of the octave band |
| "½ string" label | Inter | 8px | — | `octave-label` (`#5ecabb`) | `y=226` | **bottom** label of the octave band — Inter, not mono |
| Position labels | Inter | 10px | 600 | `pos-label` | `y=252` | **tnum** — the "3rd/4th/5th/7th" numerals |
| "heel ⌄" label | Inter **Italic** | 8px | 400 | `heel-label` | `y=226` | `font-style:italic` on the real italic face (§0 `weights-ui-italic`) |

---

## 4. Spacing, Sizing & Radius

The spacing scale is 4px-based and every step is a named token in §0 (`space-100` … `space-1600`). The multiplier is the value over 4, and the name encodes it: `space-400` = 16px = 4× the base, so any value is reconstructable from its name alone. Whitespace is generous around the map and tight within data rows — calm at the edges, dense at the core. Radii are listed in §0 under `radius`; each climbs with the element's size, from `chip` (3px) on a legend swatch to `frame` (14px) on the palette.

**The shell is a flex row — no CSS grid is used anywhere in the product.** There are two regions: `.side` (`flex: none; width: 248px`) and `.main` (`flex: 1; min-width: 0`); see the §9 tree for the full nesting. A CSS grid would force column-count and track-sizing decisions this layout does not need — there is one fixed rail and one fluid column, which is exactly a two-child flex row. Reach for flexbox (and, inside rows, `display:flex` with an explicit `flex-wrap`), not a 12-column grid.

### 4.1 Scale bands — which step does which work

| Band | Steps | Used for |
|---|---|---|
| Micro | `space-100` (4px) | icon→label gaps, swatch→label, inter-pill gap |
| Component | `space-200`·`space-300`·`space-400` (8·12·16px) | search/toolhead gaps, controls inner gap, card & sidebar padding |
| Layout | `space-500`·`space-600`·`space-800` (20·24·32px) | topbar padding, content gutters, kicker/section rhythm |
| Page | `space-1200`·`space-1600` (48·64px) | content-column bottom breathing room |

### 4.2 Key measurements

| Element | Spec |
|---|---|
| Sidebar | width `248px`; padding `16px 14px`; inter-section gap `14px` |
| Search bar | height `36px`; radius `control`; padding `0 10px`; gap `8px` |
| Nav item | height `32px`; radius `nav`; padding `0 10px`; **inter-item gap `2px`** (a deliberate off-scale half-step — the `.nav` flex-gap is `2px`, *not* `space-100`/4px; it is the one sub-token gap in the product, tightening the tool list); `9px` icon→label; **icon `15×15px`** (square; `icon.box.nav`, §0) |
| Theme toggle | height `32px`; radius `nav`; padding `0 10px`; gap `8px`; resting `background transparent`, `text {text2}` (13px), **border `1px solid {hairline}`** (the toggle is the one foot-of-rail control that carries a resting hairline, distinguishing it from the borderless nav items above it); hover `background nav-hover-bg` — see §8.8 |
| Topbar | height `52px`; padding `0 32px` |
| Content column | max-width `880px`; padding `26px 32px 60px` |
| Kicker | margin-bottom `5px` |
| Toolhead (H1 + formula) | baseline-aligned, space-between; gap `8px`; margin-bottom `16px` |
| Controls card | radius `card`; **border `1px solid {hairline}`**; padding `16px`; inner gap `12px`; margin-bottom `16px` |
| Controls row | `display:flex`; the row itself uses gap `6px`; label column (`.lab`) fixed `52px`, `flex:none`. **Pills in the row: `display:flex; flex-wrap:wrap`; inter-pill gap `space-100` (4px).** The 12-pill Root row **wraps** to a second line on a narrow column (it never horizontal-scrolls and never overflows the card) |
| Pill | height `30px`; padding `0 12px`; radius `pill` |
| Panelcard (frame) | radius `frame`; **border `1px solid {hairline}`**; padding `12px` |
| Note-map plate (`.panel`) | radius `plate`; **border `1px solid {panel-bd}`** (the inner hairline that separates plate from frame); padding `12px 10px 8px`; **`overflow-x: auto`**; SVG `width:100%`, `height:auto`, `min-width:760px` **on the horizontal/desktop render only** (the vertical mobile render drops it to `0` — §10/§12.1) |
| Caveat | margin `10px 2px 0` |
| Legend | outer gap `16px`; swatch→label gap `7px`; margin `14px 2px 0` |
| Ghost button | radius `pill`; padding `7px 14px` |
| Command palette | width `560px` (max `92vw`); radius `frame`; overlay padding-top `11vh` |
| Palette search | padding `15px 16px`; gap `11px`; **border-bottom `1px solid {hairline}`** (the rule between search and results) |
| Palette results | max-height `48vh`; padding `8px`; **no own divider** (it abuts the search rule above and the footer rule below) |
| Palette row | height `40px`; radius `control`; padding `0 11px`; gap `11px`; **icon column width `18px`** |
| Palette group header | padding `9px 10px 4px` |
| Palette footer | padding `9px 14px`; gap `16px`; **border-top `1px solid {hairline}`** (the rule between results and footer) |

---

## 5. Elevation & Depth

Depth in this product comes from **surface-tint and hairline borders first; shadow only for a genuine float** (a modal or overlay). There is exactly one heavy shadow in the entire interface — the command palette — and it earns its blur by literally lifting off the page above a scrim. Everything else gets its sense of layering from stepping one surface lighter (`{panel}` → `{surface}` → `{raised}`) and laying a hairline between planes. Because the app is dark-native, a drop shadow on a near-black plane reads as muddy haze, not lift; that is why raised chrome uses tint instead.

| Level | Token | `box-shadow` | Use |
|---|---|---|---|
| Resting | `elevation.resting` | `none` | page body, controls card, plate at rest |
| Raised | `elevation.raised` | `none` (surface-step + hairline) | active nav item, palette row hover/selected — lift comes from `{raised}` fill + `{hairline}`/`{hairline2}` border, not shadow |
| Overlay | `elevation.overlay` | `none` | the backdrop scrim itself (`overlay-scrim`, blur 2px) — the dimmed page is the depth cue |
| Modal | `elevation.modal` | `0 24px 64px rgba(0,0,0,.6)` | the command palette — the **only** heavy shadow in the product |

Rule: if you reach for a shadow to lift a panel, you are working against the system — raise the surface a step and add a hairline instead (§2.2). A shadow is reserved for the modal/overlay tier alone.

---

## 6. Shape & Radius

A single authoritative radius contract. Every rounded corner in the product resolves to one of these seven tokens; the radius climbs with the element's footprint.

| Token | Value | Use |
|---|---|---|
| `chip` | `3px` | tape/landmark legend swatches; palette kbd chip; tape/heel band `rx` in the note map |
| `kbd` | `4px` | kbd chip, "esc" chip, "soon" badge |
| `nav` | `6px` | nav items; theme toggle |
| `control` | `8px` | search bar; palette rows |
| `plate` | `10px` | note-map inner plate |
| `card` | `12px` | controls card |
| `frame` | `14px` | panelcard outer frame; command-palette modal |
| `pill` | `9999px` | pills; ghost button; note-map dots (true circles) |

**Fingerboard geometry note.** The note map mixes circles and rects, and their corner treatment is fixed: **dots are true circles** (`pill` radius — they are `<circle>`, so radius means the geometric `r`, not a CSS corner). **Guide lines are 1px hairlines with no radius** (`<line>`, stroke only). **String lines have no radius** (`<line>`, 1.5px stroke). **The nut is a plain rect with no radius.** **Tape and heel/octave band rects use `rx=3` (`chip`).** No element in the map uses any other radius; in particular, nothing in the map is rounded to `nav`/`control`/larger — those belong to the chrome around the plate, never inside it.

---

## 7. Motion

**Morph, never flash** (Principle 5). All values are in §0 under `motion`; each easing there carries a "never use for" guard. There are two realized treatments; both honor `prefers-reduced-motion: reduce`.

### 7.1 Stateful build — dots morph between states (primary)

Each persistent note node carries CSS transitions; a scale change only swaps the class that drives its state, and radius / fill / **label color** / label opacity tween in place:

| Target | Property | Duration | Easing |
|---|---|---|---|
| `.note .dot` | `r` | `230ms` | `ease-spring` |
| `.note .dot` | `fill`, `stroke`, `stroke-width` | `200ms` (`state-color`) | `ease` |
| `.note .glow` | `opacity` | `200ms` (`glow-fade`) | `ease` |
| `.note .lbl` | `opacity` | `160ms` (`label-fade`) | `ease` |
| `.note .lbl` | `fill` | `190ms` (`lbl-fill`) | `ease` |
| `.tape` | `opacity` (show/hide) | `190ms` | `ease` |
| `.tape` | `transform` (slide) | `230ms` (`tape-slide`) | `ease-spring-2` |
| `.land` | `opacity` (show/hide) | `200ms` (`state-color`) | `ease` |

The `.lbl` **fill** row is load-bearing: on a root-state change the label color crosses from `scale-label` (`#ffffff`) to `root-label` (`#08130f`). Without the 190ms fill tween it would snap, flashing on every root transition — tween it.

**State is class-driven.** The `glow` ring is `opacity:0` by default (`.note .glow { opacity:0 }`) and is promoted to visible **only** in the root state by `.note.is-root .glow { opacity:1 }` — the 200ms `glow-fade` transition then carries it in and out. The dot/label states are driven the same way: `.note.is-off`, `.note.is-scale`, `.note.is-root` swap radius/fill/label, and `.note .glow` stays `opacity:0` for both off and in-scale. There is no data-attribute or inline-style path; the `is-root` class on the wrapper `<g>` is the sole trigger for the glow. **The reference layers toggle the same way:** the `.tape` and `.land` groups carry a **`.hide`** class (`tapeG`/`landG` `.classList.toggle('hide', …)`) whose opacity transition is what the §7.1/§7.5 `.tape`/`.land` opacity rows describe — visibility is the `.hide` class, not a raw inline opacity write.

**Per-column stagger:** each node's `transition-delay = columnIndex × 6ms`, so a change sweeps left → right up the neck. The label text swaps while the dot itself persists — a letter change, not a node replacement.

### 7.2 Snappy build — dots pop in (alternative)

```css
@keyframes dotPop{
  0%   { opacity:0; transform:scale(.5); filter:blur(1.5px) }
  70%  { opacity:1 }
  100% { opacity:1; transform:scale(1); filter:blur(0) }
}
```
Duration `150ms` (`pop`), easing `ease-overshoot`. Applied via `.dot-anim` on each in-scale dot's `<g>` (`transform-box:fill-box; transform-origin:center; will-change:transform,opacity`). **Per-column stagger** `animation-delay = columnIndex × 10ms` (left → right sweep).

**Snappy root-glow value.** The snappy build's `:root` overrides the root-ring color to `root-glow-snappy` (`rgba(0,212,164,.25)`) — slightly softer than the stateful build's `root-glow` (`.28`). When emitting the snappy build's `:root`, write `.25`; when emitting the stateful build's, write `.28`. (Both alias the same `mint-500` hue at different alpha; only the alpha differs between builds.)

### 7.3 Controls, search, palette

- **Pill press** — `transform 90ms ease`; `.pill:active { transform: translateY(1px) scale(.97) }`. Color/border/background transition `140ms ease` in the **stateful** build; in the **snappy** build only `border-color`/`background` transition at `120ms ease` — **the snappy pill does not transition `color` at all** (its transition list omits the color property).
- **Search box** — `border-color` + `background` `140ms ease`; hover border `{hairline3}`.
- **Command palette — two independent fades.** The **scrim** (`.overlay`) carries `opacity 180ms ease` on its base rule, so the backdrop fades the same `180ms` **both opening and closing**. The **palette** (`.palette`) carries its *own* opacity and transform. Its **resting (closed) state is `transform: scale(.96); opacity: 0`** — that is also the destination it animates back to on close. On **open** the `.is-open` parent promotes it to `scale(1); opacity:1` with `transform 250ms ease-modal-in` + `opacity 200ms` (`palette-in`). On **close** it runs the base rule's `transform 160ms ease-modal-out` + `opacity 150ms ease` (`palette-out`) **from `scale(1)` back to `scale(.96)`** (not `.94`, not `.97`). `transform-origin: center`. Do not conflate the two timelines — the scrim's `180ms` and the palette's `250/200` (open) ÷ `160/150` (close) are separate.

### 7.4 Reduced motion

```css
@media (prefers-reduced-motion: reduce){
  .dot-anim { animation: none }                 /* snappy  */
  .note .dot, .note .glow, .note .lbl,
  .tape, .land, .overlay, .palette, .pill { transition: none }   /* stateful */
  .pill:active { transform: none }
}
```
Under `reduce`, dots appear and change instantly, bands toggle without fade, the palette appears without scale-up, and the pill press has no displacement. The interface stays fully usable and legible.

**Orientation flip snaps instantly.** When the map flips between the horizontal (desktop) and vertical (mobile) renders (§12.1), the 60 dots jump to their new coordinates with no slide — in *every* motion mode, not only under `reduce`. This is true by construction, not by a rule: no transition is declared on `cx`/`cy` or on a `.note <g>` transform, and a flip moves dots by rewriting SVG `cx`/`cy` *attributes*, which do not tween. A small forward-proofing hook (`useOrientationSnap`, the canonical `getBoundingClientRect()` reflow idiom) suspends transitions on the `.notes` group and forces one reflow on a flip, so should a future phase add a position transition (e.g. a density move), the flip still snaps. Mirroring that, the §7.4 block reserves a `.board[data-motion] .note, .board[data-motion] .notes { transition: none }` clause — `.board[data-motion]`-prefixed so it wins the cascade (a media query adds no specificity) — to zero any such future position transition under `reduce`.

### 7.5 Enter / update / exit, per animated surface

The contract for every surface that animates on/off or between states. "Update" is the in-place tween (the common case in this product, where elements morph rather than re-mount); "—" means the element has no animation in that phase. All durations/easings resolve in §0.

| Element | Enter | Update (in-place) | Exit |
|---|---|---|---|
| Note dot (stateful) | mounts once with the map (no enter animation) | `r` 230ms `ease-spring`; `fill`/`stroke`/`stroke-width` 200ms `ease`; stagger `columnIndex × 6ms` | never exits — re-classed in place, persists for the page's life |
| Note dot (snappy) | `dotPop` 150ms `ease-overshoot`, stagger `columnIndex × 10ms` | (off→in-scale re-runs `dotPop`) | opacity to 0 / removed instantly (no dedicated exit keyframe) |
| Root glow ring | `opacity` 0→1, 200ms `ease` (`glow-fade`), triggered by `.note.is-root .glow` | follows root in/out via the same opacity tween | `opacity` 1→0, 200ms `ease` when leaving root |
| Sounding overlay (`.sound`) | `opacity` 0→1 (the heavier `{mint}` stroke appears); **no pulse keyframe is defined in v1** — the static `stroke-width:3` ring is the sole indicator in **all** motion modes | — (it does not animate while sustained) | `opacity` 1→0 when the note stops sounding |
| Tape band | `opacity` 0→1, 190ms `ease`; plus `transform` 230ms `ease-spring-2` when sliding `+4`↔`+3` | `transform` slide 230ms `ease-spring-2` | `opacity` 1→0, 190ms `ease` |
| Landmark band | `opacity` 0→1, 200ms `ease` (`state-color`) | — (bands don't move; only toggle) | `opacity` 1→0, 200ms `ease` |
| Command palette | `transform` scale(.96)→scale(1) 250ms `ease-modal-in` + `opacity` 0→1 200ms (`palette-in`) | — (no intra-open state change) | `transform` scale(1)→scale(.96) 160ms `ease-modal-out` + `opacity` 1→0 150ms (`palette-out`) |
| Scrim (`.overlay`) | `opacity` 0→.55 (`overlay-scrim`) 180ms `ease`, blur 2px | — | `opacity` →0 180ms `ease` (same both directions) |
| Caveat / legend | none — static, always rendered with the map (no show/hide animation in the build) | — | — |
| Tooltip (`soon` / disabled affordances) | **partially realized (#88)** — the tooltip lane's durations now exist as `--tt-in: 120ms` / `--tt-out: 100ms` (`tokens.css`), first consumed by the §16 **Share-scale caption + label/check swap** (paired with `--ease-modal-in` / `--ease-modal-out`). The `soon`/disabled tooltips themselves remain a native title/`aria-describedby` affordance, not an animated overlay; if built as one, mirror the palette pattern at these **half** durations: `transform scale(.96)→scale(1)` **enter 120ms `ease-modal-in`** + `opacity 0→1`; **exit 100ms `ease-modal-out`** + `opacity 1→0` (≈50% of the palette's 250/200 ÷ 160/150). | — | exit per the enter row (100ms `ease-modal-out`) |

The dominant pattern is the **Update** column: most state change here is an in-place tween, not a mount/unmount, which is why "enter/exit" is sparse and "never exits" recurs.

---

## 8. Components

Per-component contracts. Each block resolves `background`, `border`, `text`, `radius`, `height`, and `padding` to tokens; hover/active are given as deltas; focus is a literal ring. Where the build has no explicit hover/focus rule, the spec states the intended one and marks it so.

**Focus ring — the custom `{mint}` ring ships (S10).** The focus indicator in v1 is the **custom global `2px {mint}` ring** specified here: on rounded chrome (pills, nav items, search trigger, ghost button, theme toggle, skip link, palette input) it is a `box-shadow` ring at `2px` offset (`0 0 0 2px {canvas}` spacer + `0 0 0 4px {mint}`); on the SVG note-map markers and the board group it is `outline: 2px solid {mint}` at `outline-offset: 2px`. It is painted via **`:focus-visible`**, so it shows on keyboard focus and not on a pointer click. Per-component "focus — global `{mint}` ring" rows below describe this *shipped* indicator. The invariant holds: **a visible focus indicator always exists** — the layer (`apps/web/src/styles/a11y.css`) only ever replaces the UA outline with this ring, never `outline:none` with nothing.

### 8.1 Pill (`.pill`)

Variants: **default**, **active**, **tape** (active amber), **landmark** (active teal), **dim** (unavailable).

| Property | Default | Active | Tape (active) | Landmark (active) |
|---|---|---|---|---|
| background | `transparent` | `pill-active-wash` | `tape-pill-wash` | `land-pill-wash` |
| border | `1px {hairline2}` | `1px {mint}` | `1px {tape}` | `1px {teal}` |
| text | `{text2}` | `{text}` | `tape-pill-fg` | `land-pill-fg` |
| radius | `pill` | `pill` | `pill` | `pill` |
| height | `30px` | `30px` | `30px` | `30px` |
| padding | `0 12px` | `0 12px` | `0 12px` | `0 12px` |

States (deltas from the row above):
- **hover** — border → `{hairline3}` (default variant); active/tape/landmark keep their accent border.
- **active (pressed)** — `transform: translateY(1px) scale(.97)`; transition `transform 90ms ease` (color/border/background `140ms` stateful, `120ms` snappy with no `color`).
- **focus** — global `{mint}` focus ring (shipped, S10): `box-shadow` 2px `{mint}` at 2px offset on `:focus-visible`.
- **disabled / dim (`.dim`)** — `opacity:.4; pointer-events:none`; no hover, no press. Used when a pill is invalid in the current combination (e.g. "low 2" while tapes are off or 3-tape is active).
- **error** — n/a. A pill is a pure toggle within a radiogroup; selection cannot "fail," so it has no error state.
- **loading** — n/a. Selecting a root/scale/ref is synchronous local state; the pill has **no async state and never shows a spinner**. (If a future tool needs async, that is a different component.)

**Do / Don't.** Don't give the pill a loading spinner or a busy state — it has no async work; selection is instant local state. Do express "unavailable in this combination" with `.dim` (`opacity:.4; pointer-events:none`), never by hiding the pill.

Note dots have **no** hover/press state — they are SVG data, not buttons (§11 worked example).

### 8.2 Nav item (`.ni`)

| Property | Default | Active (`.active`) | Soon (`.soon`) |
|---|---|---|---|
| background | `transparent` | `{raised}` | `transparent` |
| text | `{text2}` | `{text}` | `{muted}` |
| icon | `currentColor` | `{mint}` | `currentColor` (muted) |
| radius | `nav` | `nav` | `nav` |
| height | `32px` | `32px` | `32px` |
| padding | `0 10px` | `0 10px` | `0 10px` |

**Icons.** Each nav item carries one glyph inside a fixed **`15px`** icon span (`icon.box.nav`, §0), color = `currentColor` so it inherits the row's text token — which is why the active item's icon turns `{mint}` along with its label, while resting/soon icons sit at `{text3}`. The two drawn inline SVGs in the current build (§0 `icon.svg`) are **Scales** (`ic-scales`, the three-line neck mark) and **search** (`ic-search`, the magnifier — sidebar trigger and, below the `760px` breakpoint, the mobile top-bar search trigger that opens the palette, §10). The `ic-menu` hamburger (§0) is **forward-prep, not currently rendered**: S16 ph3 dropped the off-canvas drawer and its `.topbar-menu` trigger, so `IcMenu` is absent from `icons.tsx` (the mobile top bar carries the search trigger in its place). The live tool nav items render **Unicode glyph characters** as plain text (§0 `icon.glyph-char`): **Intonation** = `◴` (live, C9), **Vibrato** = `∿` (still "soon"), **Tuner** = `◎` (live, S18 ph6). Do not redraw these glyphs as custom SVG — they are characters.

- **hover** (default only) — background → `nav-hover-bg`.
- **soon** — carries a "soon" badge, `aria-disabled="true"`, **no hover**, not focusable as an action.
- **focus** — global `{mint}` ring.
- **error** — n/a. Navigation is client-side route selection; there is no failable action on the item itself.
- **loading** — n/a in v1 (only one live tool). If a future tool's view loads async, the loading indicator belongs in the **content area**, not on the nav item (the item never shows a spinner).

**Do / Don't.** Don't reuse `.soon`'s `{muted}` styling for a *live* item that happens to be inactive — `{muted}` reads as permanently disabled. Do keep an inactive-but-available item at `{text2}` with the `nav-hover-bg` hover; reserve `{muted}` + the badge for genuinely unbuilt tools.

### 8.3 Search bar (`.search`)

`background {surface}` · `border 1px {hairline2}` · `text {text3}` (placeholder) · `radius control` · `height 36px` · `padding 0 10px` · `gap 8px` · leading magnifier `ic-search` (the drawn 14×14-viewBox SVG of §0 `icon.svg`, rendered ~14px here, `stroke:currentColor` at `{text3}`) · trailing ⌘K kbd chip. The same `ic-search` glyph leads the palette's `.psearch` row, rendered slightly larger (~16px) and stroked at `{text2}`.

- **hover** — border → `{hairline3}`; transition `border-color 140ms ease, background 140ms ease`.
- **focus / activate** — clicking opens the command palette (the field itself is a trigger, not a text input in place); the `{mint}` focus ring is shipped (S10) on `:focus-visible`.
- **error** — n/a on the sidebar trigger itself: it accepts no input in place, so it can't be invalid. *Input validation lives in the palette*, not here — a typed query that matches nothing surfaces as the palette **empty state** (§8.5), not a red border on this field.
- **loading** — n/a. Opening the palette is instant; the field never shows a spinner. If results ever load async, the loading skeleton is a palette-row concern (§8.5), not the trigger's.

**Do / Don't.** Don't turn this into an inline text input or attach validation styling to it — it is a *button that opens the palette*. Do route all query entry, no-match feedback, and result loading into the palette (§8.5).

### 8.4 Ghost button (`.ghost`)

`background transparent` · `border 1px {hairline2}` · `text {text}` (13px/500) · `radius pill` · `padding 7px 14px`.

- **hover** — border → `{hairline3}` (intended; matches pill/search hover language).
- **active** — `translateY(1px) scale(.97)`, `transform 90ms ease`. **Shipped (#88):** authored fresh on `.ghost` (it had no press state before the Share wiring), matching the pill press language above.
- **focus** — global `{mint}` ring.
- **error** — **realized (#88):** the now-async copy branch can fail, and failure is a **transient inline `{text2}` caption beside the button** ("Couldn't copy — link is in the address bar" / "Couldn't share — link is in the address bar"), auto-reverting ~1500ms. The border is **never** recolored and no status color is introduced (`{danger}` stays reserved, §2.6). The share branch defers to the OS sheet: a dismissed sheet (`AbortError`) is silent; a non-Abort `share()` rejection shows the same neutral caption. Cross-ref §7.5 (the caption fades at the tooltip lane) and §11.3 (copy success is the only spoken outcome).
- **loading** — **realized (#88):** the copy branch shows a brief in-button busy state (the label swaps "Share scale" → "Copying…", the §7.5 text-swap technique), then a `currentColor` ✓ + the "Link copied" caption. **No second accent** is introduced for any of it. The native-share branch has no in-button busy label — the OS sheet is its own busy surface.

**Do / Don't.** Don't promote the ghost button with a fill or an accent border to draw attention — it is deliberately the quietest control on the topbar. Do keep it transparent with the `{hairline2}`→`{hairline3}` border language shared with pills and search. The Share feedback (label swap, ✓, caption) lives **beside or inside** the button at `{text2}`/`currentColor`, never as a recolored border or a second solid fill.

### 8.5 Command palette row (`.presults` item)

`background transparent` · `text string-name` (Inter 14px) · `radius control` · `height 40px` · `padding 0 11px` · `gap 11px` · **leading icon column `18px`** (`icon.box.palette`; the glyph is centered in the span, color `{text3}`, promoted to `{mint}` on the selected row by `.pitem.sel .pico`) · trailing `↵`/`soon`/`open` meta (Geist Mono 11px `{text3}`, `soon` → `palette-soon`). **Row glyph by group (all Unicode characters, §0 `icon.glyph-char`):** a **Scales** jump target uses `♪`; the **Scale Map (open)** tool row uses `▦`; the **Intonation (open, C9)** tool row uses `◴`; the **Tuner (open)** tool row uses `◎`. These are characters set as text, not drawn SVG.

**Section dividers.** The three palette sections are separated by single `{hairline}` rules, not by gaps: the `.psearch` row carries a **`border-bottom 1px {hairline}`** and the `.pfoot` a **`border-top 1px {hairline}`**; the `.presults` list in the middle has **no rule of its own** (§4.2). Group headers inside the results (`Scales`, `Tools`) are spacing + the mono header type only — they are not ruled.

- **hover / selected** — background → `{raised}` (keyboard selection and pointer hover share this state).
- **soon** — meta tag `soon` in `palette-soon`; row is non-actionable.
- **focus** — selection follows roving focus within the results list; the highlighted row is the `{raised}` selected state (no separate ring inside the modal).
- **empty (no results)** — when the query matches nothing, the results area replaces rows with a single centered line: "No matches" in `{text3}` (Geist Mono is **not** used here — this is human language, so Inter 14px), no icon, non-selectable. The group headers are suppressed; the footer (`↑↓ / ↵ / ⌘K`) remains. This is the search flow's error/no-match surface (referenced from §8.3).
- **loading** — results are local (no network), so the steady state is **no loading state**. If a row's target ever resolves async, show a skeleton row at the same `40px` height: `{raised}` fill at reduced opacity, no text, no icon — never a spinner inside the row. Document as a known gap until a tool actually needs it.

**Do / Don't.** Don't render "No matches" or a skeleton with the music/mono type system — empty-state and status copy are human language (Inter), reserving Geist Mono for note/technical values only. Do keep the selected and hover state a single shared `{raised}` fill so keyboard and pointer never diverge visually.

### 8.6 Kbd chip (`.kbd`, "esc", "soon")

Display-only, never interactive. `border 1px {hairline2}` · `text {text3}` · Geist Mono. Padding differs by chip — they are **not** all the same box:
- **kbd chip** (⌘K in the sidebar search): 10px, radius `kbd`, pad **`1px 5px`**.
- **"esc" chip** (inside the palette search row): 10px, radius `kbd`, pad **`2px 6px`** — deliberately taller and wider, because it is a more prominent dismiss target in the palette.
- **"soon" badge**: 9px, radius `kbd`, pad `1px 4px`.

No hover/active/focus — it is a glyph, not a control. **Error / loading: n/a** — a static label has neither.

**Do / Don't.** Don't collapse the kbd and esc chips to one padding value — the esc chip is intentionally the larger hit/visual target (`2px 6px` vs `1px 5px`). Do keep all three non-interactive: they *label* a shortcut, they don't *invoke* it.

### 8.7 Legend swatch

Display-only key (fully described in §12.4). By type: **root** 16×16 circle solid `{mint}`; **in scale** 16×16 circle `in-scale-swatch` + `1.5px {mint}` border; **not in scale** 9×9 circle `off-fill` + `1px off-stroke`; **beginner tape** 13×16 rect radius `chip` `tape-swatch`; **landmark** 13×16 rect radius `chip` `linear-gradient(180deg, {teal}, {violet})`. **No interactive states; no error/loading state** — the legend is a static key, not a control.

**Do / Don't.** Don't make swatches clickable or tie them to filtering — they decode the map, they don't drive it (the controls do). Do keep each swatch's shape and size matched to what it labels (circles for dots, rects for bands), since shape is a non-color redundancy cue (§11.1).

### 8.8 Theme toggle (`.theme`)

The "☾ Dark" control at the foot of the sidebar. It shares the nav item's `radius nav`, `height 32px`, and `padding 0 10px` (§4.2). **Resting visual:** `background transparent` · **border `1px solid {hairline}`** (unlike the borderless nav items, the toggle carries a resting hairline) · `text {text2}` (Inter 13px) · the leading "☾" is part of the label string, not a separate icon glyph.

- **hover** — `background nav-hover-bg` (the exact nav-item hover; the toggle and nav items share one resting/hover language).
- **focus** — global `{mint}` ring.
- **active / toggle behavior** — **known gap (§16).** The app is dark-native (§0 `mode: dark-native`); there is no light mode to switch into, so the control's *toggled* state, its checked styling, and any theme swap are unspecified. It carries `aria-disabled="true"` with an explanatory tooltip until a second theme exists (§11.3). This block specifies only the resting and hover visuals, which are defined; the behavior is not.
- **error / loading** — n/a (a no-op control has neither).

**Do / Don't.** Don't *fill* the toggle or accent its border to make it look active — at rest its background is transparent and its border is the quiet `1px {hairline}`, not an accent. Do keep it visually quiet (`{text2}` text, `{hairline}` border, `nav-hover-bg` hover) and gate any real toggle behavior on a light theme actually shipping.

### 8.9 Transport bar (playback controls) — DEFERRED

**Not built in v1; this header exists so the references to it resolve, not because the component is specified.** Playback/transport UI (play-pause, tempo, audio on/off) is unbuilt (§16 Known Gaps), so its component contract — background, controls, layout, focus, the play/pause toggle states — is **intentionally deferred** to the release that ships audio. What *is* already specified, and must be honored when this bar is built, is the dot-level **sounding** state (§12.2) and the playback accessibility contract (§11.1–§11.4: the static heavier `{mint}` stroke as the motion-free sounding cue, the `polite` live regions, and the reduced-motion gating). When implemented, the transport bar must reuse existing tokens (no new accent) and obey the focus-ring rule above. Until then there is nothing further to reproduce here.

---

## 9. App Shell & Layout

The shell is a flex row: a fixed-width sticky **sidebar** and a fluid **main** column.

```
.app  (display:flex; min-height:100vh)
├── .side  (width 248px; flex:none; sticky; height:100vh; bg {sidebar}; border-right {hairline})
│   ├── .brand    "Violin Tools."        (period in {mint})
│   ├── .search   opens command palette;  trailing ⌘K chip
│   ├── .sec-h    "Tools"                 (mono, uppercase)
│   ├── .nav
│   │   ├── .ni.active   Scales           (bg {raised}, label {text}, icon {mint})
│   │   ├── .ni.ni-button  Tuner         (live, §17.1 — bg {raised} when active, §8.2)
│   │   ├── .ni.ni-button  Intonation    (live, C9 — bg {raised} when active, §8.2; flag-gated: rendered only when flags.intonation, §18.1)
│   │   └── .ni.soon ×1   Vibrato        ({muted}, "soon" tag, no hover)
│   ├── .spacer   (flex:1 — pushes toggle to bottom)
│   └── .theme    "☾ Dark"               (toggle; border 1px {hairline})
└── .main  (flex:1; min-width:0)
    ├── .topbar   (height 52px; bg {canvas} — inherited from body, no own fill; border-bottom {hairline}; space-between)
    │   ├── .topbar-left   .topbar-search (mobile-only) + .crumb   "Scales / A Major"   (separator {hairline3}; active segment {text2})
    │   └── .topbar-right  .ghost-status (✓ + {text2} caption, aria-hidden) + .ghost  "Share scale"  (#88 — wired to adaptive Web Share + ?r=&s= deep link, §8.4/§16)
    └── .content  (max-width 880px; padding 26px 32px 60px)
        ├── .kicker    "Scale map"        (mono, uppercase, {mint})
        ├── .toolhead  H1 scale name  +  interval formula   (baseline-aligned, space-between)
        ├── .controls  surface card, four rows:
        │   ├── Root    12 chromatic-root pills
        │   ├── Scale   Major · minors · pentatonics · Chromatic   ("Pentatonic" → "Pent.")
        │   ├── Refs    [Tapes][low 2][3-tape] ({tape})  ·  [Landmarks] ({teal})
        │   └── View    [Orientation Auto/Vertical/Horizontal] · [Density Auto/Fit/Comfort] · [Handedness Right/Left]
        ├── .panelcard → .panel → <svg id="board">   ← THE NOTE MAP
        ├── .caveat     reference-layer explanation ({tape})
        └── .legend     root · in scale · not in scale · beginner tape · landmark

.overlay  (fixed; inset:0; z-index:50; scrim {overlay-scrim} + blur 2px)
└── .palette  (560px modal; shadow {elevation.modal})
    ├── .psearch   search icon + input + "esc" chip      (border-bottom {hairline})
    ├── .presults  grouped jump targets (Scales / Tools); max-height 48vh   (no own divider)
    └── .pfoot     ↑↓ navigate · ↵ open · ⌘K toggle       (border-top {hairline})
```

**The Refs row is the map's control surface.** The three `{tape}` pills drive the beginner tape overlay (on/off; "low 2" spelling; 3-tape vs 4-tape); the `{teal}` "Landmarks" pill toggles the octave + heel bands together. A pill that is unavailable in the current combination uses `.dim` (opacity `.4`, `pointer-events:none`) rather than disappearing — for example, "low 2" dims when tapes are off or 3-tape is active.

**The command palette is the primary way to move.** ⌘K (or Ctrl-K) toggles it; clicking the sidebar search opens it; Esc or a backdrop click closes it. Results are grouped (Scales, Tools); each row has an icon, a label, and a trailing `↵` or a `soon`/`open` meta tag. Choosing a scale row sets root + scale and closes the palette.

### 9.1 Controls card — every pill, in display order

The controls card has four rows (Phase 4, #78 — the desktop card gained the View row; before Phase 4 it carried only the first three). The **Root** and **Scale** rows are each one ARIA **radiogroup** (single-select), the **Refs** row is an ARIA **`group` of `checkbox` pills** (multi-select — four independent toggles, any combination valid), and the **View** row is **three independent ARIA radiogroups** (Orientation / Density / Handedness — each single-select, one `role="radio"` `.pill` per option), see §11.3. In all rows (Root, Scale, Refs, and the three View segmented groups), **arrow-key / focus order follows the left-to-right order below** — so the sequence is load-bearing, not cosmetic (the Refs checkboxes are independently Tab-focusable rather than roving, but the displayed order is still authoritative). Pill visuals resolve in §8.1; this is the *content* contract (which pills, what label, in what order).

**View row layout (S17).** The View row keeps a single **`View` `.lab`** (the §3 row label, 52px, `{text3}`) aligned with Root/Scale/Refs; inside its slot the three controls stack as **captioned sub-rows** (`.view-subrow`), each pairing a **visible caption** (`.view-cap` — Orientation / Density / Handedness) with its `.pill-track`. The caption is a sub-label one level below `.lab` (UI family, 11px/500, sentence-case, `{text3}` — §2.5 exempt) and **names its radiogroup via `aria-labelledby`** (not a hidden `aria-label`), so sighted and AT users get the same name. The three sub-rows sit at the controls inter-row rhythm (§4.2 `space-300`). This is required: without the captions the three tracks are indistinguishable (Orientation and Density both lead with **Auto**). The two surfaces lay each sub-row out differently so the three controls read **consistently within each surface** (no caption-length drift, no left/right mismatch between controls): on the **desktop card** the `.view-cap` is a **fixed-width caption column** (sized to the longest caption, "Handedness") with the pill track **left-aligned beside it**, so all three tracks start at the same x and read as one aligned column; in the **mobile sheet** each sub-row **stacks the caption above a full-width pill track** (`flex-direction: column`) — the double indent (the `View` `.lab` gutter + a beside-pills caption column) leaves too little width at 390px for the widest control (Orientation: Auto/Vertical/Horizontal) to sit beside a caption without wrapping, so stacking gives every control the same shape (caption line + full-width pills, §10 narrow-column form). The same shared `ViewRow` renders both surfaces.

**Root** — 12 pills, ascending chromatic order from C, using the violin enharmonic spellings of §13 (`Bb` not `A#`, `Ab` not `G#`, `F#` as the default sharp-side choice). Full sequence:

> `C` · `Db` · `D` · `Eb` · `E` · `F` · `F#` · `G` · `Ab` · `A` · `Bb` · `B`

Four of the five accidental roots (`Eb`/`F#`/`Ab`/`Bb`) take the *default* spelling shown above in **every** scale. The fifth, **`Db` (pc 1), is the first context-dependent pill label (S15):** it reads the default `Db` for the **major family** (Major, Major Pentatonic) and Chromatic, but flips to **`C♯`** for the **minor family** (Natural / Harmonic / Melodic minor, Minor Pentatonic) — because D♭ minor is an 8-flat key with a `B♭♭` 6th, universally spelled as **C♯ minor** (4 sharps, no double accidental, per §13). The flip is label-only: it changes no pitch class, only the displayed/spoken spelling, and the pill, the H1/breadcrumb, and the map dots all resolve through the same `spell(rootPc, root, scale)` so they can never disagree. The build's spelling is deterministic: `spell()` (§0 logic, mirrored in §13) picks the **flat** set when the root name contains a flat or is `F`, otherwise the **sharp** set, *then* applies the §13 minor-family re-spelling — so `F#` and `Bb` are the only two accidental roots whose *as-a-key* spelling a violinist routinely re-spells via the *additive secondary sub-label* (a separate affordance from the `Db`→`C♯` family flip), and they are the two **genuinely ambiguous pairs**:

> **`F#` ⇄ `Gb`** and **`Bb` ⇄ `A#`**

The other three accidentals (`Db`, `Eb`, `Ab`) get **no** additive secondary sub-label — `Eb` and `Ab` have one overwhelmingly conventional violin spelling each, and `Db`'s only context-dependence is the §13 minor-family family flip above (`Db`/`C♯`), which is a re-spelling of the single label, not a second simultaneous spelling shown beside it. For the two genuinely ambiguous roots the alternative is **additive, never a default change**: the pill keeps its default glyph (`F#`, `Bb`) as the large label and renders the alternative as a **smaller secondary spelling beneath it inside the same pill** (e.g. `F#` over a `Gb` sub-label), set in the pill text role one step down; it does not alter which pitch class is selected, and it is announced to AT as the spoken default (§13). **Surfacing-status note:** this dual-spelling sub-label is *specified here but not yet in the v1 build* — the current mock renders only the single default glyph per pill (see §16 known gaps). Reproducing v1 shows the default only; the secondary sub-label is the documented next step for these two roots.

**Spoken / ARIA name (§11.3, S15).** A root pill's accessible name is its displayed spelling spoken in plain speech (§13: "C sharp", not "C#"). For the pc-1 root that name is therefore **context-dependent too**: it speaks "D flat" under the major family + chromatic and "C sharp" under the minor family — the spoken/ARIA name flips with the same family rule as the visible label (and never reaches "B double flat", since no minor key carries the `B♭♭` anymore). The pill's text content *is* its accessible name, so the flip reaches assistive tech with no separate `aria-label`.

**Scale** — the scale-family pills, in this order, with their exact truncated labels (truncation only where the full name would overflow the pill; the parenthetical is the rendered text):

| # | Scale | Pill label |
|---|---|---|
| 1 | Major | `Major` |
| 2 | Natural minor | `Nat. minor` |
| 3 | Harmonic minor | `Harm. minor` |
| 4 | Melodic minor | `Mel. minor` |
| 5 | Major pentatonic | `Major Pent.` |
| 6 | Minor pentatonic | `Minor Pent.` |
| 7 | Chromatic | `Chromatic` |

"minors" in the §9 tree = the three at #2–#4 (Natural, Harmonic, Melodic); "pentatonics" = the two at #5–#6 (Major, Minor). The "Pentatonic" → "Pent." truncation applies to both pentatonic labels; "minor" stays full while its qualifier abbreviates (`Nat.`/`Harm.`/`Mel.`). Seven pills total.

**Refs** — 4 pills in this order, in two visually-grouped clusters (the three `{tape}` pills, then the one `{teal}` pill):

> `Tapes` · `low 2` · `3-tape`  ·  `Landmarks`

`Tapes` toggles the tape overlay on/off; `low 2` switches tape 2 from `+4` to `+3`; `3-tape` drops tape 2 entirely (4-tape ↔ 3-tape). `Landmarks` toggles the octave + heel bands together. `low 2` and `3-tape` `.dim` (§8.1) whenever `Tapes` is off, and `low 2` also dims while `3-tape` is active (§9 prose above).

**View** — three segmented controls in this display order, each a single-select group whose options are exactly as `ViewRow` ships:

> **Orientation** `Auto` · `Vertical` · `Horizontal`  ·  **Density** `Auto` · `Fit` · `Comfort`  ·  **Handedness** `Right` · `Left`

The active segment reflects the **stored choice**, not the resolved render: `ViewRow` highlights `mapView.mode` / `mapView.density` / `mapView.handedness`, so **`Auto` stays selected even when it resolved to `Horizontal`/`Vertical`** (or `Fit`/`Comfort`) under the §10/§12.1 auto rules — the row never reflects the resolved orientation back as a manual choice. Each control is an ARIA `role="radiogroup"` of `role="radio"` `.pill` options wired to the `useMapView` setters and **persisted** (the stored `mapView` is read back at first paint). This is the **same `ViewRow` component the mobile bottom sheet mounts** (§10) — a shared row, not a desktop-only variant; a manual choice made on either surface persists and is reflected on both. The orientation/density that actually renders is resolved per §12.1 (`axisOf`) and §10 (the auto trigger); cross-ref §16.

---

## 10. Responsive Behavior

> **S16 ph3 (mobile model — current).** Below `760px` the 248px sidebar is **hidden**, the mobile **top-bar search trigger** opens the command palette, and the controls collapse to a SINGLE **non-modal bottom sheet** whose always-visible **peek band IS the summary**: a bottom-pinned **peek header** (drag-grip + the summary text "A Major · Tapes" + an expand chevron) is the one trigger — activating it expands the sheet UPWARD to reveal the body (Root a 4×3 grid · Scale · Refs · the **View row** — orientation/density/handedness). There is **no separate in-flow summary bar** (the redundant top "A Major" was consolidated into the peek header in this refactor). The off-canvas drawer was dropped. The per-element table, the breakpoint table, and the bottom-sheet motion paragraph below describe this shipped model. **S16 Phase 4 (#78) shipped the desktop View row** — the desktop controls card now carries the same orientation/density/handedness toggles as the mobile sheet (one shared `ViewRow`). S16 is complete.

The shell is designed desktop-first and **reflows to a real single-column mobile layout** below one breakpoint (S11; the mobile surface re-authored in S16 ph3). This is no longer a "narrow floor placeholder": below `760px` the 248px sidebar is hidden (the off-canvas **drawer** it used to become was **dropped in S16 ph3**), the content column and note-map plate take the full viewport width, the controls collapse to a single **bottom sheet whose peek header IS the summary** (it expands up to the full controls body), and **the page never overflows horizontally** — the headline invariant is `document.scrollingElement.scrollWidth <= clientWidth` at `390px` **and `320px`** (the historical 458px overflow is gone). The desktop layout at and above the breakpoint is unchanged.

**Auto vertical note map on mobile (S16 ph2).** A second, orthogonal axis to the shell reflow above: the note map itself **auto-rotates to its vertical render in portrait** so it fits the viewport width instead of horizontally scrolling a 760px-wide SVG. The breakpoint trigger is `matchMedia('(orientation: landscape)')`, read in `useMapView` (via `useIsLandscape`): portrait (not landscape) → vertical; landscape → horizontal. The CSS that delivers it is `.board[data-orientation='vertical'] { min-width: 0 }` (`apps/web/src/shell/shell.css`) — the vertical viewBox is intrinsically narrow (`0 0 352 850`, §12.1) but would still paint at the `760px` horizontal floor without this override. **AUTO is the default**; **S16 ph3** added the **mobile** manual orientation/density/handedness toggle set (the bottom-sheet **View row** — §16, and the line-873 status note above). **S16 Phase 4 (#78) added the matching desktop View row** in the controls card (same orientation/density/handedness toggles, the shared `ViewRow` component).

| Breakpoint | Behavior |
|---|---|
| ≥ 760px (`shell-min-width`) | **Full desktop shell:** the 248px sticky sidebar + fluid main; controls card and note-map plate at natural width; no drawer trigger; the note map renders **horizontal** (`0 0 760 264`) and fits without the plate needing to scroll. The controls card now also carries the **View row** (manual orientation/density/handedness, the same shared `ViewRow` as the mobile sheet — S16 ph4), so desktop is **no longer AUTO-resolution-only**: a manual orientation/density/handedness choice is available here too. (In a wide-but-short *landscape* viewport narrower than the 760px board, the horizontal map scrolls inside its `overflow-x:auto` plate — that is the desktop/horizontal scroll story; on a portrait phone the map is vertical and does not scroll, below.) |
| < 760px (`shell-min-width`) | **Mobile reflow:** the shell stacks to one full-width column. The 248px sidebar is **hidden** (its off-canvas drawer was dropped in S16 ph3); the top bar carries a mobile **search trigger** that opens the command palette; the content + topbar tighten their side gutters to `space-400` (16px); the controls collapse to a single **non-modal bottom sheet whose peek header IS the summary** (drag-grip + summary text + expand chevron — no separate in-flow summary bar), which expands UP to host Root (a 4×3 grid) · Scale · Refs · the **View row** (orientation/density/handedness); the note map renders **vertical** (auto, portrait → `0 0 352 850`) and **fits the viewport width with no horizontal scroll** — `.board[data-orientation='vertical']{min-width:0}` lets the plate (`.panel`, `overflow-x:auto`) shrink to viewport width instead of holding the `760px` floor, so neither the page nor the plate scrolls horizontally (no `320`/`390px` overflow). |

**Per-element behavior below the breakpoint (the load-bearing three):**

| Element | < 760px behavior |
|---|---|
| Sidebar (248px) | **Hidden below 760px** (the off-canvas drawer was dropped in S16 ph3). The `<header class="side">` rail is `display:none` below the breakpoint (`apps/web/src/shell/shell.css`), so its search / nav / theme leave the tab order + a11y tree at this width (the mobile top-bar search becomes the sole "Search scales and tools" button). Navigation/search is reached via the **top-bar search trigger → command palette** (`apps/web/src/shell/Topbar.tsx`). `useDrawer.ts` is **retained** — it now drives the controls bottom sheet (open/close + Esc + focus-return), and stays available for a future bottom tab bar. |
| Page H1 (32px scale name) | **Unchanged — stays 32px `lh-tight`.** The full-width single column gives it room; if a very long name overflows a narrow column it wraps at `lh-tight`. (No type step-down is defined; the reflow frees width rather than shrinking type.) |
| Topbar (52px) | **Height unchanged at 52px**; its side padding tightens to `space-400` (16px) to match the content gutter, and it gains a mobile-only **search trigger** on the left (`.topbar-search`, a 44px pointer target via a centered `::before` hit-pad) that opens the command palette — **no hamburger** (S16 ph3 dropped the drawer). The trigger is `display:none` at/above the breakpoint so it never coexists with the sidebar search on desktop (`apps/web/src/shell/{Topbar.tsx,shell.css}`). The breadcrumb may truncate before the `{ghost}` button wraps; the bar does not shrink vertically. |

**Bottom-sheet motion (§7).** The non-modal controls sheet slides peek↔expand as the transitions-dev panel-reveal (07) **technique**, applied **transform-only on `translateY`** — #07's stock opacity-fade and filter-blur are deliberately dropped so the always-visible peek band (the **peek header** that IS the summary) stays legible (`opacity` stays `1`, no blur), the same trim the in-tree tape slide uses. The transform is driven by `data-open` on `.controls-sheet` (`.mc-sheet` carries it), interpolating `translateY(calc(100% - var(--sheet-peek-h)))` (peek) ↔ `translateY(0)` (expanded), with `transition: transform var(--state-color) var(--ease-standard)` — the §7 `--state-color` (200ms) duration and the standard ease, **no spring** (a bounce on a panel enter reads as jitter; §0's spring/overshoot easings are guarded "never chrome") and **no motion library**. The peek header's **expand chevron** flips (`rotate(180deg)`) on the same `--state-color`/`--ease-standard` pair, transform-only. The sheet is **non-modal**: it sits at `z-index:40` (a peer of the removed drawer, below the palette overlay at `z-50`), ships **no full overlay scrim**, and the page behind it stays live — dismissal is the peek-header toggle + `Esc` + the explicit **Close** button (`apps/web/src/controls/MobileControls.tsx` via `useDrawer.ts`). The slide is gated on `prefers-reduced-motion: reduce` (§7.4) — under `reduce` the sheet snaps peek↔expand with no slide and the chevron flips with no rotate tween (the end-state transforms still apply). The `--sheet-peek-h` (52px) token is §0 (`apps/web/src/controls/controls.css`).

**Touch targets.** The WCAG 2.5.5 target is **44×44px** for any pointer target. Pills (30px) and nav items (32px) keep their compact visual box; **the transparent hit-padding ships (S10)** — a transparent `::before` overlay (`apps/web/src/styles/a11y.css`) centered on each pill / nav item / theme toggle grows the tap area to the `{touch-target-min}` (44px) floor while the painted box stays at 30px / 32px. The expansion is pointer-area only; it changes no layout and no visual size.

**No-overflow invariant.** The page's `scrollingElement` must not scroll horizontally at `390px` **or `320px`** (`scrollWidth <= clientWidth`) — and on a portrait phone the note-map plate (`.panel`) must not scroll horizontally either (its `scrollWidth <= clientWidth`), because the vertical map fits viewport width via `.board[data-orientation='vertical']{min-width:0}` (above). Both checks are verified live in `apps/web/e2e/responsive.spec.ts`. The horizontal `760px` min-width is scoped to the **desktop/horizontal** render: on a wide-but-short landscape viewport the horizontal board is the one horizontally-scrollable element inside its `overflow-x:auto` plate; on a portrait phone nothing scrolls horizontally — neither the page nor the plate.

---

## 11. Accessibility

Accessibility is structural. Two commitments are load-bearing: **non-color redundancy** and **adequate contrast**. The note map is the product's primary artifact, so a contrast failure on it is a ship blocker. (Measured contrast pairs live in §2.5.)

### 11.1 Color is never the only signal (WCAG 1.4.1)

| Distinction | Color cue | Redundant non-color cue |
|---|---|---|
| Root / in-scale / off | mint solid / mint outline / near-black | **radius** 15 / 14 / 6 + label present-vs-absent + glow ring on root |
| Open vs. stopped note | same hue family | shape: open uses a transparent ring, stopped a filled dot; stroke weight |
| Tape vs. octave vs. heel | `{tape}` / `{teal}` / `{violet}` | distinct band **positions + labels** ("2 (+4)", "octave ◈", "heel ⌄") and legend swatches of differing shape |
| Active vs. inactive control | accent tint + border | text weight/color shift + active class, announced to AT |
| Currently sounding note (playback) | accent stroke | a **static, always-on heavier stroke** (no motion required) + an `aria-live` spoken announcement. **No pulse animation ships in v1** (§7.5); were one ever added it would be additive only and gated on motion preference — it could never become the sole cue |

### 11.2 Contrast (WCAG 1.4.3) — load-bearing

- **Label text on a non-root dot** must clear **AA at small sizes**: light label (`scale-label`, `#ffffff`) on `in-scale-fill` composited over `{panel}` measures **14.67:1** (§2.5) — comfortably AAA. The invariant being protected is that the dot fill stays *dark*: `in-scale-fill` is low-opacity mint over near-black, so it composites to `#112d29`. An earlier draft used a *lighter* dot background that dropped this pairing below the AA floor; that regression must not return — keep the fill at `{mint-500} @ 13%` over `{panel}`.
- **Text inside the root dot** is fixed at `root-label` (`#08130f`), giving **9.86:1** on the solid `{mint}` fill (§2.5). This color is **never** overridden to white.
- **Any guide/landmark number that conveys meaning** clears ≥4.5:1 against its background; purely decorative guide lines do not, and are marked `aria-hidden` when implemented.

Treat shipping an uncorrected lighter dot background as a P0 blocker — it would fail 1.4.3 on the tool's central visual.

### 11.3 Structure, keyboard, live regions

- **The note map is one composite widget**, not a flat list of tab stops. It uses a **roving tabindex**: exactly one marker is tabbable at a time (initially the root); arrow keys move focus through the same pitch order in both orientations, but the **arrow-key → screen-direction mapping follows the current render orientation** (§12.1) and is re-bound on a rotation — so Up/Down and Left/Right always match what the user sees (along-string vs. cross-string swap between horizontal and vertical). Enter/Space sounds the focused note; Tab exits the whole widget.
- **The single-select selectors** (root, scale) follow the ARIA **radiogroup** pattern: each is one `radiogroup` of `radio` pills with a roving tabindex, arrows move selection within the group, Tab exits, selection follows focus. **The Refs selector is multi-select** — four independent reference-layer toggles can each be on or off in any combination — so it is an ARIA **`role="group"` of `role="checkbox"` pills**, *not* a radiogroup: each checkbox is independently Tab-focusable, Space toggles it, and `aria-checked` reflects its own boolean (a radiogroup would announce "radio button, 1 of 4" and falsely tell a screen-reader user only one Refs layer can be active). The §9.1 left-to-right order is still authoritative for both patterns.
- **ARIA label strings (the accessible names to ship, verbatim).** These are the expected `aria-label` / accessible-name values so a reproducer does not invent them:
  - Root radiogroup → **"Root note"**; Scale radiogroup → **"Scale type"**; Refs `group` (of checkboxes, per the bullet above) → **"Reference layers"**.
  - The View row's three single-select radiogroups → **"Orientation"**, **"Density"**, **"Handedness"** (each on both the desktop controls card and the mobile sheet).
  - The note-map composite widget (the `<svg id="board">` group) → **"Full fingerboard note map"** (the build's existing `aria-label`).
  - The command palette (dialog) → **"Scale search"**; its input → **"Search scales and tools"**; its results list → `role="listbox"` labelled **"Results"**.
  - Each note marker's accessible name is its spoken note name (§13, "C sharp"), suffixed with state for non-visual users — e.g. **"C sharp, root"**, **"E, in scale"**, **"F, not in scale"**.
- **Live regions are `polite`, never `assertive`.** During playback a polite region announces the current note name; a second polite region carries a full string-by-string text description of the map, refreshed on each scale change; a **third** (#88) carries the §16 **Share-scale copy outcome** ("Link copied to clipboard"). (Polite is correct: rapid playback would otherwise interrupt screen-reader speech many times per second.) The map's text description lives in an external element, **not** inside the SVG, because SVG `<desc>` does not reliably support live updates across major screen-reader/browser pairings. **The Share region speaks the COPY branch only** — a bare `navigator.share()` resolve cannot confirm a share happened (so it announces nothing), and a dismissed sheet (`AbortError`) is silent; the visible `.ghost-status` caption beside the button is `aria-hidden`, so exactly one node speaks the action and the result never steals focus.
- **Basics:** a skip link to the map; `<header>`/`<nav>`/`<main>` landmarks; `lang` on the document; every stub affordance (`soon` tools, the non-functional theme toggle) carries `aria-disabled="true"` with an explanatory tooltip.

### 11.4 Reduced motion

Motion is opt-in: the default honors the OS setting, and every transition and keyframe (dot morph or pop, band fades, palette scale-up, any sounding-note pulse) is gated on `prefers-reduced-motion`. Under `reduce`, the static heavier stroke on the sounding note is its sole, motion-free indicator, and the interface is fully usable and legible. The orientation flip (§12.1) snaps instantly in every motion mode, `reduce` included — the canonical contract for that is §7.4.

---

## 12. The Fingerboard Note Map (signature component)

This is the product's heart and its hardest-working surface. It is a single inline **SVG** that renders the **whole neck**: the four strings render as lines along one axis (desktop is horizontal by default; on mobile the map auto-rotates to vertical — §12.1), semitone positions as columns crossing them, and a note dot at every string × position. Dots morph between three states (off / in-scale / root); the sounding state adds a heavier stroke during playback. Optional `{tape}` tape bands and `{teal}`/`{violet}` landmark bands sit behind the dots and toggle independently. **The geometry is in §12.1, the dot visuals in §12.2, and the pitch model + the exact off/in-scale/root classification rule in §12.5 — together they let the whole 60-dot map be rebuilt from this file alone, with no outside scale reference.**

### 12.1 Canvas & coordinate system

- **viewBox — two orientations, one geometry.** The **horizontal (desktop default)** viewBox is `0 0 760 264`, rendered `width:100%`, `height:auto`, `min-width:760px` inside the horizontally-scrollable plate (`.panel` `overflow-x:auto`). The **vertical (mobile auto)** viewBox is `0 0 352 850` (`= axisOf({vertical, right, comfort}).viewBox`): the neck axis runs *down* the page and the strings sit across it. The vertical render **fits the viewport width with no `760px` horizontal scroll on a phone** because `.board[data-orientation='vertical']` drops `min-width` to `0` (the horizontal default keeps the `760px` floor) — see §10. The two literals are the only place these numbers live; §10 and §16 reference them, never restate them. Both viewBoxes are emitted by the same `axisOf()` resolver, so the map stays reproducible from this file: the horizontal literal `= axisOf({horizontal, right, fit}).viewBox`. Which orientation renders is resolved automatically by default; a manual orientation toggle ships in the mobile bottom-sheet **View row** (S16 ph3 — §16; AUTO is the default), and the auto trigger is named in §10.
- **Strings (horizontal layout).** The coordinates below describe the **horizontal** render — lines in perfect-fifth tuning, each drawn `x1:60 → x2:724`, stroke `string-line`, width `1.5`:

  | String | Pitch class | y |
  |---|---|---|
  | E5 | 4 | 68 |
  | A4 | 9 | 114 |
  | D4 | 2 | 160 |
  | G3 | 7 | 206 |

- **Nut** — `rect x=58 y=62 width=5 height=150 fill=string-line` (no radius).
- **Position-column x** — the **column index `o` runs `0 … NMAX − 1`** (`NMAX = 15`): `o = 0` is the **open string** at `x = 42`; the **14 stopped columns** are `o = 1 … 14` at `x = 96 + (o − 1) × 44`. So each string has `1 open + 14 stopped = 15` columns, and `NMAX` *is* that per-string column count, **not** a separate higher bound than the `o`-range — the apparent ambiguity is resolved here: `o`'s maximum stopped value is `NMAX − 1 = 14`. Reproduce both formulae exactly; the band rects and labels all key off them.
- **Position guide lines** — one vertical per stopped column, `y1:62 → y2:212`, stroke `guide-line`, width `1` (1px hairline, no radius).
- **String-name labels** — Inter 11px/600 `string-name` at `x=24`, **`y = S.y + 4`**, `text-anchor:middle` (the build uses a +4px optical-center offset on `y`, **not** `dominant-baseline`; do not add `dominant-baseline:middle` or the label will sit too high). **"open" label** — Inter 10px/400 `open-label` at `(42, 252)`.

**Vertical layout (mobile auto) — the x/y-transposed projection.** The vertical render is the horizontal layout with its two axes swapped: the neck axis (open → stopped columns) runs *down* the page and the four strings spread *across* it. Each chrome element maps through that transpose — string lines run vertically, the nut bar runs across the open end, position guides run across the strings, dots relay out to the new `cx`/`cy`. **Labels stay UPRIGHT** (`<text>` keeps a plain `{x, y}` anchor, no rotation): a naive single 90° `rotate()` on the whole group would tip every note name and string name on its side, which §3/§8 forbid — so the build transposes anchor *positions* but never rotates glyphs. The **vertical string-name labels move into the cross/neck margin, clear of the open-column dot** — the horizontal `+4` optical y-offset is calibrated for a baseline beside a horizontal row and **does not apply** in vertical; the vertical name sits in the cross margin level with the open dot, never overlapping it.
- **Persistent nodes are orientation-invariant.** The 60 nodes (below) are the *same* nodes in both orientations — a flip changes only each node's `cx`/`cy`, never the node set (morph, not rebuild — §7). The vertical-comfort render lays out **all 60** relaid-out, not fewer.

The map holds **60 persistent note nodes** — `4 strings × NMAX columns = 4 × 15 = 60`, where the 15 columns are the 1 open + 14 stopped of the formula above. On a scale change each node is re-classified and morphs in place — never destroyed and rebuilt (§7).

### 12.2 Dot states

| State | Shape | Fill | Stroke | stroke-width | r | Label |
|---|---|---|---|---|---|---|
| **Off** (not in scale) | circle | `off-fill` | `off-stroke` | `1` | `6` | none |
| **In scale** | circle | `in-scale-fill` | `{mint}` | `1.5` | `14` | note name, Inter 12px/500 `scale-label` |
| **Root** | circle | `{mint}` solid | none | `0` | `15` | note name, Inter 12px/700 `root-label` |
| **Root glow** (ring behind root) | circle | none | `root-glow` | `3` | `19` | — |
| **Open string** (column 0, `x=42`) | circle | per its current state | per its current state | per its current state | per its current state | per its current state |
| **Sounding** (active during playback) | a 4th persistent `<circle class="sound">` overlaid on the dot (state dot untouched) | none | `{mint}` | `3` | = dot's current `r` (14/15) | — (label is the dot's own) |

**The open string is not a special visual state — it participates fully in scale classification.** The note at column 0 is built identically to every other node and takes the normal **off / in-scale / root** treatment (and the **root glow** if the open string *is* the root). So an open string that is in the scale shows the in-scale dot (`r=14`, mint outline, note name); an open string not in the scale shows the off dot (`r=6`, `off-fill` + `off-stroke` ring); an open root shows the solid mint root dot + glow. The "transparent ring" language in §11.1 describes that **off**-state appearance generically (near-transparent fill + a thin ring) — it is **not** a permanent open-only override. There is no column-0 styling that bypasses classification.

State is the differentiator at a glance, but it is **always** backed by radius (6 → 14 → 15), by the presence/absence of a label, and by the glow ring on the root. The **sounding** state is purely additive: `r` and `fill` do **not** change from whatever state the note already holds — only a heavier `{mint}` stroke (width `3`, the same weight as the root glow ring) is laid over it as a static, always-on indicator (no motion required; §11.4).

**Sounding overlay — SVG structure (so it is reproducible, not interpretive).** The sounding indicator is its **own persistent child** of the note `<g>`, not a mutation of the state dot and not a `paint-order` trick. Concretely: alongside the existing `glow` / `dot` / `lbl` children (§7.1, §15.1), the note `<g>` carries a fourth child **`<circle class="sound">`** with `cx`/`cy` matching the dot, `r` = the dot's current state radius (14 in-scale, 15 root; it follows the same `r` the dot holds), `fill:none`, `stroke:{mint}`, `stroke-width:3`, `opacity:0` at rest and `opacity:1` only while that note is sounding, and `pointer-events:none`. It sits **above** the dot but **below** the label in document order, so the note name stays legible through it. Toggling `opacity` (not adding/removing the node) keeps it persistent like every other note child.

The root always carries its note name; the root-dot text color `root-label` (`#08130f`) is invariant and is never overridden to white (§11.2).

### 12.3 Reference layers (independent, toggled overlays)

These live in their own SVG groups and animate add/remove independently of the note dots.

All three band rects share **`y=60`, `height=152`, `rx=3`** (they start just above the nut line at `y=62` and span the string field); each is horizontally centered on its column (`x = xOf(offset) − width/2`).

**Tape bands (`{tape}` — beginner homing guides).** Default tapes: 1 at `+2`, 2 at `+4` (or `+3` in "low 2"), 3 at `+5`, 4 at `+7`. Each: `rect y=60 width=26 height=152 rx=3 fill=tape-band` at `x = xOf(off) − 13`; label Geist Mono 9px `tape-num` above the band at `y=48`, **x = the band column center (`xOf(off)`), `text-anchor:middle`**, reading e.g. `2 (+4)`. "3-tape" hides tape 2; "low 2" slides tape 2 from `+4` to `+3` (animated translate) and relabels it.

**Landmark bands.**
- **Heel / position (`{violet}`, 5th position, column offset 9):** `rect y=60 width=28 height=152 rx=3 fill=heel-band` at `x = xOf(9) − 14`; a **dashed underline `<line>`** at `y1=y2=212` running `x1 = xOf(9) − 14 → x2 = xOf(9) + 14` (the full band width), stroke `heel-dash`, **`stroke-width:1`**, `stroke-dasharray:2 3`; italic label "heel ⌄" Inter 8px `heel-label` at `y=226`, `text-anchor:middle`.
- **Octave (`{teal}`, 7th position, column offset 12):** `rect y=60 width=30 height=152 rx=3 fill=octave-band` at `x = xOf(12) − 15`; top label "octave ◈" Geist Mono 9px `octave-label` at `y=48`; bottom label "½ string" Inter 8px `octave-label` at `y=226`; both `text-anchor:middle`.

**Position labels** (below the map at `y=252`, Inter 10px/600 `pos-label`): "3rd pos" (off 5), "4th pos" (off 7), "5th pos" (off 9), "7th pos" (off 12). These exist to make visible that the neck extends well above first position. **They live *inside* the `.land` group** (the build appends them to `landG`, alongside the heel and octave bands), so they **toggle with the Landmarks pill** — when Landmarks is off, the position labels hide with the bands; they are not always-on static text. (This is why §7.5's `.land` opacity/`.hide` toggle governs them too.)

**Vertical projection (both orientations through `axisOf`).** The horizontal coordinates above are the byte-identical desktop render; every band/label is **projected through the same `axisOf` resolver** the dots and static chrome use (§12.1), so the overlays are axis-correct in **both** orientations. The horizontal `y`-literals are re-expressed as **cross-margin relations** (the way `CROSS_PAD`/`CROSS_END_LABEL_MARGIN` work) so they transpose: a band starts `8px` before the first string's cross position and ends `CROSS_PAD` past the last; the lead/trail label margins sit `20px` outside the string field; the position-ordinal margin is `crossExtent − 12` (the same inset the "open" label uses). On the **vertical** render the axes swap: **each band spans the cross axis (across the four strings) and is centered on its column's neck position** (`{x: bandCrossStart, y: neckPos(off) − width/2, width: cross-span, height: bandWidth}`), and the **heel dash is a short segment running ALONG the neck** (spanning the band's width) at the band's cross-END edge — *not* a line across the strings. Every overlay `<text>` stays **upright** (pure `{x, y}` + a `text-anchor`, never rotated).

**Vertical label scheme (Figma `124-2`).** On the vertical map the labels move into the cross-axis gutters: the **tape numbers, the "octave ◈" name, and the "heel ⌄" name all sit in the cross-start (left) gutter** (`text-anchor:start`), level with their neck column — the heel name moves to the lead/left gutter even though it is the *trail* (below) label in horizontal, because its col-9 row is free of tape numbers. The **position labels render in the cross-end (right) gutter** (`text-anchor:end`), **abbreviated to the leading ordinal only** ("3rd"/"4th"/"5th"/"7th") so they clear the end-string dots on a 390px phone (the `pos-label` source text stays "3rd pos"; the vertical branch takes its leading token). The **"½ string" octave-bottom label is OMITTED on vertical** — the right gutter holds the position ordinal at col 12 instead. The horizontal render is unchanged (tape numbers / "octave ◈" above the band, "heel ⌄" / "½ string" below, position labels `text-anchor:middle` at the cross-end). The **"low 2" slide is axis-aware**: tape 2 carries an inline `--low2-dx`/`--low2-dy` shift vector computed from the geometry (horizontal `{−44px, 0}`, vertical `{0, neckPos(3) − neckPos(4)}`) and the §7.5 transform translates by it — transform-only, never an SVG attribute tween (§7.1/§7.5).

### 12.4 Legend (always visible)

Five swatches + labels below the map (Inter 12px `{text2}`; swatch→label gap 7px; between-item gap 16px). The legend is the always-present key, so the diagram needs no external documentation to read:

| Swatch | Shape | Style |
|---|---|---|
| root | 16×16 circle | `background {mint}` (solid) |
| in scale | 16×16 circle | `background in-scale-swatch`, `border 1.5px {mint}` |
| not in scale | 9×9 circle | `background off-fill`, `border 1px off-stroke` |
| beginner tape | 13×16 rect, radius 3px | `background tape-swatch` |
| landmark | 13×16 rect, radius 3px | `background linear-gradient(180deg, {teal}, {violet})` |

### 12.5 Pitch model & dot classification (self-deriving)

This subsection is what makes the note map **reproducible from this file alone**: it gives the data and the single rule that decides whether each of the 60 dots renders **off**, **in-scale**, or **root** (§12.2). Nothing here depends on an outside table.

**Pitch classes are integers 0–11**, C = 0 ascending by semitone: `C=0, C♯/D♭=1, D=2, D♯/E♭=3, E=4, F=5, F♯/G♭=6, G=7, G♯/A♭=8, A=9, A♯/B♭=10, B=11`. (Spelling — which letter name a pitch class is *shown* as — is a separate, letter-correct concern handled by §13; classification uses the integer only.)

**(a) Scale types → semitone-interval sets.** Each scale is a set of semitone offsets from its own root (root = 0). These seven are the entire scale vocabulary (the §9.1 Scale row, in the same order):

| Scale type | Pill (§9.1) | Interval set (semitones from root) |
|---|---|---|
| Major | `Major` | `{0, 2, 4, 5, 7, 9, 11}` |
| Natural Minor | `Nat. minor` | `{0, 2, 3, 5, 7, 8, 10}` |
| Harmonic Minor | `Harm. minor` | `{0, 2, 3, 5, 7, 8, 11}` |
| Melodic Minor (ascending) | `Mel. minor` | `{0, 2, 3, 5, 7, 9, 11}` |
| Major Pentatonic | `Major Pent.` | `{0, 2, 4, 7, 9}` |
| Minor Pentatonic | `Minor Pent.` | `{0, 3, 5, 7, 10}` |
| Chromatic | `Chromatic` | `{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}` |

> Melodic minor uses the **ascending** form (raised 6 and 7); v1 does not render a separate descending (= natural-minor) form. Chromatic contains every pitch class, so under the rule below **no** node is ever *off* in Chromatic — every non-root dot is in-scale.

**(b) Roots → pitch-class integers.** The 12 Root pills (§9.1), each as a pitch-class integer (the *displayed* spelling, e.g. `Bb` vs `A#`, is §13's `spell()`; the integer is what classifies):

| Root pill | pc | Root pill | pc | Root pill | pc | Root pill | pc |
|---|---|---|---|---|---|---|---|
| `C`  | 0 | `E`  | 4 | `Ab` | 8  | — | — |
| `Db` | 1 | `F`  | 5 | `A`  | 9  | — | — |
| `D`  | 2 | `F#` | 6 | `Bb` | 10 | — | — |
| `Eb` | 3 | `G`  | 7 | `B`  | 11 | — | — |

**(c) Each node's own pitch class.** A node sits at (string, columnIndex). The four open strings carry the pitch classes already given in §12.1 (`E5 = 4, A4 = 9, D4 = 2, G3 = 7`), and **each column adds one semitone** (`columnIndex` is the semitone count from the open string: `o = 0` open … `o = 14` the 14th stopped semitone, §12.1). So:

```
nodePc = (openStringPc + columnIndex) mod 12
```

`columnIndex` is a **logical** position index (semitones from the open string), independent of render orientation: the string order `E5 / A4 / D4 / G3` and all the classification math below are identical whether the map renders horizontal or vertical — only each dot's `cx`/`cy` differ between the two (§12.1).

**(d) Classification rule (the whole of it).** Given a node of pitch class `nodePc`, the selected root's pitch class `rootPc`, and the selected scale's interval set `scaleSet`:

```
if   nodePc == rootPc                       → root      (solid {mint} dot, r=15, + root glow ring)
elif ((nodePc − rootPc) mod 12) in scaleSet → in-scale  (in-scale-fill dot, {mint} stroke, r=14, note name)
else                                        → off       (off-fill dot, off-stroke ring, r=6, no label)
```

`mod` is the non-negative remainder (`((nodePc − rootPc) % 12 + 12) % 12` in languages where `%` can go negative). The interval-degree `(nodePc − rootPc) mod 12` is identical for a pitch class whether it appears on an open string or any stopped column, which is exactly why **the open string participates in classification with no special-casing** (§12.2): an open string is just the node whose `columnIndex = 0`.

**Worked check (A Major, `rootPc = 9`, `scaleSet = {0,2,4,5,7,9,11}`).** Open A4 (`pc 9`) → `root`. Open E5 (`pc 4`): `(4−9) mod 12 = 7 ∈ set` → `in-scale`. Open D4 (`pc 2`): `(2−9) mod 12 = 5 ∈ set` → `in-scale`. Open G3 (`pc 7`): `(7−9) mod 12 = 10 ∉ set` → `off` (G♮ is not in A major; the scale's G is G♯) — so the G string's open dot renders **off**, matching §12.2. Reading the in-scale degrees back out as letters gives **A B C♯ D E F♯ G♯** (§13). This is the complete derivation; the 60-dot render is a pure function of `(root, scale)` through (c)+(d).

---

## 13. Voice & Tone

The product writes like a good teacher: states musical facts, cites pedagogy where it matters, and never explains what the player already knows. **No marketing copy anywhere.**

- **Headings** use conventional violin spellings, unqualified: "A Major", "A Harmonic Minor".
- **Root pills** follow violin convention — `Bb` not `A#`, `Ab` not `G#`, `F#` as the default sharp-side choice. Spelling is computed, not hand-keyed: choose the **flat** spelling set when the root name carries a flat or is `F`, else the **sharp** set. An enharmonic alternative is offered for only the **two genuinely ambiguous pairs — `F#`⇄`Gb` and `Bb`⇄`A#`** — and only as an additive secondary sub-label inside the pill (the affordance, and its v1-not-yet-shipped status, is specified in §9.1). The other accidentals (`Db`/`Eb`/`Ab`) get no alternative.
- **Note spelling is letter-correct per scale, and SHIPPED.** The deterministic `spell(nodePc, root, scale)` function (named in §0, living in `@violin-tools/theory`) names every dot label, the H1 heading, and the breadcrumb — so a flat key reads `Bb` everywhere, never `A#`. The convention depends on the scale family:
  - **Diatonic** (Major + Natural / Harmonic / Melodic minor — 7 notes): **one letter per scale degree.** Walk the scale's intervals from the root; each successive degree takes the next letter name (A→B→C→…→G→A), with whatever accidental makes the pitch class correct — so e.g. A Major reads A B C♯ D E F♯ G♯, not A B D♭… The root's own letter and accidental come from the root rule, which is **scale-family-aware (S15):** a root whose minor key would carry a double accidental is spelled with its conventional minimal-accidental enharmonic for the **minor family** (natural / harmonic / melodic minor, minor pentatonic), so **no double accidental is reachable at all**. In the 12-root pill set this affects exactly the pc-1 root: `Db` spells `C♯` under the minor family → **C♯ minor** (4 sharps; C♯ D♯ E F♯ G♯ A B, with the harmonic-minor leading tone `B♯` a single sharp), and keeps the default `Db` for the major family + chromatic. Every other root already has a clean minor key (e.g. `F#` → F♯ minor, `Ab` → A♭ minor with 7 single flats), so the default §9.1 spelling holds; the pc-1 flip is documented as the first context-dependent pill label in §9.1. **Double accidentals are written as doubled single signs (`♭♭` / `♯♯`), never the single Unicode double-flat / double-sharp glyphs (U+1D12B `𝄫` / U+1D12A `𝄪`):** the self-hosted Inter face (§3) covers only `♭` / `♯` (U+266D / U+266F), so were a double ever needed the doubled form would render in-glyph while the single double-accidental codepoints fall back to a platform font or tofu. (The doubled-sign rule is kept as the covered-glyph convention; with the S15 family-aware root rule **no `(root, scale)` in the 12-root pill set actually reaches a double accidental** — the former D♭-minor `B♭♭` is gone, and no double-sharp key was ever reachable since pc 8 spells `Ab`, not `G#`.)
  - **Pentatonics** (5 notes) **inherit their parent diatonic scale's spelling**: Major Pentatonic spells exactly as the Major scale does (A Major Pent → A B C♯ E F♯), Minor Pentatonic as the Natural Minor scale does (A Minor Pent → A C D E G). A pentatonic note never uses a letter its parent scale wouldn't — there is no independent pentatonic spelling, only the inherited one.
  - **Chromatic** (12 notes) is **key-aware**: the 7 pitch classes of the root's **Major** scale take their major-scale letters; the other 5 take the root's accidental side — flats when the root name carries a flat or is `F`, else sharps. So A chromatic uses sharps (… A A♯ B), while B♭ chromatic uses flats (… A♭ A B♭ B — no `A♯` appears, and the root reads `B♭`). Chromatic is the deliberate exception to one-letter-per-degree: a base letter recurs across two pitch classes (a natural and its sharp/flat neighbour), which is correct — chromatic is spelled by accidental side, never forced to 12 distinct letters.
- **The formula** is the teacher's shorthand beside the derivable numbers: `W` / `H` / `A2` / `m3` tokens. The augmented second (`A2`, 3 semitones) in harmonic minor is named **explicitly**, because it is the characteristic interval a student must learn to reach.
- **Characteristic-degree notes** are factual, not motivational — they name the musical consequence (the raised 7th restoring the leading tone and forming the A2 with the b6), never an emotional mood.
- **Caveat copy** (`{tape}`, beside the map) explains the optional layers in plain language and reinforces the core truth: *"Tapes & landmarks are homing guides, not fixed pitch markers — the fingerboard has no fixed divisions, so every position is a valid stopped pitch."* This sentence is doing pedagogical work; keep its spirit.
- **Spoken note names** (for assistive tech) are plain speech: "C sharp", not "C#".

---

## 14. Do's & Don'ts

Each prohibition is paired with the sanctioned move. These exist to override the defaults an agent reaches for by habit.

- **Don't** add a drop shadow to lift a panel. → **Do** raise the surface one step (`{panel}` → `{surface}`) and separate with a hairline. The only heavy shadow in the product is the palette's `elevation.modal` (§5).
- **Don't** introduce a second solid-mint anchor. → **Do** leave the root dot as the lone solid `{mint}` fill; the active-pill `pill-active-wash` is intentionally desaturated so it never competes.
- **Don't** repurpose a functional accent. → **Do** keep `{tape}` = tape, `{teal}` = octave, `{violet}` = position. One color, one job.
- **Don't** set music notation in Inter or UI prose in Geist Mono. → **Do** honor the partition: formula tokens, tape numbers, section kickers, keycaps are Geist Mono — dot note-name labels are Inter (see §3 and §15.1); everything else human-language is Inter.
- **Don't** rebuild the note dots on a scale change. → **Do** re-classify the 60 persistent nodes and let radius/fill/label tween in place (§7.1).
- **Don't** add spring/bounce to chrome or overshoot a button. → **Do** keep the press a flat `translateY(1px) scale(.97)`; reserve `ease-spring` for the dot-radius morph and `ease-spring-2` for the tape slide only.
- **Don't** override the root-dot label color to white. → **Do** keep it `root-label` (`#08130f`); it is the only value that clears contrast on a solid `{mint}` fill (§11.2).
- **Don't** invent intermediate greys. → **Do** use the four text steps and the named surfaces/hairlines as-is. When adding a grey, place it at the suffix its measured luminance demands (higher suffix = darker), never out of order (§0).
- **Don't** edit a hex anywhere but the `primitive` tier — and that includes the `color-alpha` translucents: they are now written `{primitive} @ N%`, so re-theming a base hue flows through them automatically and there is **no** raw RGBA brand literal to chase. The resolved `rgba()` in each `color-alpha` comment is *generated output*, not a second source of truth — never hand-edit it. → **Do** change one primitive and let the semantic / component / alpha aliases carry it (§0). The sole sanctioned exception is the 15 single-use note-map `ink-*` primitives (`[ink→primitive]`, §0): a one-line edit to the `ink-*` primitive itself is correct and re-themes that SVG mark — that is still the primitive tier, not a call-site hex.
- **Don't** imply the neck has fixed pitch divisions — in words or visuals — or draw fixed dividers across the fingerboard. → **Do** say "position", "semitone column", "fingerboard", and render guides as `{tape}`/landmark *homing bands*, never as fixed pitch markers.
- **Don't** gate legibility on animation. → **Do** keep every state distinguishable when motion is off; the static heavier stroke is the sole sounding indicator under `reduce`.

---

## 15. Worked Examples — calibration anchors

Two assembled surfaces to diff your output against: **§15.1 the SVG cell** (the note map's hardest-working unit, exercising the SVG tokens) and **§15.2 the chrome counterpart** (a palette row, exercising the chrome tokens — surface, radius, padding, text token, icon column, meta chip). Together they bracket the two token systems in the product.

### 15.1 SVG surface — an in-scale note cell

Diff your output against this. It is one in-scale note dot (e.g. C# on the A string in A Major), assembled entirely from tokens above.

**Correct:**
- Wrapper `<g class="note is-scale">` holding three persistent children: `glow`, `dot`, `lbl`.
- `dot`: `<circle r=14 fill=in-scale-fill stroke={mint} stroke-width=1.5 cx=… cy=…>`.
- `lbl`: note name, Inter 12px/500, `fill=scale-label`, `text-anchor=middle`, baseline at `cy + 4` (no `dominant-baseline` — match §3), `font-feature-settings: 'tnum'` (`features-ui`), `opacity:1`.
- `glow`: `opacity:0` (present but invisible — it shows only in the root state, promoted by `.note.is-root .glow { opacity:1 }`; this in-scale node keeps it at 0).
- Transitions present on the node so a later state change tweens in place: `r 230ms ease-spring`, `fill/stroke 200ms ease`, `lbl opacity 160ms`, `lbl fill 190ms`. `transition-delay = columnIndex × 6ms`.

**Incorrect — do NOT:**
- add any drop shadow or blur to the dot (depth here is hairline + fill only);
- fill the dot solid `{mint}` (that is the root state alone) or color the label `root-label`/white-on-solid;
- render the label in Geist Mono… *wait* — note names **are** the one music token, so Inter is correct here; use Geist Mono only for the tape/octave numerals, not the dot's note name. (Resolve any ambiguity in favor of §3's note-map row.)
- destroy and re-create the node on a scale change instead of re-classing it;
- give the dot a non-circular radius or a hover-grow — note dots have no hover state (§8.1).

### 15.2 Chrome surface — a command-palette row (the chrome counterpart)

The chrome counterpart to §15.1: one selected row in the command palette's results (e.g. the "A Major" jump target under the **Scales** group). It exercises the chrome tokens the SVG cell does not — `{raised}`, `control` radius, the palette row text token, the `18px` icon column, and the trailing meta chip — in a single block.

**Correct:**
- Row box: `radius control` (8px) · `height 40px` · `padding 0 11px` · `gap 11px` · `display:flex; align-items:center` (§4.2, §8.5).
- **Selected/hover state:** `background {raised}` — the one shared fill for keyboard selection *and* pointer hover (they never diverge).
- Leading **icon column `18px`** (`icon.box.palette`): the `♪` Unicode glyph (the Scales-group marker, §0 `icon.glyph-char`) centered in the span, color `{text3}` — and because this is the **selected** row, promoted to `{mint}` by `.pitem.sel .pico`. It is a character set as text, not a drawn SVG.
- **Label:** "A Major", Inter 14px/400, `fill/color = string-name` (`#cfcfd4`) — human language, so **Inter**, not Geist Mono.
- **Trailing meta chip:** the `↵` enter glyph, Geist Mono 11px `{text3}` (a `soon` target would instead read `soon` in `palette-soon`; an already-open target reads `open`).

**Incorrect — do NOT:**
- set the label in Geist Mono — the palette label is human language (reserve mono for the *meta* chip and note/technical values, §3, §8.5);
- give the row its own focus ring inside the modal — selection is the `{raised}` fill alone, with no second ring (§8.5);
- use a different fill for hover vs. keyboard-selected — they are one shared `{raised}` state;
- add a shadow or border to lift the row — depth inside the palette is the `{raised}` fill only; the single product shadow belongs to the palette *modal*, not its rows (§5);
- render "No matches" or a skeleton loader in this same row style with mono type — the empty/loading states are Inter and are specified separately (§8.5).

---

## 16. Iteration Guide & Known Gaps

**Editing this file (treat it as code):**
1. Change a value in the **`primitive` tier** of the Token Manifest first; never hard-code a hex in prose or markup, and never edit a semantic/component token's literal (edit the primitive it aliases).
2. One component per change; keep the diff reviewable.
3. Add a new variant as a new row/entry, not by mutating an existing one.
4. Re-run the contrast check (§2.5 / §11.2) on any color touch before merge; the root-dot and non-root-label pairings are P0.
5. Keep the two type families partitioned (§3); adding a third typeface is a spec change, not a tweak.
6. Preserve "morph, never flash" (§7) and the `prefers-reduced-motion` fallback on any new animation.
7. Gate visual PRs on updating this file: if the build and this document disagree, that is the bug — this is the same currency duty AGENTS.md states under "Keeping docs and drift-prone files current".

**Shipped in v1 (live at https://strings-solo.com — these surfaces are built, not just specified):**
- The full **Scales note map** — the whole-neck fingerboard SVG, the §12.5 pitch classification, and the §13 letter-correct note spelling (a flat key reads `B♭`, never `A♯`; the minor-family `D♭`→`C♯` root flip; no double accidentals).
- The **token system, color/contrast, and typography** (§0–§3) as built CSS custom properties.
- The **controls** (Root / Scale radiogroups, the **View** row's Orientation/Density/Handedness radiogroups, Refs checkbox group) and the **reference overlays** (tape bands, heel/octave landmarks, position labels — §9.1/§12.3).
- **Motion** (§7: the stateful + snappy builds, stagger, dotPop reflow-replay, the tape slide), reduced-motion-gated.
- The **⌘K command palette** (§8.5/§9) — searchable scale/tool jump.
- **Accessibility** (§8/§11): the `{mint}` `:focus-visible` ring, 44px touch-target hit-padding, the roving-tabindex note map, and the `polite` live regions.
- **Mobile reflow** (§10): below `760px` the shell stacks to one full-width column — the 248px sidebar is hidden (the mobile top-bar search trigger + the controls bottom sheet take over its role; the off-canvas **drawer was dropped in S16 ph3**), and the controls collapse to a single **non-modal bottom sheet whose peek header IS the summary** (no separate in-flow summary bar) — activating the peek header expands it UP to the controls body (Root as a 4×3 grid, plus the View row). The note map **renders vertical (auto) on a portrait phone** (§12.1) instead of horizontally scrolling the 760px SVG — no horizontal overflow of the page *or* the plate at `390px` **or `320px`**. _(The full §10 prose now matches this model; the **desktop** View row shipped in S16 Phase 4 — #78. S16 is complete.)_
- **URL-encoded deep-linking + adaptive "Share scale"** (§8.4/§11.3, #88): the topbar ghost button is wired to an **adaptive Web Share** action — `navigator.share({url})` (the native OS sheet) where available, feature-detected **at call time**, with a `navigator.clipboard.writeText` **copy-link fallback** on desktop/unsupported. Selection is mirrored to the address bar as a query deep link **`?r=<root>&s=<scale>`** (minimal `(root, scale)` only — never refs, never the device-local View prefs), written via `replaceState` that **merges the live search** so a pre-existing `?motion=` survives a `(root,scale)` change; opening such a link restores exactly that scale (an unknown/absent `r`/`s` falls back to A/major, never throws). The **query lands at `/`, so the Worker's SPA fallback stays forward-prep** — it is *not* exercised (that remains reserved for a future *path* scheme). Feedback obeys §8.4 (label→"Copying…" busy swap, a `currentColor` ✓, an inline `{text2}` caption beside the button — border never recolored, no second accent) and §11.3 (a third polite live region announces copy success only; the share branch announces nothing on a bare resolve and is silent on an `AbortError`).

**Still deferred (specified surfaces stop here / out of scope for v1):**
- Light mode — does not exist and is out of scope; the product is dark-native.
- The **enharmonic dual-spelling sub-label** for the two ambiguous root pills (`F♯`⇄`G♭`, `B♭`⇄`A♯`) — specified (§9.1/§13) but not in the v1 build (the pill renders the single default glyph). The primary §13 spelling itself **ships**; only the secondary additive sub-label is deferred.
- **Audio / playback / transport UI** (play-pause, tempo, audio on/off) — unbuilt (§8.9); the dot-level sounding state (§12.2) and the playback a11y contract (§11.1–11.4) are specified ahead of it.
- **Hosting: the GCP load balancer + Cloud CDN + Google-managed end-to-end TLS.** v1 ships the lean **Cloudflare edge in front of a public-read GCS bucket** (TLS + CDN + `www`→apex 301 at Cloudflare, ~$0/mo) — the LB/Cloud-CDN/managed-cert stack was **deferred for cost** (#39 amendment, 2026-06-07). It is additive later, in front of the same bucket; **revisit if traffic/latency metrics justify it.**
- `mint-deep` is declared (snappy build's `:root` only) but unused; its role is reserved, not yet assigned.
- **Status colors** are deliberately incomplete (§2.6): success reuses `{mint}` (no own token); `{danger}` (`{red-500}`) is declared-but-unapplied, reserved for the first error surface — the §16 Share-scale failure caption (#88, the first failable action) deliberately stayed **neutral `{text2}`** rather than binding `{danger}`, so it stays reserved; **warning and info have no token and are out of scope** — do not invent one, and do not repurpose `{tape}`/`{teal}` for them.
- The **theme toggle's toggled/active behavior** is unspecified (§8.8): its resting + hover visuals are defined, but with no light mode there is no switch behavior, checked state, or theme swap yet. The non-functional theme toggle is present in chrome with no defined behavior. _(The "Share scale" button is **no longer inert** — #88 wired it to the adaptive Web Share + `?r=&s=` deep-link action; see the shipped list above.)_
- The transport bar's own component spec is the **deferred §8.9 header** — present so references resolve, but unspecified until the bar is built (the audio surface itself is in the deferred list above).
- **`radius` has no component tier (by design, flagged here so it is not silent).** The three-tier alias model (§0) is a *color*-system rule. `radius` — like `space`, `motion`, `elevation`, `layout` — is a primitive scale used by name directly (`card`, `pill`, `chip` …) with no per-component aliases; there is intentionally no `controls-card-radius` → `card` indirection. This is a deliberate scope boundary, not an omission: a future component-radius tier would be a spec change, not a tweak.
- The "soon" tool **Vibrato** (`∿`) is a nav stub only; its surface is unspecified. **Intonation (`◴`) is no longer in this set — it became a live view in C9 (intonation epic)**; its frame and run-header ship here, and its drill surfaces (note-map drill display, cents meter, summary panel) complete in C6–C8; its full surface spec is §18. **The Tuner (`◎`) is no longer in this set either — its surface is specified in §17** (S18 ph5); only its UI build (S18 ph6) remains.
**Resolved during v1 (kept for traceability — these are in the "shipped" list above):**
- ~~**URL-encoded deep-linking — no shareable per-scale URL; the "Share scale" button is present chrome with no defined behavior.**~~ **RESOLVED (#88 — first post-v1 feature):** the ghost button is wired to an adaptive Web Share + copy-link action backed by a query `?r=&s=` deep link (`apps/web/src/state/controls.ts` codec + `apps/web/src/shell/useShareLink.ts` + the `replaceState` sync in `apps/web/src/shell/AppShell.tsx`). See the shipped entry above. The Cloudflare Worker's SPA fallback **stays forward-prep** — the query scheme resolves at `/`, so it never exercises the fallback (that remains reserved for a future *path* scheme).
- ~~**Reference overlays are horizontal-only; on the vertical map they are disabled, not broken (S16 ph2 — "U3b").**~~ **RESOLVED (S17 ph B, #84 — subsumes #80):** the §12.3 reference overlays (tape bands, the `low 2` slide, the heel/octave landmark bands, position labels) now **project through `axisOf`** — they are axis-correct in **both** orientations (§12.3 "Vertical projection"). The S16 Phase-2 AC bullet "ref bands/heel/`low 2` are axis-correct in both orientations" is **met by shipped behaviour**. The interim guards are removed: `RefsRow` (`apps/web/src/controls/RefsRow.tsx`) no longer disables the Refs pills on vertical, and `NoteMap` (`apps/web/src/notemap/NoteMap.tsx`) renders `<RefLayers>` in both orientations. On the vertical map the bands span the cross axis centered on the neck column, the heel dash is a neck-aligned segment at the cross-end, and the labels move to the cross gutters (tape numbers + heel/octave names left, position ordinals right, "½ string" omitted) — §12.3.
- ~~**Focus ring — UA now, `{mint}` ring is the target.**~~ **RESOLVED (S10):** the custom global `2px {mint}` focus ring is implemented on the interactive chrome via `:focus-visible` (`apps/web/src/styles/a11y.css`; see §8) — `box-shadow` on rounded chrome, `outline` on the SVG markers. The invariant (a visible focus indicator always exists, never `outline:none` without a replacement) holds in code.
- ~~**Touch-target remediation is intent-only in v1.**~~ **RESOLVED (S10):** the transparent hit-padding is implemented (`apps/web/src/styles/a11y.css`; see §10) — a `::before` overlay grows each pill / nav item / theme toggle to the WCAG 2.5.5 44×44px floor while the painted box stays at 30px / 32px.
- ~~**Primary §13 note spelling not in build.**~~ **RESOLVED (S14):** the dot labels, the H1 heading, and the breadcrumb route through `spell()` (a flat key reads `B♭`, never `A♯`; the minor-family `D♭`→`C♯` root flip; no double accidentals — see §13). Only the secondary enharmonic *sub-label* remains deferred (above).
- ~~**Narrow-screen reflow** below the `760px` floor is only "horizontal-scroll the plate; reflow everything else to full width" (§10).~~ **RESOLVED (S11):** a true mobile reflow ships — below `760px` the content + note-map plate take full width, the controls collapse, and the page never overflows horizontally at `390px` (§10; verified by `apps/web/e2e/responsive.spec.ts`). _(S11 originally collapsed the 248px sidebar to a keyboard-operable off-canvas drawer; **S16 ph3 superseded that** — the sidebar is now hidden, the mobile top-bar search trigger opens the palette, and the controls live in a non-modal bottom sheet, see the shipped list above + §10.)_
- ~~**Mobile + desktop note-map view controls — AUTO orientation + the manual View row ship (S16 ph2/ph3/ph4).**~~ **RESOLVED (S16 ph2/ph3/ph4):** the map **auto-rotates** (horizontal on desktop, vertical on a portrait phone, upright labels, density-derived spacing — §10/§12.1) so it fits viewport width instead of horizontally scrolling the 760px SVG (**ph2**); the **mobile** manual "View" row (the **orientation** Auto/Vertical/Horizontal, **density** Auto/Fit/Comfort, and **handedness** Right/Left segmented toggles, wired to `useMapView` and persisted) shipped in the mobile **bottom sheet** (the off-canvas drawer was dropped; search moved to the top bar — **ph3**); and **S16 Phase 4 (#78) shipped the matching desktop View row** in the controls card — it now carries the same Orientation/Density/Handedness toggles (the shared `ViewRow` component, wired to `useMapView` and persisted, on both surfaces — §9.1/§10/§11.3). **S16 is complete — no Phase remains.** _(The reference-overlay re-projection through `axisOf` for the vertical render was the separate **U3b** follow-up #80 — now **RESOLVED** in S17 ph B / #84, which subsumes #80; see the resolved item below. It was never an S16 Phase.)_

## 17. The Tuner (chromatic tuner)

The Tuner is a live, microphone-based **chromatic tuner for violin** — mic → fundamental pitch → nearest note + octave + signed cents — and it is the first surface in the product that reads sound rather than only describing it. It deliberately **reuses the §12.2 dot vocabulary and the §7.1 morph** instead of inventing a second visual language: the detected pitch is rendered as the same note-map dot, riding a horizontal cents axis. This section is the committed surface spec the build (S18 ph6) is verified against; values resolve to §0 tokens and reference the sections below, never raw hexes.

### 17.1 The view (its own nav surface)

The Tuner is its **own nav view that swaps the main panel** — one subject, no rivals (§1). Selecting **Tuner** (the `◎` sidebar nav item, §8.2 / §0 `nav-tuner`, or the **Tuner** command-palette row, §0 `palette-tuner`) replaces the note-map content in `.main` with the Tuner surface; the note map is not a rival pane beside it but the *other* value of the same view seam. The Tuner item is no longer a `.soon` stub (§8.2) once this view ships — it becomes a live, active nav item exactly like Scales. The Tuner inherits the same shell, topbar, sidebar, and `{canvas}` page body as the note map (§9); only the main panel's content changes.

**The topbar is view-aware** (the seam reaches the chrome): because the Tuner is a *sibling* of the note map on this seam — not a pane nested under Scales — the **breadcrumb collapses to just the tool name** ("Tuner") on the Tuner view: the leading `Scales` segment + the `/` separator are dropped (a `Scales / Tuner` crumb would falsely imply nesting; Figma ref `157:37` shows the Tuner topbar as only "Tuner"). And the **"Share scale" cluster is suppressed entirely** on the Tuner view — it is a Scales-only action that shares the deep-linked `(root, scale)`, and there is nothing to share in the Tuner. The note-map view's topbar is unchanged (`Scales / <spelled selection>` + the Share ghost). The mobile search trigger and the §9 shell/sidebar are identical across both views.

### 17.2 The dot-echo meter (the signature)

The detected pitch **is** a §12.2 dot riding a horizontal **cents axis** that runs −50 … 0 … +50, with the in-tune center at 0. The axis carries a faint **hairline** center tick in `{mint}` — a 1px anchor mark (the acoustic anchor the player steers toward), **not** a filled element, so it never challenges the root dot as the lone solid fill (§2.4) — with `flat ♭` labelling the left half and `sharp ♯` the right (§13 spoken/visible direction words, not color alone). The dot's x-position along this axis **is the live cents value** — the meter is the dot's position, not a separate needle.

Two states, both drawn from §12.2 so nothing here is a new shape:

- **Off / seeking** (`|cents| > 5`). The dot is the §12.2 **in-scale** dot — `{mint}` stroke (`stroke-width 1.5`), `in-scale-fill`, `r ≈ 14` (the §12.2 in-scale radius), **no label inside it** — sitting off-center on the flat (left) or sharp (right) side, its x set to the live cents. It reads as "a note is sounding, but not yet centered," exactly as an in-scale dot reads "a pitch that belongs but is not the root."
- **In tune** (`|cents| ≤ 5`). The dot snaps to the §12.2 **root** dot — solid `{mint}` fill (`r = 15`, no stroke) **plus the `root-glow` ring** (the `r ≈ 19`, `stroke-width 3` translucent ring of §12.2) — and shows the **note name inside it** in **Inter** (12px, the §12.2 root-dot label face — the **sole §3 "music = mono" exception**: note names are Geist Mono everywhere *except* the label inside an SVG dot, which is Inter so it centers in the fixed-diameter circle at Inter's metrics, §3/§15.1), with `root-label` text on the solid `{mint}` fill at the §2.5 9.86:1 pairing. In-tune therefore *is* the root-dot treatment: a centered, solid, glowing mint dot naming the pitch — the same "where sound lives / in tune" idea §2.6 makes one color.

This is the whole signature: the off→in-tune transition is a §12.2 in-scale-dot → root-dot morph centered on the axis, which is precisely the morph §7.1 already specifies for the note map.

### 17.3 The readout

Beneath (or beside) the meter, a numeric readout states the same fact in text:

- **Note name + octave** (e.g. `A4`) — **both Geist Mono** (`family-mono`, `features-mono` tnum). A tuner readout is musical/technical notation, which is Geist Mono by §3; the *only* Inter note name in the product is the in-dot label of §17.2 (§12.2), and this readout is not inside a dot.
- **Signed cents** (e.g. `+4¢`, `−7¢`) — **Geist Mono** (`family-mono`), tabular figures (`features-mono`), always carrying its sign so the direction is unambiguous in text.
- **A direction word** — `sharp ♯` or `flat ♭` (§13 voice), so the sign is backed by language, never color alone (§11.1).
- **In tune**: the readout resolves to `{mint}` and an **`IN TUNE ✓`** label appears, also `{mint}` — the success === `{mint}` decision of §2.6, with the `✓` glyph as the redundant non-color cue (§11.1).

### 17.4 Open-string chips

The four violin open strings **G3 · D4 · A4 · E5** render as a row of §8.1 / §4.2 **Pills** (`.pill`): `height 30`, `padding 0 12`, `radius pill`, default variant (`transparent` background, `1px {hairline2}` border, `{text2}` text). The string **nearest** the detected pitch is the **active** pill — `pill-active-wash` background, `1px {mint}` border, `{text}` text (the §8.1 active row) — so the player always sees which string they are tuning. The active chip gains a glow **only when in tune** (`|cents| ≤ 5`), echoing the root-dot glow of the meter; while seeking, it is the plain active pill with no glow. The chip note names (`G3`, `D4`, `A4`, `E5`) are **Geist Mono** (`family-mono`, `features-mono` tnum) — note tokens are mono by §3 like every other note pill (the in-dot label of §17.2 is the lone Inter exception); the tnum feature keeps them from drifting in the fixed-height pill.

### 17.5 A4 calibration

A single control sets the reference pitch: **`A = 440 Hz`**, adjustable **415–446 Hz**, **default 440**. It renders with **−/+ steppers** flanking the value; the value is Geist Mono (`family-mono`, tnum — a technical numeral). Each stepper is keyboard-operable and carries a ≥`touch-target-min` (44px, §0 / WCAG 2.5.5) hit target (the transparent hit-padding idiom of §10/§8, not a 44px painted box). The control changes only the reference the cents math is computed against; it introduces no new color and no second solid fill.

### 17.6 States

All copy is §13 teacher-voice — factual, no marketing.

- **Idle / start.** The `◎` glyph (§0 `nav-tuner`), a plain heading ("Tune your violin"), the **mic-permission rationale** (why the browser will ask for the microphone, stated plainly), and a **Start tuning** affordance. The Start control is rendered as a **`{mint}`-outline pill** (a §8.1-shaped pill with a `{mint}` border and `{mint}` text on a `transparent` background) — a primary affordance that **introduces no second solid fill**: only the root dot is solid `{mint}` (§2.4), so the primary action is an outline, not a filled button. Alongside, an on-device **privacy line**: audio is processed **entirely in-browser** — nothing is recorded, stored, or sent anywhere (§13 plain language; this is the same posture README/SECURITY will carry in ph6).
- **Listening.** The §17.2 meter is live — the dot rides the axis, the readout updates, the nearest open-string chip is active.
- **Permission denied.** A heading "Microphone blocked" with **settings-recovery guidance** — how to re-enable the mic in the browser/OS — **not** a no-op "retry" button that cannot succeed while permission is blocked. Copy is factual and actionable (§13).
- **Unsupported.** A graceful message for a browser without the needed audio capability — it states the limitation plainly and does not present a dead Start control.

### 17.7 No red (load-bearing)

`{danger}` / red is **unbound in v1** (§2.6 — `{red-500}` is the reserved-but-unapplied error candidate). **Out-of-tune is never red.** In tune is `{mint}` (success === `{mint}`, §2.6); off / seeking is **neutral grey** (the §12.2 in-scale dot over `{panel}`, plus the `{text2}` readout) **with the `♯` / `♭` direction word** carrying the signal (§11.1). A sharp or flat reading is a *normal* state of a working tuner, not a failure — recoloring it red would both invent an unbound status color (§2.6 forbids inventing one) and split the single-accent discipline (§2.4). **State it as a rule: the Tuner emits no red; the only two pitch colors are `{mint}` (in tune) and neutral grey (seeking), and direction is always backed by the `♯`/`♭` word, never by hue.**

### 17.8 Motion (maps to §7, no motion library)

Technique via the transitions-dev patterns (recipe hooks, the reduced-motion guard, reflow-to-replay); values from §7; **no motion library** (the binding rule, AGENTS.md).

- **The dot's axis position is set directly each frame** — it tracks the live signal, so it is **NOT** a CSS transition. A transition on the dot's x would *lag* the player's pitch (the dot would chase a moving target rather than report it). Position is data written per-frame (the same way the §12.1 orientation flip writes `cx`/`cy` attributes directly with no tween), not animated chrome.
- **Only the discrete off→in-tune change is transitioned**, and only on the two properties §7.1 already animates: the **radius morph** (`r`, `230ms` `--ease-spring` — §0's "dot RADIUS morph only" easing, this is its sanctioned use) and the **glow fade** (`opacity`, `200ms` `--glow-fade`, §7.1). These are exactly the §12.2 in-scale↔root transitions; the Tuner reuses them rather than declaring new ones.
- **The readout numerals** update via the **number-pop-in** technique (reflow-to-replay — the §7.2 / §16 reflow idiom, replayed on value change), so a changing cents/note value re-pops in place rather than snapping silently.
- **The state label** (`idle → listening → denied`, and the `IN TUNE ✓` appearance) uses the **text-states-swap** technique.
- **Reduced motion (§7.4 / §11.4).** Under `prefers-reduced-motion: reduce` the **dot's position still updates** — it is *data*, not decoration, and suppressing it would break the tool — but the **radius / glow morph collapses to instant** (the §7.4 `transition: none` rule applies to the dot/glow exactly as it does on the note map), and the readout/label swaps drop their pop/swap animation. The meter stays fully usable and legible with motion off (§11.4).

### 17.9 Accessibility (§11)

- **The live readout is a WCAG 4.1.3 status message.** A **visually-hidden** `role="status" aria-live="polite" aria-atomic="true"` region (§11.3 — live regions are `polite`, never `assertive`) carries it. The region **exists empty at load** (so the first announcement is heard) and is **decoupled from the per-frame meter** — it does **not** speak every frame. It announces on **note-change** and on **first in-tune**, **debounced ~1.5–2s**, so rapid pitch movement does not flood the screen reader (the same polite-and-throttled discipline the §11.3 playback region uses, for the same reason).
- **Color is never the only signal (§11.1).** In tune is conveyed by `{mint}` **and** the `in tune ✓` word **and** the dot's size/glow (root-dot `r = 15` + `root-glow`); seeking by the `♯` / `♭` direction word **and** the dot's off-center position. Hue is always redundant.
- **Keyboard + targets.** The **A4 −/+ steppers** and the **Start** control are keyboard-operable with a visible `{mint}` `:focus-visible` ring (§8) and ≥`touch-target-min` (44px, §0 / WCAG 2.5.5) hit targets (the §10/§8 transparent hit-padding idiom).

---

## 18. The Intonation drill

The Intonation drill is a hands-free **scale-intonation tool** — mic → raw pitch frames → per-degree accuracy painted back onto the note map as a graded ramp — and it is the third nav surface in the product (after Scales and Tuner; v1 ships it flag-gated — absent from the nav/palette until the `intonation` flag is on, §18.1). It follows the player through a 2-octave Flesch-shape run without gating on accuracy: **advance is always driven by detection, never by score**. All values resolve to §0 tokens; this section is the committed surface spec the C6–C9 UI build is verified against.

### 18.1 The view (third nav surface)

The Intonation drill occupies `'intonation'` on the view seam (`useView`), the same one that hosts `'scale-map'` and `'tuner'`. Selecting **Intonation** (the `◴` sidebar nav item or the **Intonation** command-palette row) swaps the `.main` content to the Intonation surface; the note map and the Tuner are not rival panes. The drill inherits the same shell, topbar, sidebar, and `{canvas}` page body as every other view (§9); only the main panel content changes.

**Topbar** (view-aware): the breadcrumb reads "Intonation" only — the `Scales /` segment is dropped (same posture as the Tuner, §17.1). The Share-scale cluster is suppressed (it is a Scales-only action, §17.1). The mobile search trigger and the §9 shell/sidebar are unchanged.

**Three states:** idle/start · running · end-of-run summary. The note map is the drill display surface in the running state; it is replaced by the summary panel at run end.

**Flag-gated surface (#176):** the Intonation surface ships behind a runtime feature flag. When the flag is off (the public prod default), the `◴` nav item and the **Intonation** command-palette row are **absent** — not `soon`-badged — and a stale `'intonation'` view falls back to the scale map; nothing about the surface is visible. The flag defaults on in dev and is flipped live (no deploy) via the bucket's `flags.json` or a per-device `?ff=intonation` override (mechanism in the README "Feature flags" section).

### 18.2 The note-map drill display (running state)

The existing §12 note-map SVG is the primary drill display. It reuses the §12.2 dot vocabulary — no new shape is introduced. Drill-specific additions:

- **Letters inside drill dots.** Each scale-degree dot carries its note name inside it (Inter 12px, the §12.2 root-dot label face — §3's lone Inter-in-SVG exception). The letter is the §13 spelled name of the target degree; it uses `root-label` text on the dot fill at the §2.5 9.86:1 pairing.
- **Graded mint→amber ramp.** Played dots are painted by `|median cents|` against a ramp clamped at ~30¢ (see §18.7 below). The ramp runs from `{mint}` (0¢ deviation) to `{amber-400}` (~30¢+), blending through intermediate tokens in the `{mint}`→`{amber}` warm-neutral arc. **No red at any point on the ramp** (§18.7 / §2.6 — `{danger}` is the reserved-but-unapplied error candidate; deviation is a description, not a failure).
- **Active-target pulse.** The currently targeted degree has a CSS keyframe pulse (`animation`) that marks it as the live destination. Under `prefers-reduced-motion: reduce` the animation is `none` (§18.8).
- **Discrete fingerboard-window re-frame.** As the drill advances up the neck, the visible fingerboard window shifts once per position jump (a discrete re-frame, not a continuous scroll). The re-frame fires **one §7 transition** (the shortest sanctioned discrete transition, §7.1 "discrete") on the window's position — instant under `reduce` (the §7.4 `transition: none` guard).

### 18.3 The cents number-line meter (running state)

A horizontal open-axis meter — **−50 … 0 … +50** — docked below the drill map. It reuses §17.2 dot-echo geometry and §7 values; it introduces nothing new.

- **Axis:** a faint `{hairline}` line (1px); a taller `{mint}` center tick at 0 (the in-tune anchor); `flat ♭` labels the left half, `sharp ♯` labels the right (§13 direction words, never color alone — §11.1). A `{mint}` in-tune zone band marks ±5¢.
- **Detected-pitch dot:** the §12.2 in-scale dot (seeking) or root dot (in-tune, `|cents| ≤ 5`), with its x set to the live cents; an **echo trail** of two fading copies behind it (§17.2 geometry, §7 values). At the right/left edge a signed-cents readout shows the numeric value (`+12¢`); the `{mint}` snap + glow fires inside ±5¢ (§12.2 in-tune morph). The dot's position is set per-frame (data, not animated chrome — §17.8 precedent); the in-tune morph is the §7.1 radius + glow transition. Under `reduce`: the dot moves instantly (no `transition` on `transform`/`left`), the echo trail is absent (no opacity or position tween — §18.8).
- **Meter meta:** above the axis, a compact status line (`"B · in scale · settling…"`) derived from the drill state.

### 18.4 The run header (running state)

A band in the topbar-adjacent zone — not inside the note-map panelcard — carrying:

- The scale name (§13 spelled, e.g. "A Major").
- Run meta: "2 octaves · ascending" (the configured shape).
- Live progress counter: `"target n/29"` (the §13 plain voice: factual, no encouragement — §13).

The live progress counter is a §11.3-redundant signal (backed by the number and by the note-map drill state, never color alone — §11.1).

### 18.5 The end-of-run summary panel

Replaces the note-map drill display after the run completes. Contains:

- **Run header:** run-complete kicker + scale + meta (unchanged, §18.4 format).
- **Average and worst stats:** aggregate signed cents + worst-degree note label (Geist Mono numerals, §3).
- **Per-degree table:** for each degree, the §13 spelled note name and the median signed cents of all occurrences in the run. The dots carry the same mint→amber ramp as the drill display (§18.2).
- **Tendency line:** one short, factual §13-voice sentence describing the predominant lean, e.g. "You ran slightly sharp ascending on the E string. Your octaves landed clean." **Never** judgemental (§13). Tied to recorded data, never fabricated.
- **Actions:** "Run again" and "New scale" (§8.1 pills, `{mint}`-outline primary / neutral secondary).
- **12-TET caveat** (load-bearing if the run uses 12-TET targets, §18.7): a short note below the tendency line, e.g. "Targets are 12-TET against A = 440 Hz. A deviation may be an expressive choice, not a mistake."
- **Per-run in-memory only.** No persistence, no cross-run analytics — the summary is gone when the player starts a new run or leaves the view.

### 18.6 Auto-follow FSM (high-level contract)

- **Advance is never gated on accuracy.** The drill advances when the engine detects a settled pitch that corresponds to the current target (or the next one, for anticipation). A player who lands 50¢ off still advances; the ramp records the deviation without blocking.
- **Signal-loss hold.** A 1.5 s bounded hold (mirroring §17.6's `READOUT_HOLD_MS = 1500`) prevents a momentary drop-out from advancing the drill. If the signal does not return within the hold window, the drill stays on the current target.
- **Page-Visibility pause.** When `document.visibilityState === 'hidden'` the drill pauses (stops advancing and stops writing to the live region) and resumes on visibility restore — the same pattern as the Tuner's Page-Visibility pause (§17.8 precedent).

### 18.7 No red (load-bearing)

`{danger}` / red is **unbound in v1** (§2.6). **Deviation from a target is never red.** The graded ramp is `{mint}` → `{amber-400}` only: a warm-neutral arc that reads as "in tune" → "off" without invoking failure. The color ramp is always redundant: the signed-cents readout (§18.3) and the per-degree table (§18.5) carry the same information in text.

**State it as a rule: the Intonation view emits no red; the only two polar states are `{mint}` (in tune / near target) and `{amber-400}` (furthest from target), and deviation is always backed by the signed-cents number and the degree label.**

*(If the codebase adopts a non-12-TET reference in a future child issue, the 12-TET caveat in §18.5 and §18.9 are updated to match — the no-red rule is unchanged.)*

### 18.8 Motion (maps to §7, no motion library)

Technique via the transitions-dev patterns; values from §7; **no motion library** (the binding rule, AGENTS.md).

- **The cents meter dot's axis position is set directly each frame** — data, not animation, for the same reason as §17.8 (a transition would lag the player). Under `reduce`, the dot moves instantly (no `transition` on `transform` or `left`). Guard: `@media (prefers-reduced-motion: reduce) { .meter-dot { transition: none; } }`.
- **The echo trail** (two fading copies behind the live dot) uses §7 opacity values and §7 timing for the fade. Under `reduce`, the echo dots are absent (no opacity or position tween). Guard: `@media (prefers-reduced-motion: reduce) { .meter-echo { opacity: 0; transition: none; } }`.
- **The discrete fingerboard-window re-frame** fires one §7 transition per position jump (the `transition` on the window's scroll/transform). Under `reduce`, the re-frame snaps — no `transition` on the window's position. Guard: `.board[data-motion] .fingerboard-window { transition: none }` under `reduce` (§7.4 pattern).
- **The active-target pulse** is a CSS keyframe `animation`. Under `reduce`, it is `none`. Guard: `@media (prefers-reduced-motion: reduce) { .drill-active-pulse { animation: none; } }`.
- **Ramp-color transitions** (the dot fill shifting along the mint→amber arc as new median data arrives) use a short §7 transition (`150ms`, `--ease-out`) — so a freshly-scored degree eases to its new ramp fill rather than snapping. Under `reduce`, this transition is `none`.

All five animated surfaces must have explicit `reduce` guards in the shipped CSS; the implementation PR must state pass/fail for each guard in its description (a surface without a verified guard is a finding).

### 18.9 Accessibility (§11)

- **The `aria-live` announcer (§11.3 / §17.9 pattern).** A visually-hidden `role="status" aria-live="polite" aria-atomic="true" data-live="intonation"` region is **conditionally rendered** — present only when the Intonation view is active, so the global `aria-live="polite"` count stays verifiable. The region **exists empty at mount** (so the first announcement is heard — §11.3 / §17.9). A debounced effect (~1.5–2 s, mirroring `ANNOUNCE_DEBOUNCE_MS = 1800` from §17.9) watches `drillState.currentTargetIndex` and `drillState.lastSettledCents`. It speaks on:
  - **target-change:** `"Target 3 of 29 — E5"` (note name from the drill plan).
  - **note-settle:** `"+12 cents — slightly sharp"` (factual §13-voice; never "wrong", never "missed").
  - **Never** per-frame — raw frame updates must not touch the live region.
  No `aria-live="assertive"` region exists in the Intonation view.
- **Color is never the only signal (§11.1).** The graded ramp is backed by the signed-cents numeric readout (§18.3) and the per-degree table (§18.5); the active-target pulse is backed by the `"target n/29"` counter (§18.4). Hue is always redundant.
- **Keyboard + targets.** The "Start drill", "Run again", and "New scale" controls are keyboard-operable with a visible `{mint}` `:focus-visible` ring (§8) and ≥`touch-target-min` (44px, §0 / WCAG 2.5.5) hit targets.
- **Reduced motion (§7.4 / §11.4 / §18.8).** All five animated surfaces (re-frame, active-target pulse, echo trail, meter dot, ramp-color transition) honor `prefers-reduced-motion: reduce` by snapping or disappearing — the drill stays fully functional with motion off, and §11.4 is satisfied.

---

*End of DESIGN.md — Violin Tools.*
