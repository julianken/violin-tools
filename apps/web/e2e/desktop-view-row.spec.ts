import { expect, test } from '@playwright/test';

// desktop-view-row.spec — the Playwright (real Chromium) proof that the §16 View
// row is wired and interactive on the DESKTOP controls card (S16 ph4). DESIGN.md
// §16 / §10 / §11.3 win on any conflict (AGENTS.md). The MOBILE View-row coverage
// lives in MobileControls.test.tsx + responsive.spec.ts and is unchanged; a11y.spec
// stays focused on the axe scan + roles, so the desktop interaction proof gets this
// dedicated file.
//
// It runs at the DEFAULT Desktop Chrome viewport (1280×720 — ≥760px AND landscape),
// so the desktop card is LIVE and the mobile sheet is display:none, and the auto
// orientation default resolves to HORIZONTAL (resolveOrientation('auto', true)).
// That lets it prove the load-bearing thing a DOM-only test can't: a manual
// 'Vertical' choice WINS over the auto→horizontal default by flipping the board's
// rendered `data-orientation`, end-to-end through useMapView — not just aria state.
//
// Reduced motion is forced (the pattern the other deterministic specs use) so the
// render flip is observable without waiting on the §7 reflow-to-replay.
//
// It ships SOFT (the existing non-required e2e job runs `e2e/**`), guarding the
// Phase 4 deliverable but not a required CI check (AGENTS.md soft-launch ritual).

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('S16 ph4 — desktop View row drives the resolved render', () => {
  test('the three desktop View radiogroups exist by name as .pill-track[role=radiogroup]s of .pills', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    // (1) Orientation / Density / Handedness are each a `.pill-track`
    // `role="radiogroup"` of `role="radio"` `.pill`s (the shared §8.1 primitive —
    // no desktop-only a11y). At the desktop viewport these resolve to the desktop
    // card's row (the mobile sheet's same-named groups are display:none ≥760px).
    for (const name of ['Orientation', 'Density', 'Handedness'] as const) {
      const group = page.getByRole('radiogroup', { name });
      await expect(group).toBeVisible();
      await expect(group).toHaveClass(/pill-track/);
      const radios = group.getByRole('radio');
      // Each group is a .pill-track of .pill radios (≥2 options apiece).
      expect(await radios.count()).toBeGreaterThanOrEqual(2);
      await expect(radios.first()).toHaveClass(/pill/);
    }
  });

  test("Orientation single-select: 'Auto' is checked by default; clicking 'Vertical' moves the check", async ({
    page,
  }) => {
    await page.goto('/');
    const orientation = page.getByRole('radiogroup', { name: 'Orientation' });
    const auto = orientation.getByRole('radio', { name: 'Auto', exact: true });
    const vertical = orientation.getByRole('radio', { name: 'Vertical', exact: true });

    // (2) The stored default mode is 'auto' (mapView.mode), so 'Auto' is checked
    // initially — ViewRow highlights the STORED choice, not the resolved orientation.
    await expect(auto).toHaveAttribute('aria-checked', 'true');
    await expect(vertical).toHaveAttribute('aria-checked', 'false');

    // Click 'Vertical' → single-select selection-follows: 'Vertical' becomes checked
    // AND 'Auto' loses its check.
    await vertical.click();
    await expect(vertical).toHaveAttribute('aria-checked', 'true');
    await expect(auto).toHaveAttribute('aria-checked', 'false');
  });

  test("clicking Orientation 'Vertical' flips the board's data-orientation (useMapView wiring; the choice WINS over auto→horizontal)", async ({
    page,
  }) => {
    await page.goto('/');
    const board = page.locator('svg#board');
    await expect(board).toBeVisible();

    // The desktop viewport is landscape ≥760px, so the AUTO default resolves to
    // HORIZONTAL — the render starts horizontal even though 'Auto' is the stored mode.
    await expect(board).toHaveAttribute('data-orientation', 'horizontal');

    // (3) Clicking Orientation 'Vertical' reaches the RENDER path via useMapView:
    // the board's data-orientation flips to 'vertical', proving the manual choice
    // WINS over the desktop auto→horizontal default (end-to-end wiring, not DOM-only).
    const vertical = page
      .getByRole('radiogroup', { name: 'Orientation' })
      .getByRole('radio', { name: 'Vertical', exact: true });
    await vertical.click();
    await expect(board).toHaveAttribute('data-orientation', 'vertical');

    // (4) persist-wins: 'Vertical' stays checked after the render flip — the stored
    // choice persists (storeMapView), it isn't reset by the re-resolve.
    await expect(vertical).toHaveAttribute('aria-checked', 'true');
  });
});
