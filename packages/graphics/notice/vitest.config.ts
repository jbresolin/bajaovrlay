import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'notice',
    // jsdom gives the web component a document to live in; the pure modules ignore it.
    environment: 'jsdom',
    // One VM context per file in reused workers: jsdom loads once per worker, and each file
    // still gets a fresh global scope. Why, and the memory limit: apps/control/vitest.config.ts.
    pool: 'vmThreads',
    vmMemoryLimit: '512MB',
    // Only unit tests; the Playwright suite in e2e/ runs with `pnpm test:e2e`.
    include: ['src/**/*.test.ts'],
    // A test that fakes FontFace or the page's fonts never leaks into the next one.
    unstubGlobals: true,
  },
});
