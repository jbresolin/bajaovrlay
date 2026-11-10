import { defineConfig, devices } from '@playwright/test';

// The chaos suite (BAJAOVRLAY-32, e2e/chaos/README.md): named failure scenarios against
// real servers, run with `pnpm test:chaos`. A project of its own, apart from the other
// browser tests (playwright.config.ts), because every scenario starts, breaks, kills and
// restarts servers of its own (e2e/chaos/faults/serverProcess.ts): nothing here is started
// by Playwright, and nothing here touches the shared server of the other tests. The servers
// are the BUILT server serving the built pages, as on the stream PC, so run `pnpm build`
// first, as for every browser test.
const isRunningInCI = Boolean(process.env.CI);

// Each scenario waits on real things breaking and mending: a poll interval, a reconnect's
// back-off, a minute offline, an NTP step confirmed 16 s after it was seen. Two minutes
// before a clear failure.
const longestAScenarioMayTakeInMilliseconds = 120_000;

export default defineConfig({
  testDir: './e2e/chaos',
  testMatch: '**/*.chaos.ts',
  forbidOnly: isRunningInCI,
  // No retries: a flaky scenario is a bug, and a retry would hide it.
  retries: 0,
  // One at a time: every scenario uses the same chaos ports (e2e/chaos/steps/chaosPorts.ts).
  workers: 1,
  timeout: longestAScenarioMayTakeInMilliseconds,
  // On CI also the JSON report the slowest-tests table reads (docs/ci.md).
  reporter: isRunningInCI
    ? [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report-chaos' }],
        ['json', { outputFile: 'test-results-chaos/playwright-results.json' }],
      ]
    : 'list',
  outputDir: 'test-results-chaos',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chaos',
      // The operator's desktop browser, at the size the other control page tests use.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } },
    },
  ],
});
