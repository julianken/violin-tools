import { expect, test } from '@playwright/test';

// responsive.spec — the Playwright (real Chromium) half of the §10 mobile-reflow
// verification (S11). DESIGN.md §10 wins on any conflict (AGENTS.md). jsdom (the
// Vitest layer) can't compute a media query, a CSS transform slide, or
// `scrollWidth`, so THIS suite asserts the LIVE responsive contract against the
// SHIPPED bundle:
//   • at 390×844 the PAGE never overflows horizontally (the headline AC) —
//     `document.scrollingElement.scrollWidth <= clientWidth`, the 458px bug gone;
//   • the note-map plate STILL scrolls internally (the SVG keeps its 760px
//     min-width) without widening the page;
//   • the sidebar collapses to a drawer the topbar trigger opens/closes, with the
//     drawer keyboard-operable (Esc closes, focus returns to the trigger);
//   • the controls wrap (not one pill per line);
//   • at 1440×900 the desktop shell is UNCHANGED (248px sidebar, no trigger).
//
// NOTE on the assertion (per the issue's plan-review SUGGESTION): the robust
// invariant is `scrollWidth <= clientWidth` (no overflow relative to the viewport
// actually given), with 390 the CONFIGURED viewport — not a hard literal compared
// against scrollWidth. Playwright runs headless (no OS scrollbar chrome), so the
// few-px slop a real device might show does not appear here; this gate proves the
// layout reflows, not a cross-device pixel guarantee.
//
// It ships SOFT (the existing non-required e2e job runs `e2e/**`), to be promoted
// at the S12 capstone (the GAPS.md soft-launch ritual).

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

test.describe('§10 mobile reflow @ 390×844 — no horizontal page overflow', () => {
  test('the page does not scroll horizontally (the 458px overflow is gone)', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const de = document.scrollingElement ?? document.documentElement;
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth };
    });
    // The headline AC: no horizontal overflow relative to the 390px viewport.
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    // And the viewport really is the 390 we configured (guards a silent default).
    expect(metrics.clientWidth).toBe(MOBILE.width);
  });

  test('the note-map plate still scrolls INTERNALLY without widening the page', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    const plate = page.locator('.panel');
    await expect(plate).toBeVisible();

    const result = await plate.evaluate((el) => {
      const de = document.scrollingElement ?? document.documentElement;
      return {
        plateScrolls: el.scrollWidth > el.clientWidth,
        plateRight: Math.round(el.getBoundingClientRect().right),
        viewportWidth: de.clientWidth,
        pageOverflow: de.scrollWidth > de.clientWidth,
      };
    });
    // The SVG keeps its 760px min-width → the plate is horizontally scrollable…
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
