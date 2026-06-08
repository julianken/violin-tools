import { expect, test } from '@playwright/test';

// visual.spec — the S13 capstone visual-acceptance snapshots of the Scales tool
// at the two §10 viewports, under reduced motion (§11.4) so the captures are
// deterministic (no in-flight stagger/keyframe). DESIGN.md §10 wins on any
// conflict (AGENTS.md).
//
// §10 contract note (AS SHIPPED): the original "narrow-floor" contract (sidebar
// stays 248px, plate horizontal-scrolls, everything else unchanged) was RETIRED by
// S11 (#39 / PR #72), which shipped a TRUE mobile reflow. S16 ph3 then DROPPED the
// off-canvas drawer entirely: below 760px the 248px sidebar is hidden, the mobile
// top-bar search trigger + a single non-modal controls bottom sheet (whose peek
// header IS the summary) take over, the content + plate go full width, and the page
// never overflows horizontally at 390px. So the 390×844 capture here asserts the
// SHIPPED mobile surface (the bottom-sheet peek header, no drawer, no separate
// summary bar) + the no-horizontal-overflow invariant, NOT the dead narrow floor. The exhaustive reflow behavior is in responsive.spec.ts; this
// spec adds the pixel snapshots the capstone calls for plus the load-bearing layout
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
    // S16 ph3: the drawer hamburger is gone; the mobile top-bar search is
    // display:none on desktop (the desktop topbar is unchanged).
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveCount(0);
    await expect(page.locator('.topbar-search')).toBeHidden();

    await expect(page).toHaveScreenshot('scales-desktop-1440x900.png', { fullPage: true });
  });
});

test.describe('S13 visual — mobile 390×844 (the shipped reflow, no overflow)', () => {
  test('the reflowed mobile layout matches the committed snapshot', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    // Load-bearing mobile invariant (AS SHIPPED, S16 ph3): the page never overflows
    // horizontally at 390px, the 248px rail is hidden (drawer dropped), and the H1
    // holds its 32px box (§10).
    const metrics = await page.evaluate(() => {
      const de = document.scrollingElement ?? document.documentElement;
      const h1 = document.querySelector('h1.h1');
      const cs = h1 ? getComputedStyle(h1) : null;
      const side = document.querySelector('.side');
      return {
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
        h1FontSize: cs?.fontSize ?? null,
        sideDisplay: side ? getComputedStyle(side).display : null,
      };
    });
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.clientWidth).toBe(MOBILE.width);
    // §10: the H1 is 32px at every width.
    expect(metrics.h1FontSize).toBe('32px');
    // The reflow tell (S16 ph3): the 248px rail is hidden (no off-canvas drawer),
    // and the mobile controls sheet's peek header is the controls surface.
    expect(metrics.sideDisplay).toBe('none');
    await expect(page.getByRole('button', { name: /^Scale controls,/ })).toBeVisible();

    await expect(page).toHaveScreenshot('scales-mobile-390x844.png', { fullPage: true });
  });
});
