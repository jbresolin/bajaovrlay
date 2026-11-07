import { defineConfig, devices } from '@playwright/test';

import {
  portOffsetOfTheBrowserTests,
  realServerPort as realServerPortNumber,
} from './e2e/emptyTheServerState';
import { apiTokensVariableOfTheBrowserTests } from './e2e/triggerCallsOnTheRealServer';

// The tests drive the control page's dev server, which forwards /ws, /api, /health,
// /render and /graphics to a REAL BajaOvrLay server started just for them. Both use
// ports of their own, so a `pnpm dev` left running (3000, 5173) is neither used nor
// disturbed. The root `pnpm test:e2e` still runs the packages' browser tests one
// package at a time, so they do not compete for the machine.
const realServerPort = String(realServerPortNumber);
// Moved with the server's port by BAJAOVRLAY_E2E_PORT_OFFSET (e2e/emptyTheServerState.ts).
const controlPagePort = String(5188 + portOffsetOfTheBrowserTests);
const realServerAddress = `http://127.0.0.1:${realServerPort}`;
const controlPageAddress = `http://127.0.0.1:${controlPagePort}`;
const isRunningInCI = Boolean(process.env.CI);

// A relative DATABASE_PATH is read from the repository root. The folder is gitignored
// and deleted before every start, so each run begins on an empty, newly seeded database.
const temporaryDatabasePath = 'apps/control/e2e-data/takeAndClear.sqlite';
// The server's data folder (DATA_DIR: recordings) lives in the same throwaway folder.
const temporaryDataFolder = 'apps/control/e2e-data';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: isRunningInCI,
  // No retries: a flaky test is a bug, and a retry would hide it.
  retries: 0,
  // One at a time: the tests share one server, and state on it is the thing under test.
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
    baseURL: controlPageAddress,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // The operator's desktop browser, at a common laptop size.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } },
    },
  ],
  webServer: [
    {
      // The real server from its TypeScript source, exactly as `pnpm dev` runs it, but
      // without reading the root .env: every setting it needs is given right here.
      command:
        'rm -rf e2e-data && pnpm --filter @bajaovrlay/server exec tsx --conditions=@bajaovrlay/source src/main.ts',
      env: {
        PORT: realServerPort,
        HOST: '127.0.0.1',
        LOG_LEVEL: 'warn',
        DATABASE_PATH: temporaryDatabasePath,
        DATA_DIR: temporaryDataFolder,
        // The command API on, with a made-up token, so a test can call an HTTP trigger's
        // address as a D200 does (BAJAOVRLAY-48).
        BAJAOVRLAY_API_TOKENS: apiTokensVariableOfTheBrowserTests,
      },
      url: `${realServerAddress}/health`,
      reuseExistingServer: !isRunningInCI,
    },
    {
      // vite.config.ts reads PORT and HOST to know where the server is; given here, they
      // win over the root .env, so the page under test talks to the server above.
      command: `pnpm exec vite --host 127.0.0.1 --port ${controlPagePort}`,
      env: { PORT: realServerPort, HOST: '127.0.0.1' },
      url: controlPageAddress,
      reuseExistingServer: !isRunningInCI,
    },
  ],
});
