import { expect, test } from '@playwright/test';

// flags.spec — the Playwright (real Chromium) proof that the §18 Intonation
// surface is feature-flag-gated (#176) on the PROD-shaped bundle. DESIGN.md §18.1
// wins on any conflict (AGENTS.md). Playwright builds + previews `vite build`, so
// `import.meta.env.DEV === false` and the built-in default is OFF — exactly the
// public prod posture. There is no `/flags.json` in the preview output, so the
// boot fetch 404s and defaults win (fail-closed); the cases below drive the
// override and remote paths explicitly.
//
// The four gated assertions (AC2–AC4):
//   • default OFF → the Intonation nav item AND palette row are ABSENT (not soon).
//   • `?ff=intonation` → all entry points appear, and the override PERSISTS across
//     a param-less reload (the localStorage write-back).
//   • `?ff=-intonation` → the override clears and the surface hides again.
//   • a routed `/flags.json` of `{"intonation":true}` reveals it with NO URL param
//     — asserted with CLEARED localStorage so a leaked override can't pass it for
//     the wrong reason (amended AC4).
//
// It ships SOFT (the non-required e2e job runs `e2e/**`).

/** Open the command palette (⌘K) and return its dialog locator. */
async function openPalette(page: import('@playwright/test').Page) {
  await page.keyboard.press('Meta+k');
  const dialog = page.getByRole('dialog', { name: 'Scale search' });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Clear the persisted flag overrides so each case starts from the prod default. */
async function clearFlagOverrides(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

const navItem = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Intonation' });

test.describe('§18 Intonation is feature-flag-gated on the prod bundle (#176)', () => {
  test('default prod build hides the Intonation nav item AND palette row', async ({
    page,
  }) => {
    await page.goto('/');
    await clearFlagOverrides(page);
    await page.reload();
    // The app loads on the note map; the boot /flags.json 404s → default OFF.
    await expect(page.locator('svg#board')).toBeVisible();

    // (AC2) No Intonation nav item in the sidebar.
    await expect(navItem(page)).toHaveCount(0);

    // (AC2) No Intonation row in the command palette either — the Tools group lists
    // only Scale Map and Tuner.
    const dialog = await openPalette(page);
    await dialog.getByRole('textbox', { name: 'Search scales and tools' }).fill('Intonation');
    await expect(dialog.getByRole('option', { name: /Intonation/ })).toHaveCount(0);
  });

  test('?ff=intonation reveals all entry points and persists across a param-less reload', async ({
    page,
  }) => {
    await page.goto('/');
    await clearFlagOverrides(page);

    // (AC3) The override turns the flag ON for this device.
    await page.goto('/?ff=intonation');
    await expect(navItem(page)).toBeVisible();

    // The palette row is present too.
    const dialog = await openPalette(page);
    await dialog.getByRole('textbox', { name: 'Search scales and tools' }).fill('Intonation');
    await expect(dialog.getByRole('option', { name: /Intonation/ })).toHaveCount(1);
    await page.keyboard.press('Escape');

    // (AC3) The override PERSISTS: a reload WITHOUT the param still shows it (the
    // localStorage write-back drives the boot state).
    await page.goto('/');
    await expect(navItem(page)).toBeVisible();
  });

  test('?ff=-intonation clears the override and hides the surface again', async ({
    page,
  }) => {
    // Start from an ON override (persisted), then clear it.
    await page.goto('/?ff=intonation');
    await expect(navItem(page)).toBeVisible();

    // (AC3) The `-` token clears the override; the surface hides on the next load.
    await page.goto('/?ff=-intonation');
    await expect(navItem(page)).toHaveCount(0);

    // And it STAYS off across a param-less reload (the cleared override persisted).
    await page.goto('/');
    await expect(navItem(page)).toHaveCount(0);
  });

  test('a remote /flags.json of {"intonation":true} reveals it with NO url param (cleared localStorage)', async ({
    page,
  }) => {
    // (AC4) Route the boot fetch BEFORE navigating, so the very first load sees the
    // remote object. Fulfil it with intonation ON.
    await page.route('**/flags.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ intonation: true }),
      });
    });

    // First load (any persisted override from a prior case is cleared below, then
    // we reload so the boot runs with EMPTY storage — the remote alone must reveal
    // it, never a leaked `?ff=` override).
    await page.goto('/');
    await clearFlagOverrides(page);
    await page.reload();

    // No URL param, empty localStorage — only the routed remote can turn it on.
    await expect(navItem(page)).toBeVisible();
  });
});
