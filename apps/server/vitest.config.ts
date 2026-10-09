import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests import @bajaovrlay/shared from its TypeScript source, so they never need a
  // build of the shared package first. See packages/shared/README.md.
  ssr: {
    resolve: {
      conditions: ['@bajaovrlay/source', ...defaultServerConditions],
    },
  },
  test: {
    name: 'server',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
