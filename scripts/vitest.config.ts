import { defineConfig } from 'vitest/config';

// The root scripts' tests: the pure parts of the plain-Node scripts (the HTTP servers
// around them are tried by hand). Listed in the root vitest.config.ts with the packages.
export default defineConfig({
  test: {
    name: 'scripts',
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
