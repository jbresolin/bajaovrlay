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
    // The test files of one worker share its modules instead of each importing the server
    // afresh: half of this project's time went to evaluating the same 671 modules 3 484
    // times (103 s → 36 s on 2 cores, BAJAOVRLAY-42). It is safe because no server or
    // shared module keeps state from one call to the next (moduleStateBetweenTestFiles.test.ts
    // proves it and names the few that do and why they cannot leak) and every test builds
    // its own store, database and app through a factory. What could still leak between
    // files is put back after every test, here and in testSetup.ts.
    isolate: false,
    unstubEnvs: true,
    unstubGlobals: true,
    setupFiles: ['./src/testSetup.ts'],
  },
});
