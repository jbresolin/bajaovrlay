import { defineConfig } from 'vitest/config';

export default defineConfig({
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
