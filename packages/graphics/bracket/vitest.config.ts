import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The manifest test reads @bajaovrlay/shared (the bindings' fit rules) from its TypeScript
  // source, so it never needs a build of shared first. The condition is given twice because
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
    name: 'bracket',
    // jsdom gives the web component a document to live in; the pure modules ignore it.
    environment: 'jsdom',
    // The default pool, not vmThreads like apps/control: with files sharing a VM worker the
    // graphics' GSAP and Lit globals leaked between them and a race-clock test failed 6 runs
    // in 10 on 2 cores (gate 2 of PR #24); these projects take only seconds anyway.
    // Only unit tests; the Playwright suite in e2e/ runs with `pnpm test:e2e`.
    include: ['src/**/*.test.ts'],
    // A test that fakes FontFace or the page's fonts never leaks into the next one.
    unstubGlobals: true,
  },
});
