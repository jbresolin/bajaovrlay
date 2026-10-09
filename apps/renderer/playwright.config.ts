import { defineConfig, devices } from '@playwright/test';

const rendererDevServerAddress = 'http://127.0.0.1:5174';
const isRunningInCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: isRunningInCI,
  // No retries: a flaky test is a bug, and a retry would hide it.
  retries: 0,
  reporter: isRunningInCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: rendererDevServerAddress,
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
    command: 'pnpm exec vite --host 127.0.0.1',
    url: `${rendererDevServerAddress}/render/`,
    reuseExistingServer: !isRunningInCI,
  },
});
