import { defaultServerConditions } from 'vite';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.js';

// Tests reuse the page's Vite config, so @bajaovrlay/shared is read from its TypeScript
// source exactly as in the browser and never needs a build first.
export default mergeConfig(
  viteConfig,
  defineConfig({
    // Tests in the `node` environment resolve imports the server way, so the same
    // shared-source condition is repeated here for them.
    ssr: {
      resolve: {
        conditions: ['@bajaovrlay/source', ...defaultServerConditions],
      },
    },
    test: {
      name: 'renderer',
      // Pure logic runs in plain Node. The two files that touch the page (layer
      // containers, custom elements) ask for jsdom in their first line.
      environment: 'node',
      // Only unit tests; the Playwright suite in e2e/ runs with `pnpm test:e2e`.
      include: ['src/**/*.test.ts'],
    },
  }),
);
