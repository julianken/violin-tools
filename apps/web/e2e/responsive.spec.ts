import { expect, test } from '@playwright/test';

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
//   • the sidebar collapses to a drawer the topbar trigger opens/closes, with the
//     drawer keyboard-operable (Esc closes, focus returns to the trigger);
//   • the controls wrap (not one pill per line);
//   • at 1440×900 the desktop shell is UNCHANGED (248px sidebar, no trigger).
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

  test('the controls wrap (more than one pill per visual row)', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    // The Root radiogroup has 12 pills; on a 390px column they must wrap onto
    // multiple rows (distinct top offsets), not stack one-per-line full width.
    const rootGroup = page.getByRole('radiogroup', { name: 'Root note' });
    const tops = await rootGroup.locator('.pill').evaluateAll((pills) =>
      pills.map((p) => Math.round(p.getBoundingClientRect().top)),
    );
    const distinctRows = new Set(tops).size;
    // Wrapping = at least 2 rows but FEWER rows than pills (i.e. multiple pills
    // share a row — not one-per-line). 12 pills, ≥2 rows, <12 rows.
    expect(distinctRows).toBeGreaterThanOrEqual(2);
    expect(distinctRows).toBeLessThan(tops.length);
  });
});

test.describe('§10 mobile drawer — keyboard-operable, focus-managed', () => {
  test('the topbar trigger opens the drawer and the sidebar slides in', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // The rail is on-canvas (translateX 0) and visible while open.
    const rail = page.locator('.side');
    await expect(rail).toHaveClass(/is-open/);
    await expect(rail).toBeVisible();
    // The slide is a 200ms transition; poll until the transform settles at
    // translateX(0) so we assert the END state, not a mid-animation frame.
    // matrix(1, 0, 0, 1, 0, 0) === translateX(0); off-canvas would be ~-248.
    await expect
      .poll(async () => rail.evaluate((el) => getComputedStyle(el).transform))
      .toBe('matrix(1, 0, 0, 1, 0, 0)');
    const railVisibility = await rail.evaluate((el) => getComputedStyle(el).visibility);
    expect(railVisibility).toBe('visible');

    // Opening still doesn't widen the page (the drawer is fixed/off-flow).
    const overflow = await page.evaluate(() => {
      const de = document.scrollingElement ?? document.documentElement;
      return de.scrollWidth > de.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test('Escape closes the drawer and returns focus to the trigger', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.side')).not.toHaveClass(/is-open/);
    // Focus returns to the trigger (the WAI-ARIA focus-return contract).
    const focusOnTrigger = await trigger.evaluate((el) => el === document.activeElement);
    expect(focusOnTrigger).toBe(true);
  });

  test('the closed drawer is off-canvas (hidden, not a tab trap)', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    // While closed below the breakpoint, the drawer is visibility:hidden so its
    // search/nav/theme controls are out of the tab order (no off-canvas hazard).
    const railVisibility = await page
      .locator('.side')
      .evaluate((el) => getComputedStyle(el).visibility);
    expect(railVisibility).toBe('hidden');
  });
});

test.describe('§10 desktop @ 1440×900 — the shell is unchanged', () => {
  test('the sidebar is the 248px sticky rail; no drawer trigger; no overflow', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    // The drawer trigger is hidden on desktop (the desktop topbar is unchanged).
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();

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
