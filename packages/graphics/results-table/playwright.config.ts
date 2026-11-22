import { defineConfig, devices } from '@playwright/test';

import { portOffsetOfTheBrowserTests } from '../../../scripts/e2ePortOffset.js';

// The tests open the BUILT graphic (dist/) under the same folder the server will use,
// so they also prove that dist/ works when served from /graphics/results-table/.
// BAJAOVRLAY_E2E_PORT_OFFSET moves every port of the browser tests by the same amount
// (scripts/e2ePortOffset.ts, the one place it is read); CI leaves it unset. 5239 is the
// preview port of vite.config.ts, given here so the offset can move it.
const previewPort = 5239 + portOffsetOfTheBrowserTests;
const builtGraphicAddress = `http://127.0.0.1:${String(previewPort)}/graphics/results-table/`;
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
    // The tests open preview.html?data=… with whole result pages in the address
    // (about 20 KB), past Node's 16 KB default for a request's headers, which the preview
    // server answers with 431 and an empty page; the option raises the limit to 64 KB, as
    // the positions tower does. Set in the command so it reaches the node pnpm starts.
    command: `pnpm exec vite build && NODE_OPTIONS=--max-http-header-size=65536 pnpm exec vite preview --host 127.0.0.1 --port ${String(previewPort)} --strictPort --base /graphics/results-table/`,
    url: `${builtGraphicAddress}results-table.ograf.json`,
    reuseExistingServer: !isRunningInCI,
  },
});
