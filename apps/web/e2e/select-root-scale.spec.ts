import { expect, test } from '@playwright/test';

// select-root-scale.spec — the S13 capstone acceptance test for the core
// "pick a root + a scale → the map re-renders the correct classification" flow.
// DESIGN.md §11.3 / §13 / §12.5 win on any conflict (AGENTS.md). This exercises
// the SHIPPED radiogroups and the SHIPPED note map together (an end-to-end
// composition check, not a unit assertion): it drives the real "Root note" and
// "Scale type" radiogroups by their §11.3 accessible names and asserts a note
// marker's accessible name reflects the NEW classification (root / in scale /
// not in scale), plus the §13 spelled H1 heading.
//
// Reduced motion is forced (emulateMedia, the pattern motion.spec.ts uses) so the
// re-render is deterministic — the classification change is asserted, not the §7
// motion of it.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('S13 acceptance — select root + scale re-renders the classification', () => {
  test('A Major (default): a root, an in-scale, and an off marker carry §11.3 names', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    // The two radiogroups are the §11.3 controls.
    await expect(page.getByRole('radiogroup', { name: 'Root note' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Scale type' })).toBeVisible();

    // A Major default — three distinct classifications exist with the verbatim
    // §11.3/§13 suffixes (and the §13 spelled H1 reads "A Major").
    await expect(page.locator('g.note[aria-label="A, root"]').first()).toHaveCount(1);
    await expect(page.locator('g.note[aria-label="C sharp, in scale"]').first()).toHaveCount(1);
    await expect(page.locator('g.note[aria-label="G, not in scale"]').first()).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A Major');
  });

  test('changing the ROOT (A→G) reclassifies the map: the new root marker updates', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    // Pick a new root in the "Root note" radiogroup.
    await page
      .getByRole('radiogroup', { name: 'Root note' })
      .getByRole('radio', { name: 'G', exact: true })
      .click();

    // G is now the root; A (the previous root) reclassifies to in-scale (G major
    // contains A); the §13 H1 follows the selection.
    await expect(page.locator('g.note[aria-label="G, root"]').first()).toHaveCount(1);
    await expect(page.locator('g.note[aria-label="A, in scale"]').first()).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('G Major');
  });

  test('changing the SCALE (Major→Harm. minor) reclassifies the same root', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    // A Major contains C♯ (in scale). Switch the scale to Harmonic minor: A
    // harmonic minor has C natural, so C♯ leaves the scale and C joins it — a
    // classification flip driven purely by the "Scale type" radiogroup.
    await expect(page.locator('g.note[aria-label="C sharp, in scale"]').first()).toHaveCount(1);

    await page
      .getByRole('radiogroup', { name: 'Scale type' })
      .getByRole('radio', { name: 'Harm. minor', exact: true })
      .click();

    // The root is unchanged (still A, root); the third degree flips C♯→C.
    await expect(page.locator('g.note[aria-label="A, root"]').first()).toHaveCount(1);
    await expect(page.locator('g.note[aria-label="C sharp, not in scale"]').first()).toHaveCount(1);
    await expect(page.locator('g.note[aria-label="C, in scale"]').first()).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A Harmonic Minor');
  });
});
