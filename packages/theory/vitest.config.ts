import { defineConfig } from 'vitest/config';

// The theory package is pure arithmetic — no DOM, no React, no setup files.
// A node test environment is enough; the suite imports describe/it/expect
// explicitly from 'vitest' rather than relying on globals.
export default defineConfig({
  test: {
    environment: 'node',
    // This IS the CI coverage gate (#155): the `gates` job runs `pnpm
    // test:coverage`, and these `thresholds` fail the gate if aggregate coverage
    // drops below the floors. Floors are ratchet-only — they rise as coverage
    // durably rises; lowering one requires an owner `HIL:` decision (policy in
    // AGENTS.md → "Working in the tree"). Globs are relative to this package root.
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', 'html'],
      thresholds: { statements: 97, branches: 87, functions: 100, lines: 98 },
    },
  },
});
