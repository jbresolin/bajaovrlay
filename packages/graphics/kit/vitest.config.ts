import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests read @bajaovrlay/shared/clock (raceClockReading) from its TypeScript source, as the
  // graphics' builds do, so they never need a build of shared first. The condition is given
  // twice because Vitest resolves a file the browser way or the server way depending on the test.
  resolve: {
    conditions: ['@bajaovrlay/source', ...defaultClientConditions],
  },
  ssr: {
    resolve: {
      conditions: ['@bajaovrlay/source', ...defaultServerConditions],
    },
  },
  test: {
    name: 'graphics-kit',
    // jsdom gives the preview controls a document; the pure modules ignore it.
    environment: 'jsdom',
    // The default pool, not vmThreads like apps/control: with files sharing a VM worker the
    // graphics' GSAP and Lit globals leaked between them and a race-clock test failed 6 runs
    // in 10 on 2 cores (gate 2 of PR #24); these projects take only seconds anyway.
    include: ['src/**/*.test.ts'],
  },
});
