import { defineConfig, devices } from '@playwright/test';

// playwright.config — the e2e harness for the LIVE-browser contracts jsdom (the
// Vitest gate) can't verify. DESIGN.md wins on any conflict (AGENTS.md). It now
// drives five spec families against the shipped bundle:
//   • motion.spec.ts (S8) — the §7 stagger / dotPop replay / tape slide / reduced-
//     motion gate;
//   • a11y.spec.ts (S10) — the §11 axe scan + roving note map + focus ring;
//   • responsive.spec.ts (S11) — the §10 mobile reflow (drawer, no 390px overflow);
//   • the S13 capstone ACCEPTANCE specs — select-root-scale, toggle-refs,
//     palette-jump (the core flows exercised end-to-end);
//   • visual.spec.ts (S13) — full-page VISUAL snapshots at 390×844 and 1440×900
//     under reduced motion, with the §10 layout invariants asserted alongside.
//
// The webServer builds the app once and previews the static bundle (the same
// `pnpm build` output the `gates` job produces), so the e2e runs against the
// shipped bundle, not the dev server. Reduced motion is forced per-spec (via
// test.use({ reducedMotion: 'reduce' })) where determinism matters — the default
// project leaves motion ON so the motion specs' stagger/replay/slide are observable.
//
// Visual baselines are platform-suffixed (-darwin locally, -linux in CI), both
// committed under e2e/visual.spec.ts-snapshots/; the toHaveScreenshot tolerance is
// set in `expect` below.
//
// This suite ships SOFT (separate, non-required CI jobs — see ci.yml `e2e`/`a11y`),
// to be promoted to required checks at the S13 capstone (GAPS.md soft-launch ritual).

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  // Motion timing is small (≤ a few hundred ms); a tight default keeps the suite
  // fast while leaving headroom for the build-and-preview cold start.
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    // Visual snapshots (S13 capstone, visual.spec.ts): a small tolerance absorbs
    // sub-pixel antialiasing/font-hinting differences between the machine that
    // generated the committed baseline and the CI runner of the SAME OS (the
    // baselines are platform-suffixed: -darwin locally, -linux in CI). It is a
    // tolerance, not a license — a real layout regression moves far more than
    // 0.2% of pixels and still fails the gate.
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled' },
  },
  fullyParallel: true,
  // No accidental `.only` left in a committed spec.
  forbidOnly: !(process.env['CI'] === undefined),
  retries: process.env['CI'] === undefined ? 0 : 1,
  reporter: process.env['CI'] === undefined ? 'list' : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Build then preview the static bundle on a fixed port (the shipped output).
    command: `pnpm build && pnpm preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 120_000,
  },
});
