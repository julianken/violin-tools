import { expect, test } from '@playwright/test';

// deep-link.spec — the browser-only half of §16 deep-linking. The contract under
// test is FIRST-PAINT resolution of a real `?r=&s=` URL: `parseShareParams`
// (controls.ts) seeds `initialSelection` (AppShell.tsx) before the first render,
// so a shared link lands directly on its (root, scale) with no intermediate
// A-Major frame. jsdom (the Vitest gate) has no real query string and no real
// `goto()`, so this is the only layer that exercises the contract faithfully.
//
// These are POSITIVE first-paint assertions: because `initialSelection` seeds the
// lazy reducer init, there is no A-Major flash to race against — the H1 reads the
// deep-linked selection from the first paint. The §13 spelled H1 (`scaleName`) is
// the visible witness; an off-by-default-to-A-Major regression would flip it.
//
// Reduced motion is forced (the motion.spec.ts / select-root-scale.spec.ts
// pattern) so the render is deterministic — this asserts the resolved state, not
// the §7 motion of it.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('§16 deep-link — first-paint state restore from ?r=&s=', () => {
  test('?r=G&s=harmonicMinor restores "G Harmonic Minor" on first paint', async ({ page }) => {
    await page.goto('/?r=G&s=harmonicMinor');
    await expect(page.locator('svg#board')).toBeVisible();
    // initialSelection seeded the reducer before first render — the H1 reads the
    // deep-linked selection directly (no A-Major intermediate to assert against).
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('G Harmonic Minor');
  });

  test('?r=INVALID&s=major falls back to "A Major" with zero console.error', async ({ page }) => {
    // A junk root is omitted by parseShareParams (it only accepts known
    // ROOT_PITCH_CLASS keys), so the caller defaults it to A; `s=major` is valid.
    // The fallback must be silent — a junk link never throws or logs.
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/?r=INVALID&s=major');
    await expect(page.locator('svg#board')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A Major');
    expect(errors).toEqual([]);
  });

  test('?r=Db&s=major renders "D♭ Major" with the Unicode ♭ glyph', async ({ page }) => {
    // Db is a MAJOR-family root here, so spell() keeps it flat (D♭) — NOT C♯, which
    // is the minor-family respelling of pc 1 (spell.ts). The H1 must carry the
    // Unicode '♭' (U+266D), not the ASCII "Db" pill glyph.
    await page.goto('/?r=Db&s=major');
    await expect(page.locator('svg#board')).toBeVisible();
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveText('D♭ Major');
    // Belt-and-braces: assert the codepoint is the Unicode flat, never ASCII "Db".
    const text = await h1.textContent();
    expect(text).toContain('♭');
    expect(text).not.toContain('Db');
  });

  test('changing root after a deep-link upserts r= while preserving s=', async ({ page }) => {
    // Land on a deep link, then drive the real "Root note" radiogroup. AppShell's
    // replaceState effect (keyed on root+scale) must upsert r= and KEEP s= — a
    // selection change rewrites the deep link, never blanks the scale param.
    await page.goto('/?r=D&s=harmonicMinor');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('D Harmonic Minor');

    await page
      .getByRole('radiogroup', { name: 'Root note' })
      .getByRole('radio', { name: 'G', exact: true })
      .click();

    // The H1 follows the new root (same scale family), proving the click landed.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('G Harmonic Minor');
    // The URL now names the new root and STILL carries the original scale param.
    await expect
      .poll(() => new URL(page.url()).searchParams.get('r'))
      .toBe('G');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('s'))
      .toBe('harmonicMinor');
  });
});
