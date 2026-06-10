import { defineConfig } from 'vitest/config';

// The theory package is pure arithmetic — no DOM, no React, no setup files.
// A node test environment is enough; the suite imports describe/it/expect
// explicitly from 'vitest' rather than relying on globals.
export default defineConfig({
  test: {
    environment: 'node',
    // Informational only — no `thresholds`, deliberately not a CI gate (#144 / #149;
    // the threshold-gate deferral is the GAPS.md row). Runs via `test:coverage`,
    // never the plain `test` gate. Globs are relative to this package root.
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', 'html'],
    },
  },
});
