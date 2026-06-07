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
  board-viewbox:    "0 0 760 264"
  board-min-width:  "760px"
  shell-min-width:  "760px"   # the §10 mobile-reflow breakpoint: below this the sidebar collapses to a drawer + the page reflows to one column; the plate scrolls the 760px SVG inside itself (§10)
  touch-target-min: "44px"    # WCAG 2.5.5 floor for any pointer target

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
    ic-menu:      |   # the mobile-drawer hamburger — topbar .topbar-menu (< 760px only, §10)
      <svg width="16" height="12">
        <g stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="1" y1="2" x2="15" y2="2"/>
          <line x1="1" y1="6" x2="15" y2="6"/>
          <line x1="1" y1="10" x2="15" y2="10"/>
        </g>
      </svg>
      # three rounded rules on a 16×12 box; shown ONLY below the §10 760px breakpoint
      # on the .topbar-menu trigger ("Open navigation"). currentColor → {text2}.
  glyph-char:                # element → the literal Unicode character it renders (kind B)
    nav-intonation: "◴"      # U+25F4 — "soon" Intonation tool
    nav-vibrato:    "∿"      # U+223F — "soon" Vibrato tool (sine-wave glyph)
    nav-tuner:      "◎"      # U+25CE — "soon" Tuner tool
    palette-scale:  "♪"      # U+266A — a Scales jump-target row (e.g. "A Major")
    palette-scalemap: "▦"    # U+25A6 — the "Scale Map (open)" tool row
    palette-intonation: "◴"  # reuses the nav glyph in the Tools group
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
> **Non-token symbols referenced by prose.** Two identifiers the prose cites are **build logic / constants, not color or layout tokens**, so they have no entry in the tiers above: **`spell()`** — the deterministic root-spelling function (flat set when the root name carries a flat or is `F`, else sharp; defined in §13 and applied in §9.1); and **`NMAX = 15`** — the per-string column count that fixes the node grid (1 open + 14 stopped columns; operationalized in §12.1). They are named here so a reader does not hunt for them among the tokens.
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

`{text3}` on `{surface}` (3.37:1) is the one sub-4.5:1 pairing and is allowed **only** as placeholder/section-header/meta text, never as body copy that must be read to operate the tool. The root-dot and non-root-label pairings are P0 invariants (§11.2). Note the in-scale label clears AAA, not merely AA: `in-scale-fill` is a low-opacity mint over the near-black `{panel}`, so it composites to a very dark teal (`#112d29`) against which white sits ≈14.7:1 — the AA-floor concern (§11.2) is the *fill staying dark enough*, and it does so with wide margin.

### 2.6 Semantic / status colors

The functional accents in §2.4 (`{tape}`/`{teal}`/`{violet}`) cover **reference-overlay** meaning — they are not system-status colors. This subsection is the sanctioned contract for *system status* (success, error, warning, info) so that a future intonation read-out, a form with validation, or any status-bearing surface inherits a decision instead of inventing one (which would break the single-accent discipline of §2.4). The governing rule: **do not invent a status color. Use the role defined here, or — where the role is an open gap — leave it open until a tool actually needs it.**

| Role | Token | Resolves to | Use it for | Never use as |
|---|---|---|---|---|
| **Success / in-tune** | `{success}` → `{mint}` | `#00d4a4` | The one positive-status color. In this product "in tune," "in scale," and "where sound lives" are the *same* idea, so success **deliberately reuses `{mint}`** rather than adding a green; a separate success token would split the acoustic anchor into two near-identical greens and weaken it. | a *second* solid fill competing with the root dot; a generic "OK" tint on chrome that has nothing to do with pitch |
| **Error / danger** | `{danger}` → `{red-500}` | `#e5644e` | **Reserved, unbound in v1.** No error state exists yet (the only inputs — root/scale/ref pills — are toggles that cannot fail, §8.1). `{red-500}` is the *expected candidate* the day an error surface appears (e.g. a future text input). It is intentionally a **desaturated, muted red** so it never reads as a brand accent beside `{mint}`. | a tape/landmark band or any note-map element (red carries no musical meaning here); anything decorative; a value applied *before* a real error surface exists |
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
| Note-map plate (`.panel`) | radius `plate`; **border `1px solid {panel-bd}`** (the inner hairline that separates plate from frame); padding `12px 10px 8px`; **`overflow-x: auto`**; SVG `width:100%`, `min-width:760px`, `height:auto` |
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
| Tooltip (`soon` / disabled affordances) | **known gap** — no animation in the build; it is currently a native title/`aria-describedby` affordance, not an animated overlay. If built as a custom overlay, mirror the palette pattern at **half** its durations: `transform scale(.96)→scale(1)` **enter 120ms `ease-modal-in`** + `opacity 0→1`; **exit 100ms `ease-modal-out`** + `opacity 1→0` (≈50% of the palette's 250/200 ÷ 160/150). | — | exit per the enter row (100ms `ease-modal-out`) |

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

**Icons.** Each nav item carries one glyph inside a fixed **`15px`** icon span (`icon.box.nav`, §0), color = `currentColor` so it inherits the row's text token — which is why the active item's icon turns `{mint}` along with its label, while resting/soon icons sit at `{text3}`. **Scales** (`ic-scales`, the three-line neck mark) and the mobile-drawer **hamburger** (`ic-menu`, §10 — shown only below the `760px` breakpoint on `.topbar-menu`) are the drawn inline SVGs (§0 `icon.svg`); the three "soon" tools render **Unicode glyph characters** as plain text (§0 `icon.glyph-char`): **Intonation** = `◴`, **Vibrato** = `∿`, **Tuner** = `◎`. Do not redraw the soon-tool glyphs as custom SVG — they are characters.

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
- **active** — `translateY(1px) scale(.97)`, `transform 90ms ease`.
- **focus** — global `{mint}` ring.
- **error** — n/a in v1: "Share scale" has no failable async behavior specified (the action itself is a known gap, §16). If it becomes async (e.g. copy-link that can fail), express failure as a transient inline caption beside the button, never by recoloring its border.
- **loading** — n/a in v1. Should "Share" become async, show a brief in-button busy state (label → activity), but do **not** introduce a second accent for it.

**Do / Don't.** Don't promote the ghost button with a fill or an accent border to draw attention — it is deliberately the quietest control on the topbar. Do keep it transparent with the `{hairline2}`→`{hairline3}` border language shared with pills and search.

### 8.5 Command palette row (`.presults` item)

`background transparent` · `text string-name` (Inter 14px) · `radius control` · `height 40px` · `padding 0 11px` · `gap 11px` · **leading icon column `18px`** (`icon.box.palette`; the glyph is centered in the span, color `{text3}`, promoted to `{mint}` on the selected row by `.pitem.sel .pico`) · trailing `↵`/`soon`/`open` meta (Geist Mono 11px `{text3}`, `soon` → `palette-soon`). **Row glyph by group (all Unicode characters, §0 `icon.glyph-char`):** a **Scales** jump target uses `♪`; the **Scale Map (open)** tool row uses `▦`; the soon **Intonation**/**Tuner** tool rows reuse `◴`/`◎`. These are characters set as text, not drawn SVG.

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
│   │   └── .ni.soon ×3  Intonation · Vibrato · Tuner   ({muted}, "soon" tag, no hover)
│   ├── .spacer   (flex:1 — pushes toggle to bottom)
│   └── .theme    "☾ Dark"               (toggle; border 1px {hairline})
└── .main  (flex:1; min-width:0)
    ├── .topbar   (height 52px; bg {canvas} — inherited from body, no own fill; border-bottom {hairline}; space-between)
    │   ├── .crumb   "Scales / A Major"   (separator {hairline3}; active segment {text2})
    │   └── .ghost   "Share scale"
    └── .content  (max-width 880px; padding 26px 32px 60px)
        ├── .kicker    "Scale map"        (mono, uppercase, {mint})
        ├── .toolhead  H1 scale name  +  interval formula   (baseline-aligned, space-between)
        ├── .controls  surface card, three rows:
        │   ├── Root    12 chromatic-root pills
        │   ├── Scale   Major · minors · pentatonics · Chromatic   ("Pentatonic" → "Pent.")
        │   └── Refs    [Tapes][low 2][3-tape] ({tape})  ·  [Landmarks] ({teal})
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

The controls card has exactly three rows. The **Root** and **Scale** rows are each one ARIA **radiogroup** (single-select), and the **Refs** row is an ARIA **`group` of `checkbox` pills** (multi-select — four independent toggles, any combination valid), see §11.3. In all three, **arrow-key / focus order follows the left-to-right order below** — so the sequence is load-bearing, not cosmetic (the Refs checkboxes are independently Tab-focusable rather than roving, but the displayed order is still authoritative). Pill visuals resolve in §8.1; this is the *content* contract (which pills, what label, in what order).

**Root** — 12 pills, ascending chromatic order from C, using the violin enharmonic spellings of §13 (`Bb` not `A#`, `Ab` not `G#`, `F#` as the default sharp-side choice). Full sequence:

> `C` · `Db` · `D` · `Eb` · `E` · `F` · `F#` · `G` · `Ab` · `A` · `Bb` · `B`

All five accidental roots (`Db`/`Eb`/`F#`/`Ab`/`Bb`) take the *default* spelling shown above. The build's spelling is deterministic: `spell()` (§0 logic, mirrored in §13) picks the **flat** set when the root name contains a flat or is `F`, otherwise the **sharp** set — so `F#` and `Bb` are the only two accidental roots whose *as-a-key* spelling a violinist routinely re-spells by context, and they are the two **genuinely ambiguous pairs**:

> **`F#` ⇄ `Gb`** and **`Bb` ⇄ `A#`**

The other three accidentals (`Db`, `Eb`, `Ab`) have one overwhelmingly conventional violin spelling each and get **no** alternative. For the two ambiguous roots the alternative is **additive, never a default change**: the pill keeps its default glyph (`F#`, `Bb`) as the large label and renders the alternative as a **smaller secondary spelling beneath it inside the same pill** (e.g. `F#` over a `Gb` sub-label), set in the pill text role one step down; it does not alter which pitch class is selected, and it is announced to AT as the spoken default (§13). **Surfacing-status note:** this dual-spelling sub-label is *specified here but not yet in the v1 build* — the current mock renders only the single default glyph per pill (see §16 known gaps). Reproducing v1 shows the default only; the secondary sub-label is the documented next step for these two roots.

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

---

## 10. Responsive Behavior

The shell is designed desktop-first and **reflows to a real single-column mobile layout** below one breakpoint (S11). This is no longer a "narrow floor placeholder": below `760px` the 248px sidebar collapses to an off-canvas **drawer**, the content column and note-map plate take the full viewport width, the controls wrap, and **the page never overflows horizontally** — the headline invariant is `document.scrollingElement.scrollWidth <= clientWidth` at `390px` (the historical 458px overflow is gone). The desktop layout at and above the breakpoint is unchanged.

| Breakpoint | Behavior |
|---|---|
| ≥ 760px (`shell-min-width`) | **Full desktop shell, unchanged:** the 248px sticky sidebar + fluid main; controls card and note-map plate at natural width; no drawer trigger; the note-map SVG fits without the plate needing to scroll. |
| < 760px (`shell-min-width`) | **Mobile reflow:** the shell stacks to one full-width column. The 248px sidebar collapses to an off-canvas **drawer** (toggled by a topbar hamburger); the content + topbar tighten their side gutters to `space-400` (16px); the controls wrap; the note-map plate (`.panel`, `overflow-x:auto`) is full width and **scrolls the `760px`-min-width SVG INSIDE itself** — never widening the page. |

**Per-element behavior below the breakpoint (the load-bearing three):**

| Element | < 760px behavior |
|---|---|
| Sidebar (248px) | **Collapses to an off-canvas drawer.** The same `<header class="side">` element becomes a `position:fixed`, full-height, `translateX(-100%)` off-canvas panel; a topbar hamburger (`.topbar-menu`, hidden on desktop) toggles `.is-open`, which slides it back in (`translateX(0)`) over a backdrop scrim (`.drawer-scrim`). Its internals keep the desktop 248px content width (`max-width:86vw` on a tiny phone), so the rail's contents never reflow — only its position changes. While closed it is `visibility:hidden` so its focusable contents leave the tab order (no off-canvas tab-trap). The drawer is keyboard-operable: the trigger carries `aria-expanded` + `aria-controls="mobile-drawer"` + the accessible name "Open navigation"; opening moves focus into the panel, `Esc` (or a scrim tap, or activating a nav item) closes it, and focus returns to the trigger on close (`apps/web/src/shell/useDrawer.ts`). |
| Page H1 (32px scale name) | **Unchanged — stays 32px `lh-tight`.** The full-width single column gives it room; if a very long name overflows a narrow column it wraps at `lh-tight`. (No type step-down is defined; the reflow frees width rather than shrinking type.) |
| Topbar (52px) | **Height unchanged at 52px**; its side padding tightens to `space-400` (16px) to match the content gutter, and it gains the (mobile-only) drawer hamburger on the left. The breadcrumb may truncate before the `{ghost}` button wraps; the bar does not shrink vertically. |

**Drawer motion (§7).** The drawer slide is the transitions-dev panel-reveal (07) **technique** — a `translateX` transform driven by the `.is-open` state class, **no motion library** — populated with §7 **values**: the `--state-color` (200ms) duration and the standard ease (a spring/overshoot easing reads as jitter on a full-height nav panel, so §7's spring easings are deliberately not used here). The backdrop scrim fades on the §7 `--overlay-out` (180ms) timeline, both directions. Both are gated on `prefers-reduced-motion: reduce` (§7.4) — under `reduce` the drawer snaps open/closed with no slide and the scrim does not fade (`apps/web/src/shell/shell.css`).

**Touch targets.** The WCAG 2.5.5 target is **44×44px** for any pointer target. Pills (30px) and nav items (32px) keep their compact visual box; **the transparent hit-padding ships (S10)** — a transparent `::before` overlay (`apps/web/src/styles/a11y.css`) centered on each pill / nav item / theme toggle grows the tap area to the `{touch-target-min}` (44px) floor while the painted box stays at 30px / 32px. The expansion is pointer-area only; it changes no layout and no visual size.

**No-overflow invariant.** The page's `scrollingElement` must not scroll horizontally at `390px` (`scrollWidth <= clientWidth`) — verified live in `apps/web/e2e/responsive.spec.ts`. The note-map SVG keeps its `760px` min-width but is the **only** horizontally-scrollable element, contained inside `.panel`; nothing else may push the shell wider than the viewport.

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

- **The note map is one composite widget**, not a flat list of tab stops. It uses a **roving tabindex**: exactly one marker is tabbable at a time (initially the root); arrow keys move focus in pitch order (up/down cross strings spatially); Enter/Space sounds the focused note; Tab exits the whole widget.
- **The single-select selectors** (root, scale) follow the ARIA **radiogroup** pattern: each is one `radiogroup` of `radio` pills with a roving tabindex, arrows move selection within the group, Tab exits, selection follows focus. **The Refs selector is multi-select** — four independent reference-layer toggles can each be on or off in any combination — so it is an ARIA **`role="group"` of `role="checkbox"` pills**, *not* a radiogroup: each checkbox is independently Tab-focusable, Space toggles it, and `aria-checked` reflects its own boolean (a radiogroup would announce "radio button, 1 of 4" and falsely tell a screen-reader user only one Refs layer can be active). The §9.1 left-to-right order is still authoritative for both patterns.
- **ARIA label strings (the accessible names to ship, verbatim).** These are the expected `aria-label` / accessible-name values so a reproducer does not invent them:
  - Root radiogroup → **"Root note"**; Scale radiogroup → **"Scale type"**; Refs `group` (of checkboxes, per the bullet above) → **"Reference layers"**.
  - The note-map composite widget (the `<svg id="board">` group) → **"Full fingerboard note map"** (the build's existing `aria-label`).
  - The command palette (dialog) → **"Scale search"**; its input → **"Search scales and tools"**; its results list → `role="listbox"` labelled **"Results"**.
  - Each note marker's accessible name is its spoken note name (§13, "C sharp"), suffixed with state for non-visual users — e.g. **"C sharp, root"**, **"E, in scale"**, **"F, not in scale"**.
- **Live regions are `polite`, never `assertive`.** During playback a polite region announces the current note name; a second polite region carries a full string-by-string text description of the map, refreshed on each scale change. (Polite is correct: rapid playback would otherwise interrupt screen-reader speech many times per second.) The map's text description lives in an external element, **not** inside the SVG, because SVG `<desc>` does not reliably support live updates across major screen-reader/browser pairings.
- **Basics:** a skip link to the map; `<header>`/`<nav>`/`<main>` landmarks; `lang` on the document; every stub affordance (`soon` tools, the non-functional theme toggle) carries `aria-disabled="true"` with an explanatory tooltip.

### 11.4 Reduced motion

Motion is opt-in: the default honors the OS setting, and every transition and keyframe (dot morph or pop, band fades, palette scale-up, any sounding-note pulse) is gated on `prefers-reduced-motion`. Under `reduce`, the static heavier stroke on the sounding note is its sole, motion-free indicator, and the interface is fully usable and legible.

---

## 12. The Fingerboard Note Map (signature component)

This is the product's heart and its hardest-working surface. It is a single inline **SVG** that renders the **whole neck**: four strings as horizontal lines, semitone positions as columns, and a note dot at every string × position. Dots morph between three states (off / in-scale / root); the sounding state adds a heavier stroke during playback. Optional `{tape}` tape bands and `{teal}`/`{violet}` landmark bands sit behind the dots and toggle independently. **The geometry is in §12.1, the dot visuals in §12.2, and the pitch model + the exact off/in-scale/root classification rule in §12.5 — together they let the whole 60-dot map be rebuilt from this file alone, with no outside scale reference.**

### 12.1 Canvas & coordinate system

- **viewBox** `0 0 760 264`, rendered `width:100%`, `height:auto`, `min-width:760px` inside the horizontally-scrollable plate (`.panel` `overflow-x:auto`).
- **Strings** — horizontal lines in perfect-fifth tuning, each drawn `x1:60 → x2:724`, stroke `string-line`, width `1.5`:

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
  - **Diatonic** (Major + Natural / Harmonic / Melodic minor — 7 notes): **one letter per scale degree.** Walk the scale's intervals from the root; each successive degree takes the next letter name (A→B→C→…→G→A), with whatever accidental makes the pitch class correct — so e.g. A Major reads A B C♯ D E F♯ G♯, not A B D♭… The root's own letter and accidental come from the root rule above (flat-side roots and `F` are flats, else sharps). A theoretically dark key spells faithfully even when that needs a double accidental — D♭ minor's 6th is `B♭♭` (B double-flat), not the enharmonic `A`. **Double accidentals are written as doubled single signs (`♭♭` / `♯♯`), never the single Unicode double-flat / double-sharp glyphs (U+1D12B `𝄫` / U+1D12A `𝄪`):** the self-hosted Inter face (§3) covers only `♭` / `♯` (U+266D / U+266F), so the doubled form renders in-glyph on every platform while the single double-accidental codepoints fall back to a platform font or tofu. (In the 12-root pill set only D♭ minor is reachably double-accidental — 8 flats, the `B♭♭`; no double-sharp key is reachable since pc 8 spells `Ab`, not `G#`.)
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

**Known gaps (specified surfaces stop here):**
- Light mode — does not exist and is out of scope; the product is dark-native.
- `mint-deep` is declared (snappy build's `:root` only) but unused; its role is reserved, not yet assigned.
- **Status colors** are deliberately incomplete (§2.6): success reuses `{mint}` (no own token); `{danger}` (`{red-500}`) is declared-but-unapplied, reserved for the first error surface; **warning and info have no token and are out of scope** — do not invent one, and do not repurpose `{tape}`/`{teal}` for them.
- The **theme toggle's toggled/active behavior** is unspecified (§8.8): its resting + hover visuals are defined, but with no light mode there is no switch behavior, checked state, or theme swap yet.
- Playback / transport UI (play-pause, tempo, audio on/off) is **not yet implemented in v1** — it is not "shipped but unspecced," it is unbuilt. The dot-level **sounding** state (§12.2) and the playback accessibility contract (§11.1–11.4) are specified now so they are ready whenever a transport bar ships; the transport bar's own component spec is the **deferred §8.9 header** — present so references resolve, but unspecified until the bar is built.
- ~~**Focus ring — UA now, `{mint}` ring is the target.**~~ **RESOLVED (S10):** the custom global `2px {mint}` focus ring is implemented on the interactive chrome via `:focus-visible` (`apps/web/src/styles/a11y.css`; see §8) — `box-shadow` on rounded chrome, `outline` on the SVG markers. The UA-only behavior is retired; the invariant (a visible focus indicator always exists, never `outline:none` without a replacement) holds in code.
- **`radius` has no component tier (by design, flagged here so it is not silent).** The three-tier alias model (§0) is a *color*-system rule. `radius` — like `space`, `motion`, `elevation`, `layout` — is a primitive scale used by name directly (`card`, `pill`, `chip` …) with no per-component aliases; there is intentionally no `controls-card-radius` → `card` indirection. This is a deliberate scope boundary, not an omission: a future component-radius tier would be a spec change, not a tweak.
- ~~**Touch-target remediation is intent-only in v1.**~~ **RESOLVED (S10):** the transparent hit-padding is implemented (`apps/web/src/styles/a11y.css`; see §10) — a `::before` overlay grows each pill / nav item / theme toggle to the WCAG 2.5.5 44×44px floor while the painted box stays at 30px / 32px. The pointer-area expansion is shipped; the visual box is unchanged.
- The "soon" tools (Intonation, Vibrato, Tuner) are nav stubs only; their surfaces are unspecified.
- The **primary §13 letter-correct note spelling now ships** (the dot labels, the H1 heading, and the breadcrumb route through `spell()` — a flat key reads `Bb`, never `A#`; see §13). What remains deferred is only the **enharmonic dual-spelling sub-label** for the two ambiguous root pills (`F#`⇄`Gb`, `Bb`⇄`A#`): it is specified (§9.1, §13) but **not yet in the v1 build** — the mock renders the single default glyph per pill. Reproducing v1 shows defaults only; the secondary sub-label is the documented next step.
- Audio on/off, tempo, and any settings panel are not yet captured.
- ~~**Narrow-screen reflow** below the `760px` floor is only "horizontal-scroll the plate; reflow everything else to full width" (§10).~~ **RESOLVED (S11):** a true mobile reflow ships — below `760px` the 248px sidebar collapses to a keyboard-operable off-canvas **drawer**, the content + note-map plate take full width, the controls wrap, and the page never overflows horizontally at `390px` (§10; `apps/web/src/shell/{useDrawer.ts,Sidebar.tsx,Topbar.tsx,AppShell.tsx,shell.css}`, verified by `apps/web/e2e/responsive.spec.ts`). What stays a future option (not a v1 gap that blocks anything) is a *deeper* reflow that changes the note map itself — fewer visible positions or scaled column width; v1 keeps the full 760px-min-width map and scrolls it inside its plate.
- The non-functional theme toggle and "Share scale" button are present in chrome but have no defined behavior.

*End of DESIGN.md — Violin Tools.*
