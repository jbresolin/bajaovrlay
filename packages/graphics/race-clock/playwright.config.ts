import { defineConfig, devices } from '@playwright/test';

import { portOffsetOfTheBrowserTests } from '../../../scripts/e2ePortOffset.js';

// The tests open the BUILT graphic (dist/) under the same folder the server will use,
// so they also prove that dist/ works when served from /graphics/race-clock/.
// BAJAOVRLAY_E2E_PORT_OFFSET moves every port of the browser tests by the same amount
// (scripts/e2ePortOffset.ts, the one place it is read); CI leaves it unset.
const previewPort = 5176 + portOffsetOfTheBrowserTests;
const builtGraphicAddress = `http://127.0.0.1:${String(previewPort)}/graphics/race-clock/`;
const isRunningInCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: isRunningInCI,
  // No retries: a flaky test is a bug, and a retry would hide it.
  retries: 0,
  // On CI also a JSON report, which scripts/reportSlowestTests.js turns into the
  // slowest-tests table on the run's summary page (docs/ci.md).
  reporter: isRunningInCI
    ? [
        ['list'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/playwright-results.json' }],
      ]
    : 'list',
  use: {
    baseURL: builtGraphicAddress,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // OBS's browser source is Chromium, at the 1920x1080 size of the stream canvas.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: {
    // Build first so the tests never run against a stale dist/ left from an older build.
    command: `pnpm exec vite build && pnpm exec vite preview --host 127.0.0.1 --port ${String(previewPort)} --base /graphics/race-clock/`,
    url: `${builtGraphicAddress}race-clock.ograf.json`,
    reuseExistingServer: !isRunningInCI,
  },
});
