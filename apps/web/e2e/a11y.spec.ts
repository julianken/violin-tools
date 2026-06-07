import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// a11y.spec — the Playwright (real Chromium) half of the §11 accessibility
// verification (S10). DESIGN.md §8 / §11 win on any conflict (AGENTS.md). jsdom
// (the Vitest layer) can't run an axe scan or paint a focus ring; THIS suite
// asserts the LIVE a11y contract against the SHIPPED bundle:
//   • axe reports zero serious/critical violations (the durable regression gate);
//   • the note map is ONE tab stop (roving tabindex) with verbatim §11.3 names;
//   • the two radiogroups (Root, Scale) + the Refs group/checkbox cluster;
//   • the command palette dialog / input / results names;
//   • the skip link + the header/nav/main landmarks + document lang;
//   • the custom {mint} :focus-visible ring actually paints on keyboard focus.
//
// It ships SOFT (a separate, non-required CI job — see ci.yml `a11y`), to be
// promoted at the S13 capstone (the GAPS.md soft-launch ritual).

// The §2.5 "documented sub-threshold exemptions": chrome text deliberately set at
// `{text3}` on `{surface}`/`{canvas}` (3.37:1) — placeholders, section headers,
// labels, breadcrumb base segments, and `kbd` meta chips — which DESIGN.md §2.5
// SANCTIONS as placeholder/section-header/meta-only, never body copy that must be
// read to operate the tool. axe's `color-contrast` rule can't know about a design
// exemption, so these specific nodes are excluded from the axe scan; the §2.5
// contract itself (including these exempt ratios AND the two P0 dot-label pairs)
// is exhaustively verified in `src/styles/__tests__/contrast.test.ts`. axe still
// scans every OTHER element, so a NEW contrast regression on real body copy fails.
const SECTION_2_5_EXEMPT_SELECTORS = [
  '.search-label', // search-trigger placeholder ({text3}) — §2.5 placeholder-only
  '.sec-h', // sidebar "Tools" section header ({text3})
  '.lab', // controls-row labels Root/Scale/Refs ({text3})
  '.crumb-seg', // breadcrumb base segment "Scales" ({text3})
  '.kbd', // ⌘K meta chip ({text3})
];

test.describe('§11 axe scan — zero serious/critical violations', () => {
  test('the built app has no serious or critical axe violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();
    let builder = new AxeBuilder({ page }).withTags([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
    ]);
    for (const selector of SECTION_2_5_EXEMPT_SELECTORS) {
      builder = builder.exclude(selector);
    }
    const results = await builder.analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    // Surface the rule ids if this ever fails, so the report is actionable.
    expect(blocking.map((v) => v.id)).toEqual([]);
  });
});

test.describe('§11.3 structure — landmarks, skip link, document lang', () => {
  test('exposes header/nav/main landmarks and a document lang', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible(); // <header> (sidebar)
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Tools' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
  });

  test('the skip link targets the note map and becomes visible on focus', async ({ page }) => {
    await page.goto('/');
    const skip = page.getByRole('link', { name: 'Skip to note map' });
    await expect(skip).toHaveAttribute('href', '#board');
    // It is off-screen at rest and pulls on-screen when focused (§11.3).
    const topBefore = await skip.evaluate((el) => el.getBoundingClientRect().top);
    await skip.focus();
    const topAfter = await skip.evaluate((el) => el.getBoundingClientRect().top);
    expect(topAfter).toBeGreaterThan(topBefore);
  });
});

test.describe('§11.3 control roles + verbatim accessible names', () => {
  test('Root and Scale are radiogroups; Refs is a group of checkboxes (not a radiogroup)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('radiogroup', { name: 'Root note' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Scale type' })).toBeVisible();
    // Exactly two radiogroups — Refs must NOT be one.
    await expect(page.getByRole('radiogroup')).toHaveCount(2);
    const refs = page.getByRole('group', { name: 'Reference layers' });
    await expect(refs).toBeVisible();
    await expect(refs.getByRole('checkbox')).toHaveCount(4);
  });

  test('the command palette dialog / input / results carry the §11.3 names', async ({ page }) => {
    await page.goto('/');
    // Open the palette via the sidebar trigger.
    await page.getByRole('button', { name: /search scales and tools/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Scale search' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Search scales and tools' })).toBeVisible();
    await expect(dialog.getByRole('listbox', { name: 'Results' })).toBeVisible();
  });
});

test.describe('§11.3 note map — one tab stop, roving, verbatim marker names', () => {
  test('exactly one marker is tabbable; the rest are tabindex -1', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();
    const tabbable = page.locator('g.note[tabindex="0"]');
    await expect(tabbable).toHaveCount(1);
    await expect(page.locator('g.note[tabindex="-1"]')).toHaveCount(59);
    // The initial tab stop is a root marker (A Major default) → "A, root".
    await expect(tabbable).toHaveAttribute('aria-label', 'A, root');
  });

  test('arrow keys move the single tab stop in pitch order (one stop preserved)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('g.note[tabindex="0"]').focus();
    await page.keyboard.press('ArrowRight');
    // Still exactly one tab stop after the move (roving, not multi-stop).
    await expect(page.locator('g.note[tabindex="0"]')).toHaveCount(1);
    // A single Tab from inside the widget exits it (does NOT step to a marker).
    await page.keyboard.press('Tab');
    const focusedIsMarker = await page.evaluate(
      () => document.activeElement?.classList.contains('note') ?? false,
    );
    expect(focusedIsMarker).toBe(false);
  });

  test('marker names carry the verbatim §11.3 state suffixes and update on a key change', async ({
    page,
  }) => {
    await page.goto('/');
    // A Major: an in-scale, an off, and a root marker all exist with §11.3 names.
    await expect(page.locator('g.note[aria-label="C sharp, in scale"]').first()).toHaveCount(1);
    await expect(page.locator('g.note[aria-label="G, not in scale"]').first()).toHaveCount(1);
    // Switch root to G → open G3 reclassifies to root, its name updates.
    await page.getByRole('radio', { name: 'G', exact: true }).click();
    await expect(page.locator('g.note[aria-label="G, root"]').first()).toHaveCount(1);
  });
});

test.describe('§11.3 live regions — two polite, never assertive', () => {
  test('two aria-live="polite" regions exist; none is assertive', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[aria-live="polite"]')).toHaveCount(2);
    await expect(page.locator('[aria-live="assertive"]')).toHaveCount(0);
    // The map-description region carries the scale-named description.
    await expect(page.locator('[data-live="map-description"]')).toContainText('A Major.');
  });

  test('sounding a focused marker (Enter) announces it in the polite region', async ({ page }) => {
    await page.goto('/');
    await page.locator('g.note[tabindex="0"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-live="sounding"]')).toContainText('Sounding A');
  });
});

test.describe('§8 custom {mint} :focus-visible ring', () => {
  test('a keyboard-focused pill paints a {mint} box-shadow ring (not the UA outline)', async ({
    page,
  }) => {
    await page.goto('/');
    // Tab to the first interactive control and assert the replacement ring paints.
    const pill = page.getByRole('radio', { name: 'A', exact: true });
    await pill.focus();
    const ring = await pill.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { boxShadow: cs.boxShadow, mint: getComputedStyle(el).getPropertyValue('--mint') };
    });
    // The §0 {mint} is #00d4a4 → rgb(0, 212, 164); the focus ring box-shadow must
    // include it (the custom ring, not `outline:none` with nothing).
    expect(ring.boxShadow).toContain('rgb(0, 212, 164)');
  });
});
