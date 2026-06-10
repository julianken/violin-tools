import { expect, test } from '@playwright/test';

// share-link.spec — the two browser-only journeys around the §16 "Share scale"
// ghost button (Topbar.tsx) + its feedback machine (useShareLink.ts), plus the
// §16 `?motion=` survival contract. jsdom (the Vitest gate) covers the hook's
// branch logic in isolation; only a real browser exercises the clipboard write,
// the label/check swap, the polite-region announcement, and the replaceState
// round-trip end to end.
//
// BRANCH GATE (load-bearing): useShareLink takes the NATIVE-share branch whenever
// `navigator.share` exists, and that branch announces NOTHING (a bare resolve
// can't confirm a share). Headless Chromium ships the Web Share API, so without
// intervention the spec would hit the silent branch. We `addInitScript` to delete
// `navigator.share` (and `navigator.canShare`) BEFORE app code runs, forcing the
// COPY branch — the one that writes the clipboard and announces "Link copied to
// clipboard" — and grant clipboard-write so the real `navigator.clipboard` path
// resolves.
//
// Reduced motion is forced for determinism (the motion.spec.ts pattern); the
// label/check swap is CSS-state-driven (data-busy / data-state), not a timed tween
// we race against.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('§16 ?motion= survival across a selection replaceState', () => {
  test('changing root keeps ?motion=snappy alongside the upserted r=', async ({ page }) => {
    // motion= is read every render by Content's resolveMotionBuild; AppShell's
    // replaceState merges into the LIVE search (buildShareParams upserts only r/s),
    // so a pre-existing motion= must survive a root change — dropping it would flip
    // the motion build (this is the invariant that keeps the motion specs green).
    await page.goto('/?motion=snappy');
    await expect(page.locator('svg#board[data-motion="snappy"]')).toBeVisible();

    await page
      .getByRole('radiogroup', { name: 'Root note' })
      .getByRole('radio', { name: 'G', exact: true })
      .click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('G Major');
    // motion= survived the replaceState, and r= was upserted next to it.
    await expect.poll(() => new URL(page.url()).searchParams.get('motion')).toBe('snappy');
    await expect.poll(() => new URL(page.url()).searchParams.get('r')).toBe('G');
  });
});

test.describe('§16 Share scale — the copy branch (native share forced off)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Force the COPY branch: remove the Web Share API before any app code runs.
    await page.addInitScript(() => {
      // Both are deleted so canNativeShare() returns false at call time and the
      // hook falls through to navigator.clipboard.writeText.
      delete (navigator as { share?: unknown }).share;
      delete (navigator as { canShare?: unknown }).canShare;
    });
    // The copy branch needs a real clipboard write to resolve; clipboard-read
    // lets the test verify what landed there (readText below).
    await context.grantPermissions(['clipboard-write', 'clipboard-read']);
  });

  test('clicking "Share scale" copies the link, announces it, swaps and reverts', async ({
    page,
  }) => {
    await page.goto('/?r=G&s=major');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('G Major');

    const shareButton = page.getByRole('button', { name: 'Share scale' });
    await expect(shareButton).toBeVisible();

    const liveRegion = page.locator('[data-live="share"]');
    const caption = page.locator('.ghost-status-text');
    const check = page.locator('.ghost-check');
    // Resting state: the polite region and caption are empty, the check is "out".
    await expect(liveRegion).toBeEmpty();
    await expect(check).toHaveAttribute('data-state', 'out');

    await shareButton.click();

    // The copy branch announces the single spoken outcome and shows the ✓ + caption.
    await expect(liveRegion).toHaveText('Link copied to clipboard');
    await expect(caption).toHaveText('Link copied');
    await expect(check).toHaveAttribute('data-state', 'in');

    // The clipboard actually holds the shared deep link (the live URL with r=G&s=major).
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('r=G');
    expect(clipboard).toContain('s=major');

    // REVERT — assert the DOM END-STATE with auto-retrying expectations (the revert
    // timer is the residual flake surface; never an elapsed-time wait). After the
    // revert delay the machine returns to rest: caption empty, check "out", and the
    // one-shot announcement blanked so a later copy can re-announce.
    await expect(caption).toBeEmpty();
    await expect(check).toHaveAttribute('data-state', 'out');
    await expect(liveRegion).toBeEmpty();
  });
});
