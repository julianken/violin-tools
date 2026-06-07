import { expect, test } from '@playwright/test';

// palette-jump.spec — the S13 capstone acceptance test for the command-palette
// jump flow (§8.5 / §9 / §11.3). DESIGN.md wins on any conflict (AGENTS.md).
// It opens the dialog ("Scale search"), filters the "Search scales and tools"
// input, picks a result from the "Results" listbox, and asserts the app JUMPED
// to the chosen scale — the §13 spelled H1 and the §11.3 marker names both follow
// the selection. Selectors are derived from the shipped CommandPalette + Sidebar.
//
// Two open paths are exercised: the ⌘K keyboard shortcut and the sidebar search
// trigger. Reduced motion is forced (emulateMedia) for determinism.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('S13 acceptance — command palette jumps the app to a scale', () => {
  test('⌘K → filter → Enter sets root + scale (A Major → G Harmonic Minor)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();
    // Sanity: the app starts on the A Major default.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A Major');

    // Open via the ⌘K shortcut (§8.5). Use Meta on macOS / Control elsewhere —
    // the app binds both; Meta is what the runner sends headlessly.
    await page.keyboard.press('Meta+k');
    const dialog = page.getByRole('dialog', { name: 'Scale search' });
    await expect(dialog).toBeVisible();

    // Filter to a specific scale and select it from the Results listbox.
    const input = dialog.getByRole('textbox', { name: 'Search scales and tools' });
    await input.fill('G Harmonic Minor');
    const results = dialog.getByRole('listbox', { name: 'Results' });
    await expect(results.getByRole('option', { name: /G Harmonic Minor/ }).first()).toBeVisible();

    // Enter activates the highlighted result → the palette closes and the app jumps.
    await input.press('Enter');
    await expect(dialog).toBeHidden();

    // The app navigated to G Harmonic Minor: the §13 H1 and §11.3 marker names
    // both reflect the new selection.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('G Harmonic Minor');
    await expect(page.locator('g.note[aria-label="G, root"]').first()).toHaveCount(1);
  });

  test('the sidebar search trigger opens the palette; clicking a result jumps', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A Major');

    // Open via the sidebar search trigger (§8.3) rather than the shortcut.
    await page.getByRole('button', { name: /search scales and tools/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Scale search' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('textbox', { name: 'Search scales and tools' }).fill('D Major');
    const option = dialog
      .getByRole('listbox', { name: 'Results' })
      .getByRole('option', { name: /^D Major/ })
      .first();
    await expect(option).toBeVisible();
    await option.click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('D Major');
    await expect(page.locator('g.note[aria-label="D, root"]').first()).toHaveCount(1);
  });
});
