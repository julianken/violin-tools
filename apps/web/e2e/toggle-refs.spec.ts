import { type Locator, expect, test } from '@playwright/test';

// toggle-refs.spec — the S13 capstone acceptance test for the "toggle a Refs pill
// → the overlay changes" core flow. DESIGN.md §9.1 / §12.3 / §7.1 / §11.3 win on
// any conflict (AGENTS.md). The Refs row is a `group` of 4 INDEPENDENT checkboxes
// (§11.3: "Reference layers"): `Tapes`, `low 2`, `3-tape`, `Landmarks`. Each is
// asserted on its OWN overlay, not bundled.
//
// Visibility mechanism (§7.1, verified against the shipped build): the `.tape` and
// `.land` SVG groups are ALWAYS mounted; turning a layer off adds the `.hide` class
// (opacity 0 in notemap.css), it never unmounts the node. So each assertion checks
// BOTH the `.hide` class flip AND the computed opacity, deriving selectors from the
// shipped components (RefsRow checkboxes + RefLayers `.tape`/`.land` groups).
//
// Reduced motion is forced (emulateMedia, the pattern motion.spec.ts uses); the
// `.hide` opacity tween (§7.5) still settles, so we POLL the computed opacity to
// the END state rather than reading a mid-fade frame.

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

/** Poll a group's computed opacity until it settles, then assert the end value. */
const expectOpacity = async (group: Locator, value: '0' | '1') => {
  await expect
    .poll(async () => group.evaluate((el) => Math.round(Number(getComputedStyle(el).opacity))))
    .toBe(Number(value));
};

test.describe('S13 acceptance — each Refs pill toggles its OWN overlay', () => {
  test('the Tapes pill toggles ONLY the .tape band group (independent of landmarks)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    const tapeGroup = page.locator('svg#board g.tape');
    const tapesPill = page.getByRole('checkbox', { name: 'Tapes', exact: true });

    // Default state: tapes OFF (the §9.1 default) — the group is mounted but hidden.
    await expect(tapesPill).toHaveAttribute('aria-checked', 'false');
    await expect(tapeGroup).toHaveClass(/\bhide\b/);
    await expectOpacity(tapeGroup, '0');

    // Toggle ON → the tape group appears (no `.hide`, opacity 1).
    await tapesPill.click();
    await expect(tapesPill).toHaveAttribute('aria-checked', 'true');
    await expect(tapeGroup).not.toHaveClass(/\bhide\b/);
    await expectOpacity(tapeGroup, '1');

    // The landmark group was NOT touched (independence — not a bundled "refs work").
    await expect(page.locator('svg#board g.land')).toHaveClass(/\bhide\b/);

    // Toggle OFF → the tape group disappears again.
    await tapesPill.click();
    await expect(tapesPill).toHaveAttribute('aria-checked', 'false');
    await expect(tapeGroup).toHaveClass(/\bhide\b/);
    await expectOpacity(tapeGroup, '0');
  });

  test('the Landmarks pill toggles the .land group — heel, octave, AND the position labels together', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('svg#board')).toBeVisible();

    const landGroup = page.locator('svg#board g.land');
    const landmarksPill = page.getByRole('checkbox', { name: 'Landmarks', exact: true });

    // Default: landmarks OFF → the whole .land group (heel band + octave band +
    // the four position labels) is hidden together (§12.3).
    await expect(landmarksPill).toHaveAttribute('aria-checked', 'false');
    await expect(landGroup).toHaveClass(/\bhide\b/);
    await expectOpacity(landGroup, '0');
    // The position labels live INSIDE .land (§12.3), so they toggle with it.
    await expect(landGroup.locator('text.pos-label')).toHaveCount(4);

    // Toggle ON → heel band, octave band, and all four position labels appear.
    await landmarksPill.click();
    await expect(landmarksPill).toHaveAttribute('aria-checked', 'true');
    await expect(landGroup).not.toHaveClass(/\bhide\b/);
    await expectOpacity(landGroup, '1');
    await expect(landGroup.locator('rect.heel-rect')).toHaveCount(1);
    await expect(landGroup.locator('rect.octave-rect')).toHaveCount(1);
    await expect(landGroup.locator('text.pos-label')).toHaveCount(4);

    // The tape group was NOT touched (independent toggles).
    await expect(page.locator('svg#board g.tape')).toHaveClass(/\bhide\b/);

    // Toggle OFF → the whole landmark group hides again.
    await landmarksPill.click();
    await expect(landmarksPill).toHaveAttribute('aria-checked', 'false');
    await expect(landGroup).toHaveClass(/\bhide\b/);
    await expectOpacity(landGroup, '0');
  });
});
