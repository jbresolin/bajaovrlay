import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'renderer',
    environment: 'node',
    // Only unit tests; the Playwright suite in e2e/ runs with `pnpm test:e2e`.
    include: ['src/**/*.test.ts'],
  },
});
