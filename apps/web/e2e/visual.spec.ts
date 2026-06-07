import { expect, test } from '@playwright/test';

// visual.spec — the S13 capstone visual-acceptance snapshots of the Scales tool
// at the two §10 viewports, under reduced motion (§11.4) so the captures are
// deterministic (no in-flight stagger/keyframe). DESIGN.md §10 wins on any
// conflict (AGENTS.md).
//
// §10 contract note (AS SHIPPED): the original "narrow-floor" contract (sidebar
// stays 248px, plate horizontal-scrolls, everything else unchanged) was RETIRED by
// S11 (#39 / PR #72), which shipped a TRUE mobile reflow — below 760px the sidebar
// collapses to an off-canvas drawer, content + plate go full width, controls wrap,
// and the page never overflows horizontally at 390px. So the 390×844 capture here
// asserts the SHIPPED reflow + the no-horizontal-overflow invariant, NOT the dead
// narrow floor. The exhaustive reflow behavior is in responsive.spec.ts; this spec
// adds the pixel snapshots the capstone calls for plus the load-bearing layout
// invariants at each viewport.
//
// Snapshots are full-page PNGs committed under e2e/visual.spec.ts-snapshots/. They
// are captured at the shipped bundle; a layout regression at either viewport (or a
// reintroduced 390px overflow) fails the gate.
//
// Reduced motion is forced (emulateMedia, before navigation) so the captures are
// deterministic — no in-flight stagger/keyframe.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

test.describe('S13 visual — desktop 1440×900', () => {
  test('the desktop shell matches the committed snapshot', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    // Load-bearing desktop invariant: the 248px sticky rail is intact, no drawer
    // trigger, and the page does not overflow horizontally.
    const desk = await page.locator('.side').evaluate((el) => {
      const de = document.scrollingElement ?? document.documentElement;
      return {
        width: Math.round(el.getBoundingClientRect().width),
        pageOverflow: de.scrollWidth > de.clientWidth,
      };
    });
    expect(desk.width).toBe(248);
    expect(desk.pageOverflow).toBe(false);
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();

    await expect(page).toHaveScreenshot('scales-desktop-1440x900.png', { fullPage: true });
  });
});

test.describe('S13 visual — mobile 390×844 (the shipped reflow, no overflow)', () => {
  test('the reflowed mobile layout matches the committed snapshot', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    // Load-bearing mobile invariant (AS SHIPPED, S11): the page never overflows
    // horizontally at 390px, the sidebar is the off-canvas drawer (the topbar
    // trigger is present), and the H1 holds its 32px box (§10).
    const metrics = await page.evaluate(() => {
      const de = document.scrollingElement ?? document.documentElement;
      const h1 = document.querySelector('h1.h1');
      const cs = h1 ? getComputedStyle(h1) : null;
      return {
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
        h1FontSize: cs?.fontSize ?? null,
      };
    });
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.clientWidth).toBe(MOBILE.width);
    // §10: the H1 is 32px at every width.
    expect(metrics.h1FontSize).toBe('32px');
    // The drawer trigger is the reflow tell (the 248px rail collapsed off-canvas).
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();

    await expect(page).toHaveScreenshot('scales-mobile-390x844.png', { fullPage: true });
  });
});
