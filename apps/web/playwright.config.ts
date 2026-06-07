import { defineConfig, devices } from '@playwright/test';

// playwright.config — the e2e harness S8 stands up for the §7 motion layer
// (DESIGN.md §7 wins on conflict, AGENTS.md). jsdom (the Vitest gate) cannot
// compute CSS transitions or run keyframes, so the LIVE motion contract — the
// left→right stagger, the dotPop reflow-replay, the tape +4→+3 slide, and the
// motion-off-under-reduce behavior — is verified here in a real Chromium.
//
// The webServer builds the app once and previews the static bundle (the same
// `pnpm build` output the `gates` job produces), so the e2e runs against the
// shipped bundle, not the dev server. Reduced motion is forced ONLY in the test
// that needs it (via test.use({ reducedMotion: 'reduce' }) in the spec) — the
// default project leaves motion ON so the stagger/replay/slide are observable.
//
// This suite ships SOFT (a separate, non-required CI job — see ci.yml `e2e`) to be
// promoted to a required check at S12 once stable (GAPS.md soft-launch ritual).

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  // Motion timing is small (≤ a few hundred ms); a tight default keeps the suite
  // fast while leaving headroom for the build-and-preview cold start.
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  // No accidental `.only` left in a committed spec.
  forbidOnly: !(process.env.CI === undefined),
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? 'list' : [['html', { open: 'never' }], ['list']],
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
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
});
