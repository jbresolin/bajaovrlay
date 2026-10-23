import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests read @bajaovrlay/shared/raceTimeText from its TypeScript source, as the build does,
  // so they never need a build of shared first. The condition is given twice because
  // Vitest resolves a file the browser way or the server way depending on the test.
  resolve: {
    conditions: ['@bajaovrlay/source', ...defaultClientConditions],
  },
  ssr: {
    resolve: {
      conditions: ['@bajaovrlay/source', ...defaultServerConditions],
    },
  },
  test: {
    name: 'positions-tower',
    // jsdom gives the web component a document to live in; the pure modules ignore it.
    environment: 'jsdom',
    // One VM context per file in reused workers: jsdom loads once per worker, and each file
    // still gets a fresh global scope. Why, and the memory limit: apps/control/vitest.config.ts.
    pool: 'vmThreads',
    vmMemoryLimit: '512MB',
    // Only unit tests; the Playwright suite in e2e/ runs with `pnpm test:e2e`.
    include: ['src/**/*.test.ts'],
    // A test that fakes requestAnimationFrame or FontFace never leaks into the next one.
    unstubGlobals: true,
  },
});
