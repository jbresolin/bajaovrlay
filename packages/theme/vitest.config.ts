import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'theme',
    // jsdom gives readMotionTokens and gsapEaseOfToken a document with computed styles
    // to read; the guard over the graphics' sources reads files and asks for plain Node
    // in its first line.
    environment: 'jsdom',
    // One VM context per file in reused workers: jsdom loads once per worker, and each file
    // still gets a fresh global scope. Why, and the memory limit: apps/control/vitest.config.ts.
    pool: 'vmThreads',
    vmMemoryLimit: '512MB',
    include: ['src/**/*.test.ts'],
  },
});
