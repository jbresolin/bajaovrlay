import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

// Tests reuse the app's Vite config (React plugin, `@/` alias, shared-source
// condition) so components are compiled exactly as in the browser.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: 'control',
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/testSetup.ts'],
      // Every test starts with a real `fetch` again, even if the previous one stubbed it.
      unstubGlobals: true,
    },
  }),
);
