import { defineConfig } from 'vitest/config';

// The theory package is pure arithmetic — no DOM, no React, no setup files.
// A node test environment is enough; the suite imports describe/it/expect
// explicitly from 'vitest' rather than relying on globals.
export default defineConfig({
  test: {
    environment: 'node',
  },
});
