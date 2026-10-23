import { defineConfig, devices } from '@playwright/test';

// The tests open the BUILT graphic (dist/) under the same folder the server will use,
// so they also prove that dist/ works when served from /graphics/positions-tower/.
const builtGraphicAddress = 'http://127.0.0.1:5178/graphics/positions-tower/';
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
    // The tests open preview.html?data=… with the whole 60-car sample in the address
    // (about 20 KB), past Node's 16 KB default for a request's headers (the request line
    // counts), which the preview server answers with 431 and an empty page; the option
    // raises the limit to 64 KB, room for every list. Set in the command (a POSIX shell,
    // as the `&&` already assumes) so it reaches the node the pnpm shim starts.
    command:
      'pnpm exec vite build && NODE_OPTIONS=--max-http-header-size=65536 pnpm exec vite preview --host 127.0.0.1 --base /graphics/positions-tower/',
    url: `${builtGraphicAddress}positions-tower.ograf.json`,
    reuseExistingServer: !isRunningInCI,
  },
});
