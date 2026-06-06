/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  },
});
