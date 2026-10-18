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

// Both web servers read these: the real server listens there, and the renderer's Vite dev
// server forwards /ws, /api and /graphics there (see vite.config.ts). The ports, the
// database and the data folder are the test run's own, so a `pnpm dev` left running and
// its data are untouched.
const realServerEnvironment = {
  PORT: String(realServerPort),
  HOST: '127.0.0.1',
  LOG_LEVEL: 'warn',
  DATABASE_PATH: realServerDatabasePath,
  DATA_DIR: realServerDataFolder,
};

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: isRunningInCI,
  // No retries: a flaky test is a bug, and a retry would hide it.
  retries: 0,
  reporter: isRunningInCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: rendererPageAddress,
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
      // The real server, from source, serving the real race-clock build. The build runs
      // first so the smoke test never meets a missing or stale dist/. Nothing else builds
      // that folder meanwhile: the race-clock package is a devDependency of the renderer,
      // so pnpm finishes race-clock's own browser tests before starting these.
      command:
        'pnpm --filter @bajaovrlay/race-clock build && pnpm --filter @bajaovrlay/server exec tsx --conditions=@bajaovrlay/source src/main.ts',
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
