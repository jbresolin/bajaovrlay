import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'notice',
    // jsdom gives the web component a document to live in; the pure modules ignore it.
    environment: 'jsdom',
    // Only unit tests; the Playwright suite in e2e/ runs with `pnpm test:e2e`.
    include: ['src/**/*.test.ts'],
    // A test that fakes FontFace or the page's fonts never leaks into the next one.
    unstubGlobals: true,
  },
});
