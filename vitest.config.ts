import { defineConfig } from 'vitest/config';

// One `pnpm test` runs every package's unit tests. Each package keeps its own
// vitest.config.ts (environment, setup files); this file only lists where they are.
// A new package joins by adding its own vitest.config.ts; nothing here changes.
export default defineConfig({
  test: {
    projects: [
      'apps/*/vitest.config.ts',
      'packages/*/vitest.config.ts',
      'packages/graphics/*/vitest.config.ts',
      'scripts/vitest.config.ts',
    ],
  },
});
