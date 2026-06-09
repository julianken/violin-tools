import { type Page, expect, test } from '@playwright/test';

// responsive.spec — the Playwright (real Chromium) half of the §10 mobile-reflow
// verification (S11), extended by S16 ph2 (auto vertical-on-mobile). DESIGN.md §10
// /§12.1 win on any conflict (AGENTS.md). jsdom (the Vitest layer) can't compute a
// media query, a CSS transform slide, or `scrollWidth`, so THIS suite asserts the
// LIVE responsive contract against the SHIPPED bundle:
//   • at 390×844 AND 320×568 (the WCAG 1.4.10 reflow floor) the PAGE never
//     overflows horizontally — `document.scrollingElement.scrollWidth <=
//     clientWidth`, the 458px bug gone;
//   • at mobile PORTRAIT the note map resolves VERTICAL (S16 ph2): the intrinsically
//     narrow viewBox ('0 0 352 850') fits the plate because
//     `.board[data-orientation=vertical]{min-width:0}` (U2) drops the 760px floor,
//     so the `.panel` plate ITSELF no longer h-scrolls either — the real proof U2's
//     min-width:0 landed (the previous plan only checked the page, but the BLOCKER
//     showed `.panel` overflow was being hidden internally);
//   • internal horizontal scroll of the plate still applies where the map is
//     HORIZONTAL and the 760px board exceeds the plate (a landscape/desktop width),
//     so that coverage is re-scoped to a landscape viewport rather than asserting
//     stale horizontal behavior at mobile portrait;
//   • the sidebar is HIDDEN below the breakpoint (S16 ph3 dropped the off-canvas
//     drawer; the mobile top-bar search trigger + the controls bottom sheet take
//     over its role) and the mobile controls are a SINGLE NON-MODAL bottom sheet
//     whose PEEK HEADER IS the summary (activating it expands the sheet up; Esc
//     closes, focus returns to the peek header; no separate in-flow summary bar);
//   • the controls wrap (not one pill per line);
//   • at 1440×900 the desktop shell is UNCHANGED (248px sidebar; no mobile search
//     trigger; the desktop controls card, not the mobile sheet).
//
// NOTE on the assertion (per the issue's plan-review SUGGESTION): the robust
// invariant is `scrollWidth <= clientWidth` (no overflow relative to the viewport
// actually given), with the CONFIGURED viewport the floor — not a hard literal
// compared against scrollWidth. Playwright runs headless (no OS scrollbar chrome),
// so the few-px slop a real device might show does not appear here; this gate
// proves the layout reflows, not a cross-device pixel guarantee.
//
// PORTRAIT vs LANDSCAPE resolves the orientation: a viewport with height > width is
// portrait, so `matchMedia('(orientation: landscape)')` is false →
// `resolveOrientation('auto', false)` returns 'vertical' (mapView.ts +
// useIsLandscape.ts). The viewport MUST be set BEFORE goto('/') so the first paint
// resolves the right orientation.
//
// It ships SOFT (the existing non-required e2e job runs `e2e/**`), to be promoted
// at the S12 capstone (the GAPS.md soft-launch ritual).

const MOBILE = { width: 390, height: 844 };
// The WCAG 1.4.10 reflow floor: 320 CSS px. Portrait (height > width) → vertical.
const MOBILE_320 = { width: 320, height: 568 };
// A LANDSCAPE viewport (width > height) → matchMedia landscape true → horizontal
// map at the 760px board floor. 1000×600 is wide enough to keep the desktop two-
// column shell (above the 760px reflow breakpoint), so the 248px rail + 880-max
// content leave the `.panel` plate narrower than 760px → the board h-scrolls INSIDE
// the plate (the deliberate internal-scroll behavior, now scoped to horizontal).
const LANDSCAPE_NARROW = { width: 1000, height: 600 };
const DESKTOP = { width: 1440, height: 900 };

test.describe('§10 mobile reflow @ 390×844 — no horizontal page overflow', () => {
  test('the page does not scroll horizontally (the 458px overflow is gone)', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const de = document.scrollingElement ?? document.documentElement;
      const panel = document.querySelector<HTMLElement>('.panel');
      return {
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
        // The PLATE itself — at mobile portrait the map is vertical, so U2's
        // min-width:0 means the plate no longer h-scrolls a 760px board either.
        panelScrollWidth: panel?.scrollWidth ?? 0,
        panelClientWidth: panel?.clientWidth ?? 0,
      };
    });
    // The headline AC: no horizontal overflow relative to the 390px viewport.
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    // And the viewport really is the 390 we configured (guards a silent default).
    expect(metrics.clientWidth).toBe(MOBILE.width);
    // S16 ph2: the vertical map fits the plate, so the .panel itself does NOT
    // h-scroll — the real proof U2's `.board[data-orientation=vertical]{min-width:0}`
    // landed (a hidden plate overflow would NOT show up in the page check above).
    expect(metrics.panelScrollWidth).toBeLessThanOrEqual(metrics.panelClientWidth);
  });

  test('@ 320px (WCAG 1.4.10 floor) neither the page NOR the plate h-scrolls', async ({ page }) => {
    // Set the viewport BEFORE goto so the FIRST paint resolves orientation:
    // 320×568 is portrait → matchMedia('(orientation: landscape)') is false →
    // resolveOrientation('auto', false) === 'vertical', so the narrow vertical
    // viewBox renders and U2's min-width:0 lets it fit the 320px plate.
    await page.setViewportSize(MOBILE_320);
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const de = document.scrollingElement ?? document.documentElement;
      const panel = document.querySelector<HTMLElement>('.panel');
      return {
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
        panelScrollWidth: panel?.scrollWidth ?? 0,
        panelClientWidth: panel?.clientWidth ?? 0,
      };
    });
    // The page does not overflow at the 320px reflow floor.
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.clientWidth).toBe(MOBILE_320.width);
    // CRITICAL — the PLATE itself does not h-scroll: this is what proves U2's
    // min-width:0 fix landed (the previous plan only checked the page, but the
    // BLOCKER showed .panel overflow was hidden inside the plate's overflow-x:auto).
    expect(metrics.panelScrollWidth).toBeLessThanOrEqual(metrics.panelClientWidth);
  });

  test('the note-map plate scrolls INTERNALLY when HORIZONTAL (landscape width)', async ({
    page,
  }) => {
    // RESCOPED (S16 ph2): at mobile PORTRAIT the map is now vertical + narrow with
    // min-width:0, so the plate no longer h-scrolls a 760px SVG — that stale
    // horizontal assertion moved to the portrait no-overflow tests above (which now
    // assert panel.scrollWidth <= panel.clientWidth). Internal horizontal scroll is
    // a HORIZONTAL-map behavior, so this re-scopes it to a LANDSCAPE viewport where
    // the map resolves horizontal and the 760px board still exceeds the plate.
    await page.setViewportSize(LANDSCAPE_NARROW);
    await page.goto('/');
    const plate = page.locator('.panel');
    await expect(plate).toBeVisible();

    const result = await plate.evaluate((el) => {
      const de = document.scrollingElement ?? document.documentElement;
      const board = el.querySelector<SVGSVGElement>('svg#board');
      return {
        orientation: board?.getAttribute('data-orientation') ?? null,
        plateScrolls: el.scrollWidth > el.clientWidth,
        plateRight: Math.round(el.getBoundingClientRect().right),
        viewportWidth: de.clientWidth,
        pageOverflow: de.scrollWidth > de.clientWidth,
      };
    });
    // Landscape → the map is horizontal (the 760px board floor still applies).
    expect(result.orientation).toBe('horizontal');
    // The board keeps its 760px min-width → the plate is horizontally scrollable…
    expect(result.plateScrolls).toBe(true);
    // …but it stays within the viewport and never widens the page.
    expect(result.plateRight).toBeLessThanOrEqual(result.viewportWidth + 1);
    expect(result.pageOverflow).toBe(false);
  });

  test('the Root picker is a 4×3 grid in the sheet (12 pills, multiple per row)', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    // S16 ph3: the Root pills live in the bottom sheet as a 4×3 grid (not a
    // wrapping flex row on the page). Open the sheet, then assert the 12 pills lay
    // out across multiple rows AND multiple columns (a grid, not one-per-line).
    await page.getByRole('button', { name: /^Scale controls,/ }).click();
    const rootGroup = page.getByRole('radiogroup', { name: 'Root note' });
    const boxes = await rootGroup.locator('.pill').evaluateAll((pills) =>
      pills.map((p) => {
        const b = p.getBoundingClientRect();
        return { top: Math.round(b.top), left: Math.round(b.left) };
      }),
    );
    expect(boxes).toHaveLength(12);
    const distinctRows = new Set(boxes.map((b) => b.top)).size;
    const distinctCols = new Set(boxes.map((b) => b.left)).size;
    // 12 pills → 4 columns × 3 rows: ≥2 rows AND >1 column (a grid, never one-per-
    // line, never one-per-row). The grid template caps it at 4 columns.
    expect(distinctRows).toBeGreaterThanOrEqual(2);
    expect(distinctRows).toBeLessThan(boxes.length);
    expect(distinctCols).toBeGreaterThan(1);
  });
});

test.describe('§10/§16 mobile controls — single bottom sheet, peek header expands (S16 ph3)', () => {
  // S16 ph3 dropped the off-canvas drawer (the topbar hamburger / "Open navigation"
  // trigger / .side.is-open slide are GONE) AND consolidated the mobile controls to
  // ONE non-modal bottom sheet whose PEEK band IS the summary: a bottom-pinned PEEK
  // HEADER (drag-grip + summary text + expand chevron) is the SINGLE trigger — there
  // is NO separate in-flow summary bar. The header's accessible name leads with
  // "Scale controls, " then the live summary, so it is matched by that prefix; it
  // lives INSIDE the sheet (it pins the sheet to the bottom edge).
  const peekHeader = (page: Page) => page.getByRole('button', { name: /^Scale controls,/ });

  test('the drawer is gone: the 248px rail is display:none and there is no "Open navigation"', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    // The rail is removed below the breakpoint (no off-canvas drawer to slide).
    const railDisplay = await page
      .locator('.side')
      .evaluate((el) => getComputedStyle(el).display);
    expect(railDisplay).toBe('none');
    // The dropped hamburger trigger no longer exists anywhere.
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveCount(0);
    // The mobile-only top-bar search trigger took over the drawer's reachability.
    await expect(page.getByRole('button', { name: 'Search scales and tools' })).toBeVisible();
  });

  test('the peek header IS the single trigger — no redundant in-flow summary bar', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    // Exactly ONE control leads with "Scale controls," — the sheet's peek header.
    // The old standalone summary bar in the content flow is gone (no third "A Major"
    // under the H1 + breadcrumb).
    await expect(peekHeader(page)).toHaveCount(1);
    // It lives INSIDE the sheet it controls (it is the sheet's bottom-pinned band),
    // not a separate in-flow element above it.
    const header = peekHeader(page);
    const sheetId = await header.getAttribute('aria-controls');
    expect(sheetId).not.toBeNull();
    const inSheet = await header.evaluate((el, id) => el.closest(`#${id}`) !== null, sheetId ?? '');
    expect(inSheet).toBe(true);
  });

  test('the peek header expands the bottom sheet and reveals the controls (peek→expand)', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const header = peekHeader(page);
    await expect(header).toBeVisible();
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    // The header meets the WCAG 2.5.5 44px floor on its OWN box (U7 CSS — it fills
    // the §0 peek band).
    const headerHeight = await header.evaluate((el) =>
      Math.round(el.getBoundingClientRect().height),
    );
    expect(headerHeight).toBeGreaterThanOrEqual(44);

    // The sheet the header controls; at peek, its body rows are out of the a11y tree.
    const sheetId = await header.getAttribute('aria-controls');
    expect(sheetId).not.toBeNull();
    const sheet = page.locator(`#${sheetId ?? ''}`);
    // The sheet is a NON-MODAL bottom sheet: position:fixed, anchored to the bottom
    // edge, opaque (FINDINGS 2/6/7) — not a dialog.
    const closed = await sheet.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        position: cs.position,
        bottom: cs.bottom,
        opaque: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent',
        right: Math.round(el.getBoundingClientRect().right),
        left: Math.round(el.getBoundingClientRect().left),
        role: el.getAttribute('role'),
      };
    });
    expect(closed.position).toBe('fixed');
    expect(closed.bottom).toBe('0px');
    expect(closed.opaque).toBe(true);
    expect(closed.left).toBe(0); // anchored full-width to the viewport
    expect(closed.role).not.toBe('dialog'); // non-modal

    // Open it: the four controls rows (Root/Scale/Refs/View) become reachable.
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(sheet.getByRole('radiogroup', { name: 'Root note' })).toBeVisible();
    await expect(sheet.getByRole('radiogroup', { name: 'Orientation' })).toBeVisible();

    // Opening does not widen the page (the sheet is fixed/off-flow).
    const overflow = await page.evaluate(() => {
      const de = document.scrollingElement ?? document.documentElement;
      return de.scrollWidth > de.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test('Escape closes the non-modal sheet and returns focus to the peek header', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const header = peekHeader(page);
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    // Focus returns to the peek header (the useDrawer focus-return contract).
    const focusOnHeader = await header.evaluate((el) => el === document.activeElement);
    expect(focusOnHeader).toBe(true);
  });

  test('tapping the peek header again collapses the expanded sheet (handle dismissal)', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const header = peekHeader(page);
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    // The header (the drag-grip band) toggles the sheet — tapping it while expanded
    // collapses back to peek (one of the non-modal dismissal set: header + Esc + Close).
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('§10 desktop @ 1440×900 — the shell is unchanged', () => {
  test('the sidebar is the 248px sticky rail; no mobile search trigger; no overflow', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    // The mobile-only top-bar search trigger is hidden on desktop (the desktop
    // topbar is unchanged; the sidebar search stays the sole palette opener). The
    // dropped drawer hamburger no longer exists at all.
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveCount(0);
    // The sidebar search stays the sole VISIBLE "Search scales and tools" opener on
    // desktop (regex: its accessible name also carries the ⌘K kbd). The mobile
    // top-bar search is display:none here.
    await expect(page.getByRole('button', { name: /search scales and tools/i })).toBeVisible();
    await expect(page.locator('.topbar-search')).toBeHidden();
    // The desktop controls card is the surface (the mobile sheet peek header is hidden).
    await expect(page.getByRole('button', { name: /^Scale controls,/ })).toBeHidden();

    const desk = await page.locator('.side').evaluate((el) => {
      const cs = getComputedStyle(el);
      const de = document.scrollingElement ?? document.documentElement;
      return {
        position: cs.position,
        visibility: cs.visibility,
        width: Math.round(el.getBoundingClientRect().width),
        pageOverflow: de.scrollWidth > de.clientWidth,
      };
    });
    expect(desk.position).toBe('sticky'); // not fixed/off-canvas
    expect(desk.visibility).toBe('visible');
    expect(desk.width).toBe(248);
    expect(desk.pageOverflow).toBe(false);
  });
});

// S18 ph6 (§17) — the new Tuner view must reflow on a phone exactly like the note
// map: no horizontal page overflow at the 390 and 320 floors. Below the §10
// breakpoint the sidebar is hidden, so the Tuner is reached via the command palette
// (the mobile top-bar search trigger), not the sidebar nav item.
test.describe('§17 Tuner view — mobile reflow (no horizontal overflow)', () => {
  for (const vp of [MOBILE, MOBILE_320]) {
    test(`@ ${String(vp.width)}×${String(vp.height)} the Tuner view does not h-scroll`, async ({
      page,
    }) => {
      await page.setViewportSize(vp);
      await page.goto('/');
      await expect(page.locator('svg#board')).toBeVisible();

      // Open the palette (the mobile top-bar search trigger) and jump to the Tuner.
      await page.locator('.topbar-search').click();
      const dialog = page.getByRole('dialog', { name: 'Scale search' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('textbox', { name: 'Search scales and tools' }).fill('Tuner');
      await dialog
        .getByRole('listbox', { name: 'Results' })
        .getByRole('option', { name: /Tuner/ })
        .first()
        .click();

      // The Tuner view is now showing (the board is gone).
      await expect(page.getByRole('heading', { level: 1, name: 'Chromatic tuner' })).toBeVisible();
      await expect(page.locator('svg#board')).toHaveCount(0);

      const metrics = await page.evaluate(() => {
        const de = document.scrollingElement ?? document.documentElement;
        return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth };
      });
      // The headline AC: the Tuner view never overflows the viewport horizontally.
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
      expect(metrics.clientWidth).toBe(vp.width);
    });
  }
});
