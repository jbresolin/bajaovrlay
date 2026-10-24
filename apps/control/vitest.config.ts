import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

// Tests reuse the app's Vite config (React plugin, `@/` alias, shared-source
// condition) so components are compiled exactly as in the browser.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: 'control',
      environment: 'jsdom',
      // Each test file runs in a VM context of its own inside a worker that is reused, so
      // jsdom's code loads once per worker instead of once per file, and every file still
      // starts with a fresh global scope (Vitest's own advice: "jsdom was created 196
      // times"). On 2 cores this project went from 208 s to 93 s (BAJAOVRLAY-42).
      // What could go wrong: code that keeps animation or timer state on the window (GSAP,
      // Lit) leaked between files sharing a VM worker in the graphics packages, which went
      // back to the default pool (gate 2 of PR #24). None runs here: this project imports
      // only race-clock's manifest JSON, starts its timers inside effects that clear them,
      // and testSetup.ts restores real timers. Importing a graphic's code into these tests
      // would bring that risk here.
      pool: 'vmThreads',
      // A VM context is never fully freed, so a worker grows with every file until it is
      // replaced. 512 MB was as fast as 1 GB and halved the peak (1.1 GB against 1.5 GB;
      // 3.2 GB with no limit), which leaves room on CI's 7 GB runner.
      vmMemoryLimit: '512MB',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/testSetup.ts'],
      // Every test starts with a real `fetch` again, even if the previous one stubbed it.
      unstubGlobals: true,
      // Browser tests live in e2e/ and are Playwright's, not Vitest's.
      exclude: ['e2e/**', 'node_modules/**'],
    },
  }),
);
