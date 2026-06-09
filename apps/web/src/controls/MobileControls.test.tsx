import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { type MapViewApi } from '../notemap/useMapView.ts';
import { useControls } from '../state/useControls.ts';

import { MobileControls } from './MobileControls.tsx';

// MobileControls — the §10/§16 mobile controls surface: ONE non-modal bottom sheet
// whose PEEK state IS the summary. A header row pinned to the bottom edge (the
// drag handle + the summary text + an expand chevron) is the SINGLE trigger; tapping
// it expands the sheet UPWARD to reveal the body (Root 4×3 grid · Scale · Refs · View).
// There is NO separate summary bar in the content flow.
//
// Tested IN ISOLATION (FINDING 3): jsdom applies no CSS media queries (and so no
// display:none-from-media), so the desktop card vs. mobile sheet can't be
// CSS-toggled apart. Mounting MobileControls ALONE keeps role queries unambiguous —
// the only radiogroups in the document are this surface's.
//
// The sheet's scrollable content region uses an INLINE display:none while at peek
// (the U6 CSS transform is keyed off data-open separately) — jsdom DOES reflect an
// inline display:none into getComputedStyle, so dom-testing-library excludes the
// peek sheet's rows from the a11y tree exactly as it would in a browser. That is
// why "expanding reveals the rows" is a real assertion here, not a CSS no-op.

// A complete MapViewApi stub with spied setters (the View row only needs the
// stored modes + the setters; the sheet itself drives open/close via useDrawer).
function stubMapView(overrides: Partial<MapViewApi> = {}): MapViewApi {
  return {
    mode: 'auto',
    orientation: 'vertical',
    density: 'auto',
    handedness: 'right',
    setOrientation: vi.fn(),
    setDensity: vi.fn(),
    setHandedness: vi.fn(),
    ...overrides,
  };
}

// Render MobileControls with the REAL controls api (the integration seam the rows
// write) so the Root/Scale/Refs rows are genuinely wired, plus a stub mapView.
function MobileControlsHarness(props: { summaryText?: string }) {
  const controls = useControls();
  return (
    <MobileControls
      controls={controls}
      mapView={stubMapView()}
      summaryText={props.summaryText ?? 'A Major'}
    />
  );
}

// The single peek-header trigger — its accessible name leads with the control
// purpose ("Scale controls,") then the live summary.
function peekHeader(): HTMLElement {
  return screen.getByRole('button', { name: /^scale controls,/i });
}

// The sheet container (the element whose id the peek header's aria-controls points
// at) — scope sheet-internal role queries to it so they are unambiguous.
function sheet(): HTMLElement {
  const sheetId = peekHeader().getAttribute('aria-controls');
  if (sheetId === null) throw new Error('peek header has no aria-controls');
  const el = document.getElementById(sheetId);
  if (el === null) throw new Error(`no sheet with id ${sheetId}`);
  return el;
}

describe('MobileControls — peek header is the single trigger (§10/§16)', () => {
  it('shows the summary text in the peek header and is collapsed (aria-expanded=false) initially', () => {
    render(<MobileControlsHarness summaryText="A Major · Tapes" />);
    const trigger = peekHeader();
    expect(trigger).toHaveTextContent('A Major · Tapes');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // The header controls the sheet by id.
    expect(trigger.getAttribute('aria-controls')).toBe(sheet().id);
  });

  it('has NO separate summary bar in the content flow — the peek header is the only trigger', () => {
    render(<MobileControlsHarness summaryText="A Major · Tapes" />);
    // Exactly one button leads with "Scale controls," — the peek header. There is no
    // redundant in-flow summary bar above the sheet (the old .mc-summary is gone).
    expect(screen.getAllByRole('button', { name: /^scale controls,/i })).toHaveLength(1);
    // The peek header IS inside the sheet region (it pins the sheet to the bottom),
    // not a standalone in-flow element.
    expect(sheet().contains(peekHeader())).toBe(true);
  });

  it('does not expose the sheet body rows while at peek (closed body is out of the a11y tree)', () => {
    render(<MobileControlsHarness />);
    // Peek: the inline display:none on the body region excludes every row.
    expect(within(sheet()).queryByRole('radiogroup', { name: 'Root note' })).toBeNull();
    expect(within(sheet()).queryByRole('radiogroup', { name: 'Scale type' })).toBeNull();
    expect(within(sheet()).queryByRole('group', { name: 'Reference layers' })).toBeNull();
  });
});

describe('MobileControls — activating the peek header expands the sheet (peek→expand)', () => {
  it('clicking the peek header expands it and reveals Root, Scale, Refs, and the three View rows', () => {
    render(<MobileControlsHarness />);
    const trigger = peekHeader();
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const region = sheet();
    // The four controls rows, in the §9.1 order, scoped to the sheet (unambiguous).
    expect(within(region).getByRole('radiogroup', { name: 'Root note' })).toBeInTheDocument();
    expect(within(region).getByRole('radiogroup', { name: 'Scale type' })).toBeInTheDocument();
    expect(within(region).getByRole('group', { name: 'Reference layers' })).toBeInTheDocument();
    // The View row's three segmented radiogroups join the sheet on mobile.
    expect(within(region).getByRole('radiogroup', { name: 'Orientation' })).toBeInTheDocument();
    expect(within(region).getByRole('radiogroup', { name: 'Density' })).toBeInTheDocument();
    expect(within(region).getByRole('radiogroup', { name: 'Handedness' })).toBeInTheDocument();
  });

  it('renders the Root grid as the SAME radiogroup (one Root note radiogroup, 12 radios)', () => {
    render(<MobileControlsHarness />);
    fireEvent.click(peekHeader());
    const rootGroup = within(sheet()).getByRole('radiogroup', { name: 'Root note' });
    expect(within(rootGroup).getAllByRole('radio')).toHaveLength(12);
  });
});

describe('MobileControls — dismissal (useDrawer contract, non-modal)', () => {
  it('Escape closes the sheet and returns focus to the peek header', () => {
    render(<MobileControlsHarness />);
    const trigger = peekHeader();
    act(() => {
      trigger.focus();
    });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // useDrawer focus-return: focus lands back on the opener (the peek header).
    expect(document.activeElement).toBe(trigger);
  });

  it('toggling the peek header again collapses the expanded sheet', () => {
    render(<MobileControlsHarness />);
    const trigger = peekHeader();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // The header is the toggle — clicking it while expanded collapses the sheet.
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('is NON-MODAL: no role=dialog / aria-modal, and never locks body scroll', () => {
    render(<MobileControlsHarness />);
    // Non-modal: the sheet is not a dialog and carries no aria-modal.
    expect(sheet().getAttribute('role')).not.toBe('dialog');
    expect(sheet().getAttribute('aria-modal')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    // Opening must not impose a body-scroll lock (no body-scroll-lock, per useDrawer).
    fireEvent.click(peekHeader());
    expect(document.body.style.overflow).toBe('');
  });
});

// ── U5: controls.css — responsive surface swap + mobile sheet presentation ────
//
// The vite config sets `css: false`, so the `import './controls.css'` in the
// component is a no-op under test and jsdom computes NO layout. So — exactly like
// motion.test.tsx — we read the SHIPPED controls.css off disk, inject it as a
// <style>, and inspect the PARSED CSSOM (not getComputedStyle, which jsdom can't
// resolve for media queries / attribute selectors). These are source-level rule
// presence assertions ("string/class presence, not computed display"); the
// MEASURED geometry (4 column x-offsets, 3 row y-offsets, ≥8px adjacent gap, and
// the display:none-at-desktop a11y-tree exclusion via strict role counts) lives in
// the e2e (U8/U9) where real Chromium computes layout and the a11y tree.
//
// Reading the SHIPPED file (never a fixture copy) means a value/selector drift in
// controls.css fails this gate.

// One outer describe owns the stylesheet injection so it is appended ONLY for the
// CSSOM-inspection tests and removed afterward (afterAll). It must NOT leak into
// the render-based tests above: the base `.mobile-controls { display:none }` rule
// would otherwise hide the whole surface in jsdom (no active media query at the
// default viewport), and the role queries above (which skip hidden elements)
// would fail. Scoping the inject to this describe keeps both halves honest.
describe('U5 — controls.css responsive swap + mobile sheet presentation (CSSOM)', () => {
  const controlsCss = readFileSync(resolve(process.cwd(), 'src/controls/controls.css'), 'utf8');

  let controlsStyle: HTMLStyleElement;

  beforeAll(() => {
    controlsStyle = document.createElement('style');
    controlsStyle.textContent = controlsCss;
    document.head.appendChild(controlsStyle);
  });

  afterAll(() => {
    controlsStyle.remove();
  });

  /** The parsed controls.css stylesheet (throws if jsdom didn't parse it). */
  function controlsSheet(): CSSStyleSheet {
    const s = controlsStyle.sheet;
    if (s === null) throw new Error('controls.css stylesheet not parsed');
    return s;
  }

  /** Top-level (non-media) style rules in controls.css. */
  function topLevelRules(): CSSStyleRule[] {
    return Array.from(controlsSheet().cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule,
    );
  }

  /** Style rules inside the `@media (max-width: 760px)` block. */
  function narrowMediaRules(): CSSStyleRule[] {
    const media = Array.from(controlsSheet().cssRules).filter(
      (r): r is CSSMediaRule => r instanceof CSSMediaRule,
    );
    // The §10 breakpoint mirrors --shell-min-width (760px); CSS media features
    // can't take var(), so the literal lives here exactly as in shell.css.
    const narrow = media.find((r) => r.media.mediaText.includes('760px'));
    if (narrow === undefined) {
      throw new Error('no @media (max-width: 760px) block in controls.css');
    }
    return Array.from(narrow.cssRules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
  }

  /** First top-level rule whose selector matches `sel`. */
  function topRule(sel: string): CSSStyleRule | undefined {
    return topLevelRules().find((r) => r.selectorText === sel);
  }

  describe('responsive surface hide is display:none-only (FINDINGS 3, 6)', () => {
    it('hides the desktop .controls card with display:none INSIDE shell.css @media (max-width: 760px)', () => {
      // The desktop-card hide lives in shell.css's narrow media block, NOT
      // controls.css: the bundle loads controls.css BEFORE shell.css, so a
      // `.controls{display:none}` here (equal specificity) would lose to shell.css's
      // later base `.controls{display:flex}`. Co-locating the override with that
      // base rule makes source order win it (the snapshot bug FINDINGS 2/7 imply).
      const shellCss = readFileSync(resolve(process.cwd(), 'src/shell/shell.css'), 'utf8');
      const shellStyle = document.createElement('style');
      shellStyle.textContent = shellCss;
      document.head.appendChild(shellStyle);
      try {
        const s = shellStyle.sheet;
        if (s === null) throw new Error('shell.css stylesheet not parsed');
        const media = Array.from(s.cssRules).filter(
          (r): r is CSSMediaRule => r instanceof CSSMediaRule,
        );
        const narrow = media.find((r) => r.media.mediaText.includes('760px'));
        if (narrow === undefined) throw new Error('no @media (max-width: 760px) block in shell.css');
        const hide = Array.from(narrow.cssRules)
          .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
          .find((r) => r.selectorText === '.controls');
        expect(hide).toBeDefined();
        expect(hide?.style.display).toBe('none');
      } finally {
        shellStyle.remove();
      }
    });

    it('hides the mobile surface (.mobile-controls) with display:none at ≥760px (base rule)', () => {
      // Mirrors the .topbar-menu precedent: hidden in the base (desktop) cascade,
      // revealed inside the narrow media block — so it leaves the a11y tree ≥760px.
      const base = topRule('.mobile-controls');
      expect(base).toBeDefined();
      expect(base?.style.display).toBe('none');
      const reveal = narrowMediaRules().find((r) => r.selectorText === '.mobile-controls');
      expect(reveal).toBeDefined();
      expect(reveal?.style.display).not.toBe('none');
    });

    it('uses ONLY display:none to hide — never visibility/opacity/transform-offscreen', () => {
      // The hide mechanism MUST drop the hidden surface from the a11y tree; a
      // visibility:hidden / opacity:0 / off-screen transform would leave its
      // radiogroups/checkboxes in the tree and break the desktop strict counts.
      for (const r of [topRule('.mobile-controls'), topRule('.mc-sheet-body')]) {
        expect(r).toBeDefined();
        expect(r?.style.visibility).not.toBe('hidden');
        expect(r?.style.opacity).toBe('');
      }
    });

    it('keeps the CLOSED/peek sheet body out of flow (display:none), revealed only when data-open', () => {
      // Peek: the scrollable body region is display:none so its pills are out of the
      // tab order + a11y tree; [data-open='true'] reveals it.
      const closed = topRule('.mc-sheet-body');
      expect(closed).toBeDefined();
      expect(closed?.style.display).toBe('none');
      const open = topLevelRules().find(
        (r) =>
          r.selectorText.includes("[data-open='true']") &&
          r.selectorText.includes('.mc-sheet-body'),
      );
      expect(open).toBeDefined();
      expect(open?.style.display).not.toBe('none');
      expect(open?.style.display).not.toBe('');
    });
  });

  describe('mobile Root 4×3 grid + ≥8px sheet pill spacing', () => {
    it('lays the in-sheet Root track out as a 4-column grid (12 pills → 4×3 reading order)', () => {
      // Scoped to the Root track inside the sheet by its stable aria-label, so ONLY
      // Root becomes a grid (Scale keeps the flex-wrap row). 4 columns × 12 pills =
      // 3 rows; grid auto-flow row preserves the §9.1 ascending-chromatic order.
      const grid = topLevelRules().find(
        (r) =>
          r.selectorText.includes('.mc-sheet') &&
          r.selectorText.includes("[aria-label='Root note']") &&
          r.style.display === 'grid',
      );
      expect(grid).toBeDefined();
      expect(grid?.style.gridTemplateColumns).toMatch(/repeat\(\s*4\s*,/);
    });

    it('hides the 1-D .pill-highlight inside the sheet grid (2-D relies on .is-active wash)', () => {
      // The translateX highlight has no meaning in a 2-D grid; hide it in the sheet
      // grid context and rely on RootRow's .is-active pill wash. The DESKTOP row
      // keeps its highlight (asserted below).
      const hidden = topLevelRules().find(
        (r) =>
          r.selectorText.includes('.mc-sheet') &&
          r.selectorText.includes("[aria-label='Root note']") &&
          r.selectorText.includes('.pill-highlight') &&
          r.style.display === 'none',
      );
      expect(hidden).toBeDefined();
    });

    it('sets the in-sheet pill gap to ≥8px (--space-200) so the 44px hit-pads stop colliding', () => {
      // WCAG 2.5.5: the centered 44px ::before hit-pads overlap at the 4px desktop
      // gap; the sheet widens it to --space-200 (8px).
      const sheetTrack = topLevelRules().find(
        (r) =>
          r.selectorText.includes('.mc-sheet') &&
          r.selectorText.includes('.pill-track') &&
          r.style.gap !== '',
      );
      expect(sheetTrack).toBeDefined();
      expect(sheetTrack?.style.gap).toBe('var(--space-200)');
    });
  });

  describe('desktop controls.css behaviour stays byte-stable', () => {
    it('keeps the desktop .pill-track gap at 4px (--space-100) untouched', () => {
      const base = topRule('.pill-track');
      expect(base).toBeDefined();
      expect(base?.style.gap).toBe('var(--space-100)');
    });

    it('keeps the desktop .pill-highlight rule (not globally hidden)', () => {
      // The grid hides the highlight ONLY in the sheet context; the desktop row's
      // base .pill-highlight rule is unchanged and never display:none.
      const base = topRule('.pill-highlight');
      expect(base).toBeDefined();
      expect(base?.style.display).not.toBe('none');
    });
  });

  // ── U7: peek header + sheet chrome are STYLED (FINDINGS 2, 3, 6, 7) ───────────
  //
  // The single peek header IS the summary: a bottom-pinned header row (drag-grip +
  // summary text + expand chevron) that meets the WCAG 2.5.5 44px floor on its own
  // box and reads as the sheet's top band. The sheet anchors to the viewport bottom,
  // full width, opaque (a non-modal sheet must not be transparent). (CSSOM
  // rule-presence; the MEASURED geometry is the e2e U8/U9 at a real viewport.)
  describe('U7 — sheet anchors to the viewport bottom and is opaque (FINDINGS 2, 6, 7)', () => {
    it('anchors the .controls-sheet to the bottom edge, full width, so the peek math means something', () => {
      const r = topRule('.controls-sheet');
      expect(r).toBeDefined();
      // Without these insets a position:fixed box keeps its static origin + content
      // width — the four insets are what make it an actual bottom sheet.
      // jsdom's CSSOM normalizes a bare `0` length to `0px`.
      expect(r?.style.bottom).toBe('0px');
      expect(r?.style.left).toBe('0px');
      expect(r?.style.right).toBe('0px');
    });

    it('gives the .controls-sheet an opaque --surface background (non-modal sheet must not be transparent)', () => {
      const r = topRule('.controls-sheet');
      expect(r?.style.background).toBe('var(--surface)');
      // It caps + scrolls so a tall sheet never runs off a short phone's top edge.
      expect(r?.style.maxHeight).not.toBe('');
    });
  });

  describe('U7 — peek header / close are styled + meet the 44px floor (FINDINGS 3, 7)', () => {
    it('fills the .mc-header to the §0 peek-band height and meets the 44px floor (a real tap target)', () => {
      const r = topRule('.mc-header');
      expect(r).toBeDefined();
      // The peek header IS the peek band: it fills --sheet-peek-h (≥ touch-target-min)
      // and is the always-visible summary the sheet pokes above the bottom edge.
      expect(r?.style.minHeight).toBe('var(--sheet-peek-h)');
      expect(r?.style.width).toBe('100%');
    });

    it('gives the .mc-close button a 44px min-height (WCAG 2.5.5)', () => {
      const r = topRule('.mc-close');
      expect(r).toBeDefined();
      expect(r?.style.minHeight).toBe('var(--touch-target-min)');
    });
  });

  // ── U6: sheet motion — transitions-dev #07 transform-only translateY ────────
  //
  // The sheet is transitions-dev panel-reveal (#07) applied TRANSFORM-ONLY on
  // translateY (the same trim the in-tree tape slide uses): peek =
  // translateY(calc(100% - var(--sheet-peek-h))), expand = translateY(0), tweened
  // on --state-color (200ms) --ease-standard. Opacity stays 1 and there is NO
  // filter blur (so the peek band is legible). NON-modal: the sheet sits at z-40
  // (peer of the removed drawer, below the palette z-50) with no overlay scrim.
  // Reduced-motion: a single specificity-matched block sets transition:none so it
  // wins the cascade. Values trace to §0 by name; NO spring, no motion library.
  // These are source-level rule-presence assertions (CSSOM); the SETTLED transform
  // and the reduced-motion snap are measured in the e2e (U8).
  describe('U6 — sheet motion is #07 transform-only translateY (§7/§10)', () => {
    /** The base `.controls-sheet` motion rule (peek transform + transition). */
    function sheetRule(): CSSStyleRule | undefined {
      return topRule('.controls-sheet');
    }

    it('peeks via translateY(calc(100% - var(--sheet-peek-h))) on the sheet chrome', () => {
      const r = sheetRule();
      expect(r).toBeDefined();
      // transform-only translateY: peek slides the sheet down by its full height
      // minus the visible peek band.
      expect(r?.style.transform).toMatch(
        /translateY\(\s*calc\(100% - var\(--sheet-peek-h\)\)\s*\)/,
      );
    });

    it('expands to translateY(0) when data-open=true', () => {
      const open = topLevelRules().find(
        (r) =>
          r.selectorText.includes('.controls-sheet') &&
          r.selectorText.includes("[data-open='true']"),
      );
      expect(open).toBeDefined();
      expect(open?.style.transform).toMatch(/translateY\(\s*0\w*\s*\)/);
    });

    it('tweens ONLY transform on --state-color (200ms) --ease-standard — NO spring', () => {
      const r = sheetRule();
      expect(r).toBeDefined();
      const t = r?.style.transition ?? '';
      expect(t).toContain('transform');
      expect(t).toContain('var(--state-color)');
      expect(t).toContain('var(--ease-standard)');
      // No spring/overshoot easing on chrome (§0 easing guards); no opacity tween.
      expect(t).not.toContain('ease-spring');
      expect(t).not.toContain('ease-overshoot');
      expect(t).not.toContain('opacity');
    });

    it('is transform-only: opacity stays 1 and there is NO filter blur (peek legible)', () => {
      const r = sheetRule();
      expect(r).toBeDefined();
      // The deliberate trim from stock #07: no opacity fade, no blur, so the peek
      // band stays readable.
      expect(r?.style.opacity).not.toBe('0');
      expect(r?.style.filter).toBe('');
    });

    it('sits at z-40 (peer of the removed drawer, below the palette z-50), non-modal', () => {
      const r = sheetRule();
      expect(r).toBeDefined();
      expect(r?.style.zIndex).toBe('40');
      // Non-modal: no full overlay scrim rule ships with the sheet.
      const scrim = topLevelRules().find(
        (rr) => rr.selectorText.includes('.controls-sheet') && rr.selectorText.includes('scrim'),
      );
      expect(scrim).toBeUndefined();
    });

    it('gates motion under prefers-reduced-motion: reduce with a specificity-matched none', () => {
      // A single @media (prefers-reduced-motion: reduce){ .controls-sheet{ transition:none } }
      // at the SAME specificity as the base rule so it wins the cascade.
      const reduce = Array.from(controlsSheet().cssRules)
        .filter((r): r is CSSMediaRule => r instanceof CSSMediaRule)
        .find((r) => r.media.mediaText.includes('prefers-reduced-motion'));
      expect(reduce).toBeDefined();
      const rule = Array.from(reduce?.cssRules ?? [])
        .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
        .find((r) => r.selectorText === '.controls-sheet');
      expect(rule).toBeDefined();
      expect(rule?.style.transition).toBe('none');
    });
  });

  // ── U6: --sheet-peek-h token declared in DESIGN.md §0 FIRST, then mirrored ───
  //
  // Token presence is verifiable here: the §0 layout block declares `sheet-peek-h`
  // (with a derivation comment, checked by the design-reviewer), and tokens.css
  // mirrors `--sheet-peek-h`. Reading the SHIPPED files (never a fixture) means a
  // drift in either file fails this gate. Vitest cwd is apps/web, so DESIGN.md is
  // two levels up at the repo root.
  describe('U6 — --sheet-peek-h declared in §0 first, mirrored into tokens.css', () => {
    it('declares sheet-peek-h in the DESIGN.md §0 layout block', () => {
      const design = readFileSync(resolve(process.cwd(), '../../DESIGN.md'), 'utf8');
      // §0 declares it after touch-target-min, on the 4px scale, value in px.
      expect(design).toMatch(/sheet-peek-h:\s*"\d+px"/);
    });

    it('mirrors --sheet-peek-h into the tokens.css layout block (same px value)', () => {
      const design = readFileSync(resolve(process.cwd(), '../../DESIGN.md'), 'utf8');
      const tokens = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
      const designVal = /sheet-peek-h:\s*"(\d+px)"/.exec(design)?.[1];
      const tokensVal = /--sheet-peek-h:\s*(\d+px)/.exec(tokens)?.[1];
      expect(designVal).toBeDefined();
      expect(tokensVal).toBeDefined();
      expect(tokensVal).toBe(designVal);
    });
  });
});
