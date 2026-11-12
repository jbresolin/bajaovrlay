import { defineConfig, devices } from '@playwright/test';

import {
  builtServerAddress,
  builtServerDatabasePath,
  builtServerDataFolder,
  builtServerPort,
} from './e2e/builtServer.js';

const isRunningInCI = Boolean(process.env.CI);

// One test file: the built system served by the built server, as the Docker image runs it,
// with every request to another address refused inside the browser (BAJAOVRLAY-34). It
// needs `pnpm build` first, as every browser test of the repository does.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: isRunningInCI,
  // No retries: a flaky test is a bug, and a retry would hide it.
  retries: 0,
  // One at a time: both tests share one server, and the second puts a clock on air.
  workers: 1,
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
    baseURL: builtServerAddress,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // OBS's browser source is Chromium, at the 1920x1080 size of the stream canvas.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: [
    {
      // The built server, exactly as the image's CMD starts it, on a new database each
      // run. Its settings are all given here; the root .env is not read.
      command: 'rm -rf .e2e-data && node dist/main.js',
      env: {
        PORT: String(builtServerPort),
        HOST: '127.0.0.1',
        LOG_LEVEL: 'warn',
        DATABASE_PATH: builtServerDatabasePath,
        DATA_DIR: builtServerDataFolder,
        // No NTP: a browser test never waits on the internet, and the clock it checks is
        // the machine's own (BAJAOVRLAY-62).
        BAJAOVRLAY_NTP_SERVERS: 'off',
        // Nor HTTPS Date headers, NTP's fallback (BAJAOVRLAY-76).
        BAJAOVRLAY_HTTP_TIME_SERVERS: 'off',
      },
      url: `${builtServerAddress}/health`,
      reuseExistingServer: !isRunningInCI,
    },
  ],
});
