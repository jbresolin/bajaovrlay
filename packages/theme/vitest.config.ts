import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'theme',
    // jsdom gives readMotionTokens and gsapEaseOfToken a document with computed styles
    // to read; the guard over the graphics' sources reads files and asks for plain Node
    // in its first line.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
