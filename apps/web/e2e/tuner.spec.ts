import { expect, test } from '@playwright/test';

// tuner.spec — the Playwright (real Chromium) fake-media smoke for the §17 live
// Tuner (S18 ph6, epic #90). DESIGN.md §17 wins on any conflict (AGENTS.md). jsdom
// (the Vitest gate) has no Web Audio / getUserMedia, so THIS suite drives the whole
// pipeline against the SHIPPED bundle: the fake microphone (a committed A4=440 WAV,
// fed via the project-level `--use-file-for-fake-audio-capture` flag in
// playwright.config) → the ph4 audio hook → the ph2/ph3 pure layers → the §17
// readout. It proves the capstone actually detects a known pitch end-to-end.
//
// IMPORTANT (the ph4 deferral note): the fake-media flags are PROJECT-level, NOT a
// per-test `test.use({ launchOptions })` — even an empty per-test override resets
// the launch and silences fake-audio playback. We grant the mic via
// `context.grantPermissions(['microphone'])` so getUserMedia resolves without a
// prompt. `localhost` is a secure context, so the Tuner is supported.

test.describe('§17 Tuner — fake-media smoke (detects A4 = 440, in tune)', () => {
  test('switching to the Tuner view, Start, and the readout shows A4 in tune', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['microphone']);
    await page.goto('/');
    // The app starts on the note map (the §17.1 default view).
    await expect(page.locator('svg#board')).toBeVisible();

    // Switch to the Tuner via the sidebar nav item (§17.1 — now a live nav item).
    await page.getByRole('button', { name: 'Tuner' }).click();
    // The main panel swapped to the Tuner surface: the §17 H1 is shown, the board
    // is gone (one subject, no rivals — §1).
    await expect(page.getByRole('heading', { level: 1, name: 'Chromatic tuner' })).toBeVisible();
    await expect(page.locator('svg#board')).toHaveCount(0);

    // The idle state offers the Start affordance (the §17.6 {mint}-outline pill).
    const start = page.getByRole('button', { name: 'Start tuning' });
    await expect(start).toBeVisible();
    await start.click();

    // The live meter appears (the listening state, §17.6) and the readout
    // stabilizes on A4. Poll because the smoother needs several rAF frames to
    // settle (median → EMA → label hysteresis, ph3).
    await expect(page.getByRole('group', { name: 'Open strings' })).toBeVisible();

    // The readout's note + octave resolves to A4 (the fed pitch). Geist-Mono note
    // node carries the visible "A4".
    await expect
      .poll(async () => (await page.locator('.tuner-note').textContent())?.trim(), {
        timeout: 15_000,
      })
      .toBe('A4');

    // …and it reads IN TUNE — the dot snaps to the §17.2 root state (`is-in-tune`)
    // and the `IN TUNE ✓` label appears (the ✓ word is the non-colour cue, §11.1).
    await expect
      .poll(
        async () => page.locator('.tuner-dot-g.is-in-tune').count(),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
    await expect(page.getByText('IN TUNE ✓')).toBeVisible();

    // The nearest open-string chip (A4) is the active pill (§17.4).
    const a4Chip = page.locator('.tuner-chip', { hasText: 'A4' });
    await expect(a4Chip).toHaveClass(/is-active/);
  });

  test('the announcer exists empty at load and the privacy line is shown idle (§17.6/§17.9)', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['microphone']);
    await page.goto('/');
    await page.getByRole('button', { name: 'Tuner' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Chromatic tuner' })).toBeVisible();

    // §17.9 — the polite announcer is present and EMPTY at load (before Start).
    const announcer = page.locator('[data-live="tuner"]');
    await expect(announcer).toHaveAttribute('role', 'status');
    await expect(announcer).toHaveAttribute('aria-live', 'polite');
    await expect(announcer).toHaveText('');

    // §17.6 — the on-device privacy line is shown on the idle screen.
    await expect(
      page.getByText(/processed entirely in your browser.*nothing is recorded/i),
    ).toBeVisible();
  });
});
