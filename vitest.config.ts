import { defineConfig } from 'vitest/config';

const isRunningInCI = Boolean(process.env.CI);

// One `pnpm test` runs every package's unit tests. Each package keeps its own
// vitest.config.ts (environment, setup files); this file lists where they are and holds
// the settings of the run as a whole (reporters).
// A new package joins by adding its own vitest.config.ts; nothing here changes.
export default defineConfig({
  test: {
    // On CI the run also writes a JSON report, which scripts/reportSlowestTests.js turns
    // into the slowest-tests table on the run's summary page (docs/ci.md).
    reporters: isRunningInCI ? ['default', 'json'] : ['default'],
    outputFile: { json: 'vitest-report.json' },
    projects: [
      'apps/*/vitest.config.ts',
      'packages/*/vitest.config.ts',
      'packages/graphics/*/vitest.config.ts',
      'scripts/vitest.config.ts',
    ],
  },
});
