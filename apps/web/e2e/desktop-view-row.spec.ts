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

  test("Density 'Comfort' (with Vertical) drives the board's viewBox to the §12.1 vertical-comfort literal", async ({
    page,
  }) => {
    await page.goto('/');
    const board = page.locator('svg#board');
    await expect(board).toBeVisible();

    // Pick Vertical first so the resolved render is vertical (the desktop default
    // resolves to horizontal, where Comfort would be '0 0 850 264'). The CORRECTED
    // literal: vertical+comfort is '0 0 352 850' (Content.tsx L107/169; the
    // geometry.test.ts axisOf check pins the same value). Density only stretches the
    // NECK, so the cross WIDTH (352) is unchanged and the neck HEIGHT grows to 850.
    await page
      .getByRole('radiogroup', { name: 'Orientation' })
      .getByRole('radio', { name: 'Vertical', exact: true })
      .click();
    await expect(board).toHaveAttribute('data-orientation', 'vertical');

    const comfort = page
      .getByRole('radiogroup', { name: 'Density' })
      .getByRole('radio', { name: 'Comfort', exact: true });
    await comfort.click();
    await expect(comfort).toHaveAttribute('aria-checked', 'true');
    // The render reached the viewBox via useMapView → axisOf (end-to-end wiring).
    await expect(board).toHaveAttribute('viewBox', '0 0 352 850');
  });

  test("Handedness 'Left' (vertical) mirrors the dot geometry — the outer strings swap cross position", async ({
    page,
  }) => {
    await page.goto('/');
    const board = page.locator('svg#board');
    await expect(board).toBeVisible();

    // Go vertical so handedness is observable on the CROSS axis (the dot cx). There
    // is NO data-handedness attribute — handedness is visible ONLY through the
    // mirrored dot geometry (geometry.ts crossOrder L111–116): vertical+right uses a
    // DESCENDING string order [3,2,1,0], vertical+left an ASCENDING [0,1,2,3], so the
    // outermost strings (E5 = first g.note, G3 = the 46th = string 3 col 0) SWAP
    // their cross coordinate. We read the dot cx before and after — a pure
    // source-derived mirror, no hardcoded pixel literal.
    await page
      .getByRole('radiogroup', { name: 'Orientation' })
      .getByRole('radio', { name: 'Vertical', exact: true })
      .click();
    await expect(board).toHaveAttribute('data-orientation', 'vertical');

    // The open-string dots: g.note index 0 = (string 0 = E5, col 0); index 45 =
    // (string 3 = G3, col 0). Their dot circle cx is the cross coordinate.
    const cxOf = (index: number) =>
      board.evaluate((svg, i) => {
        const dot = svg.querySelectorAll('g.note')[i]?.querySelector('circle.dot');
        return dot ? Number(dot.getAttribute('cx')) : null;
      }, index);

    const e5Right = await cxOf(0);
    const g3Right = await cxOf(45);
    expect(e5Right).not.toBeNull();
    expect(g3Right).not.toBeNull();
    // Right-handed vertical: descending order puts E5 at the FAR cross slot and G3
    // at the NEAR slot — so they differ.
    expect(e5Right).not.toBe(g3Right);

    await page
      .getByRole('radiogroup', { name: 'Handedness' })
      .getByRole('radio', { name: 'Left', exact: true })
      .click();

    // Mirror: the ascending left order swaps the outer strings' cross slots, so E5
    // now sits where G3 was and vice versa (the geometry flipped, no attribute to
    // read). This is the only observable proof handedness reached the render.
    await expect
      .poll(() => cxOf(0))
      .toBe(g3Right);
    expect(await cxOf(45)).toBe(e5Right);
  });

  test("Density 'Comfort' persists across a reload (storeMapView round-trips)", async ({
    page,
  }) => {
    await page.goto('/');
    const density = page.getByRole('radiogroup', { name: 'Density' });
    const comfort = density.getByRole('radio', { name: 'Comfort', exact: true });

    // Default density is 'auto'; pick Comfort, then reload. The stored MapView
    // (storeMapView → localStorage) must survive so Comfort is STILL checked on the
    // fresh load — the persistence the unit test asserts, proven end-to-end.
    await comfort.click();
    await expect(comfort).toHaveAttribute('aria-checked', 'true');

    await page.reload();
    const comfortAfter = page
      .getByRole('radiogroup', { name: 'Density' })
      .getByRole('radio', { name: 'Comfort', exact: true });
    await expect(comfortAfter).toHaveAttribute('aria-checked', 'true');
  });
});
