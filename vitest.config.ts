import { availableParallelism } from 'node:os';

import { defineConfig } from 'vitest/config';

const isRunningInCI = Boolean(process.env.CI);
// GITHUB_ACTIONS, not CI: `pnpm verify` sets CI=1 on a developer machine too
// (scripts/verifySteps.js), and there the workers must stay capped.
const isRunningOnGitHubsRunner = process.env.GITHUB_ACTIONS === 'true';
// Four at most off the runner. A vmThreads worker grows to about 512 MB before it is
// replaced (vmMemoryLimit in apps/control), and WSL gets half the host's RAM. On a
// 32-thread machine 32 workers peaked at 10 GB (27 s) and four at 4,3 GB (53 s).
const mostWorkersOffTheRunner = Math.min(availableParallelism(), 4);

// One `pnpm test` runs every package's unit tests. Each package keeps its own
// vitest.config.ts (environment, setup files); this file lists where they are and holds
// the settings of the run as a whole (reporters).
// A new package joins by adding its own vitest.config.ts; nothing here changes.
export default defineConfig({
  test: {
    // On GitHub's runner one worker per core. Vitest's default is one fewer than the
    // cores, which on its 2 cores is a single worker for 568 files: 151 s against 98 s
    // with two (BAJAOVRLAY-42). Elsewhere at most four (above).
    maxWorkers: isRunningOnGitHubsRunner ? '100%' : mostWorkersOffTheRunner,
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
