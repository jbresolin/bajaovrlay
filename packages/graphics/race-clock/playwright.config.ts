import { defineConfig, devices } from '@playwright/test';

// The tests open the BUILT graphic (dist/) under the same folder the server will use,
// so they also prove that dist/ works when served from /graphics/race-clock/.
const builtGraphicAddress = 'http://127.0.0.1:5176/graphics/race-clock/';
const isRunningInCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: isRunningInCI,
  // No retries: a flaky test is a bug, and a retry would hide it.
  retries: 0,
  reporter: isRunningInCI ? [['list'], ['html', { open: 'never' }]] : 'list',
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
    command:
      'pnpm exec vite build && pnpm exec vite preview --host 127.0.0.1 --base /graphics/race-clock/',
    url: `${builtGraphicAddress}race-clock.ograf.json`,
    reuseExistingServer: !isRunningInCI,
  },
});
