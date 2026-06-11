import { expect, test } from '@playwright/test';

// intonation.spec — the Playwright (real Chromium) fake-media smoke for the §18
// Intonation drill (C12, epic #141). DESIGN.md §18 wins on any conflict (AGENTS.md).
// jsdom (the Vitest gate) has no Web Audio / getUserMedia, AND the drill's unit tests
// mock the tuner — so the integration seam between useTuner and useIntonationDrill is
// exercised by NO Vitest suite. THIS suite drives the whole pipeline against the
// SHIPPED bundle: the fake microphone (the committed A4=440 WAV, fed via the
// project-level `--use-file-for-fake-audio-capture` flag in playwright.config) →
// useTuner's ph4 audio hook → setOnRawFrame → useIntonationDrill's tracker → the §18
// DrillMeter readout. It is the missing harness the C12 defect (#174) proved we need:
// a dep-less ref-sync effect in useTuner clobbered the drill's setOnRawFrame subscriber
// one render after registration, so the meter read "no signal" forever on prod, and
// every existing test missed it (the unit tests mock the tuner; no e2e existed).
//
// IMPORTANT (mirrors tuner.spec's ph4 deferral note): the fake-media flags are
// PROJECT-level, NOT a per-test `test.use({ launchOptions })` — even an empty per-test
// override resets the launch and silences fake-audio playback. We grant the mic via
// `context.grantPermissions(['microphone'])` so getUserMedia resolves without a
// prompt. `localhost` is a secure context, so the drill is supported.

test.describe('§18 Intonation drill — fake-media smoke (drill is live, not "no signal")', () => {
  test('switching to Intonation, Start drill, and the meter publishes live cents', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['microphone']);
    // #176 — the Intonation surface is flag-gated and OFF in the prod-shaped
    // Playwright bundle (`vite build` → `import.meta.env.DEV === false`). Enter via
    // the `?ff=intonation` per-device override, which ALSO exercises the override
    // path on the prod bundle (a feature, not a workaround — the override is how
    // the owner reaches a flag-off surface on prod).
    await page.goto('/?ff=intonation');
    // The app starts on the note map (the §17.1 default view).
    await expect(page.locator('svg#board')).toBeVisible();

    // Switch to the Intonation view via the sidebar nav item (§8.2 — a live nav
    // item since C9; the accessible name is "Intonation").
    await page.getByRole('button', { name: 'Intonation' }).click();

    // The idle state offers the Start affordance (the §18 start pill). The board
    // is gone — one subject, no rivals (§1).
    const start = page.getByRole('button', { name: 'Start drill' });
    await expect(start).toBeVisible();
    await expect(page.locator('svg#board')).toHaveCount(0);
    await start.click();

    // The running surface mounts (the §18 three-state surface, running phase).
    await expect(page.locator('section.intonation-running')).toBeVisible();

    // The §18 DrillMeter (role="img") carries the live readout in its aria-label.
    // Before signal arrives it reads "Drill meter: no signal"; once the fake A440
    // reaches the tracker the label flips to a signed cents reading against the
    // first target. We capture the dead→live transition: the pre-signal label is
    // "no signal" (proving the meter began dead), then it publishes real cents —
    // which is exactly the regression class (#174: it stayed dead forever).
    const meter = page.locator('.drill-meter');
    await expect(meter).toBeVisible();

    // Poll the aria-label until the meter publishes a signed cents reading. The
    // first target of the default A-major 2-octave plan is A3; the fake mic is a
    // constant A440, so the detector reads ~+1142¢ (≈ +1200¢ = an octave, A440 vs
    // A3, less the detector's tolerance). The smoother needs several rAF frames to
    // settle, hence the poll (median → EMA → label hysteresis, ph3).
    await expect
      .poll(async () => meter.getAttribute('aria-label'), { timeout: 15_000 })
      .toMatch(/Drill meter: A, [+-]\d+ cents/);

    // Parse the published cents and assert it is the LIVE first-target math, not
    // merely that some text rendered. A440 vs A3 ≈ +1200¢; the detector reads
    // ~+1142¢ against the fake WAV. AC4 asserts > +1000¢ (a tight ±60 band around
    // +1200 would leave ~2¢ of margin and flake on a correct build).
    const label = await meter.getAttribute('aria-label');
    expect(label).not.toBeNull();
    const match = /Drill meter: A, ([+-]\d+) cents/.exec(label ?? '');
    expect(match).not.toBeNull();
    const cents = Number(match?.[1]);
    expect(cents).toBeGreaterThan(1000);
  });
});
