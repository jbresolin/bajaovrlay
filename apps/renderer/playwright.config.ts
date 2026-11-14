import { defineConfig, devices } from '@playwright/test';

import {
  realServerDatabasePath,
  realServerDataFolder,
  realServerPort,
  rendererPagePort,
} from './e2e/realServer.js';

const rendererPageAddress = `http://127.0.0.1:${rendererPagePort}`;
const realServerAddress = `http://127.0.0.1:${realServerPort}`;
const isRunningInCI = Boolean(process.env.CI);
// The real-server projects keep the baselines' names of the one "chromium" project they
// came from, so the race clock's existing baseline is still found.
const snapshotPathOfTheChromiumProject =
  '{testDir}/{testFilePath}-snapshots/{arg}-chromium{-snapshotSuffix}{ext}';

// Both web servers read these: the real server listens there, and the renderer's Vite dev
// server forwards /ws, /api, /graphics and /theme there (see vite.config.ts). The ports, the
// database and the data folder are the test run's own, so a `pnpm dev` left running and
// its data are untouched.
const realServerEnvironment = {
  PORT: String(realServerPort),
  HOST: '127.0.0.1',
  LOG_LEVEL: 'warn',
  DATABASE_PATH: realServerDatabasePath,
  DATA_DIR: realServerDataFolder,
  // No NTP: a browser test never waits on the internet, and the clock it checks is the
  // machine's own (BAJAOVRLAY-62).
  BAJAOVRLAY_NTP_SERVERS: 'off',
  // Nor HTTPS Date headers, NTP's fallback (BAJAOVRLAY-76).
  BAJAOVRLAY_HTTP_TIME_SERVERS: 'off',
};

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
    baseURL: rendererPageAddress,
    trace: 'retain-on-failure',
  },
  // Three files drive the one real server (a take, a clearAll), so they must never run at
  // the same time: in two workers one test's clearAll took the other's graphic off air. Each
  // has a project of its own, the combos waiting for the race clock and the outputs for the
  // combos (`dependencies`); every other file talks to a stand-in server inside its page and
  // runs in parallel with them.
  projects: [
    {
      name: 'chromium',
      testIgnore: ['**/raceClockOnAir.e2e.ts', '**/combosOnAir.e2e.ts', '**/outputsOnAir.e2e.ts'],
      // OBS's browser source is Chromium, at the 1920x1080 size of the stream canvas.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'real server: race clock',
      testMatch: '**/raceClockOnAir.e2e.ts',
      snapshotPathTemplate: snapshotPathOfTheChromiumProject,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'real server: combos',
      testMatch: '**/combosOnAir.e2e.ts',
      // What could go wrong: Playwright skips a project whose dependency failed, so a red
      // race clock test also skips the combos (reported "did not run", not failed). Read
      // the race clock's failure first; the combos say nothing until it is fixed.
      dependencies: ['real server: race clock'],
      snapshotPathTemplate: snapshotPathOfTheChromiumProject,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      // One page per output (BAJAOVRLAY-49). It clears only its own layers, but waits for
      // the combos all the same, so their clearAll never lands in the middle of it.
      name: 'real server: outputs',
      testMatch: '**/outputsOnAir.e2e.ts',
      dependencies: ['real server: combos'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: [
    {
      // The real server, from source, serving the real builds of the graphics the tests
      // take: the race clock, and the strip, the ticker and the lower third the combo
      // screenshots compose (BAJAOVRLAY-23). The builds run first so no test meets a missing
      // or stale dist/. Nothing else builds those folders meanwhile: each package is a
      // devDependency of the renderer, so pnpm finishes its own browser tests before these.
      command:
        'pnpm --filter @bajaovrlay/race-clock --filter @bajaovrlay/lower-strip --filter @bajaovrlay/message-ticker --filter @bajaovrlay/lower-third build && pnpm --filter @bajaovrlay/server exec tsx --conditions=@bajaovrlay/source src/main.ts',
      url: `${realServerAddress}/health`,
      env: realServerEnvironment,
      reuseExistingServer: !isRunningInCI,
    },
    {
      // The renderer page itself, from its Vite dev server (no build needed first).
      command: `pnpm exec vite --host 127.0.0.1 --port ${rendererPagePort} --strictPort`,
      url: `${rendererPageAddress}/render/`,
      env: realServerEnvironment,
      reuseExistingServer: !isRunningInCI,
    },
  ],
});
