import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

// Near-empty Vite config for the S1 foundation: React plugin + a jsdom Vitest
// environment so the day-one component test can render. No product/build tuning
// yet — that arrives with the app shell (S3) and infra (S11).
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    // The Playwright e2e suite (`e2e/**/*.spec.ts`, S8) runs under Playwright, not
    // Vitest — exclude it so `vitest run` (the `test` gate) does not try to load
    // its `@playwright/test` imports as jsdom unit tests.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
