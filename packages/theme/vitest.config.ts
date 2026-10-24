import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'theme',
    // jsdom gives readMotionTokens and gsapEaseOfToken a document with computed styles
    // to read; the guard over the graphics' sources reads files and asks for plain Node
    // in its first line.
    environment: 'jsdom',
    // The default pool, not vmThreads like apps/control: with files sharing a VM worker the
    // graphics' GSAP and Lit globals leaked between them and a race-clock test failed 6 runs
    // in 10 on 2 cores (gate 2 of PR #24); these projects take only seconds anyway.
    include: ['src/**/*.test.ts'],
  },
});
