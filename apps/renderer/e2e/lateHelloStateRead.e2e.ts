/**
 * The state read of a renderer page whose hello is late (apps/renderer)
 *
 * What this module is for:
 *   When the server's hello does not arrive within 3 s of the WebSocket opening, the
 *   renderer page reads the whole state over HTTP instead (`GET /api/v1/state`). The
 *   server keeps the race data and the event log from every screen, on the WebSocket and
 *   on that read alike, but only when the read names the page's role: with no role it
 *   answers every slice. So each page must read the state with the same role it dials
 *   the WebSocket with (gate 2 on PR #16).
 *
 * What these tests prove, with the real page in Chromium and a server that never says
 * hello:
 *   - The page OBS loads (`/render/`) reads `/api/v1/state?role=renderer`.
 *   - The program monitor (`/render/?monitor=1`) reads `/api/v1/state?role=monitor`.
 *   - The preview page as the control page frames it (`/render/?target=preview&monitor=1`)
 *     reads `/api/v1/state?role=monitor`.
 *
 * What these tests deliberately do not cover:
 *   - Every spelling of the address and the role it decides; src/rendererPageRole.test.ts.
 *   - What the page does with the state it reads, or when the read fails;
 *     src/serverConnection tests.
 *   - What the server answers to each role; the server's stateRoute.test.ts.
 */
import { expect, test } from '@playwright/test';

// Every address the renderer page dials for the server: /ws with or without a role.
// Vite's own dev socket has another address and is left alone.
const webSocketAddressesOfTheServer = /\/ws(\?.*)?$/;
// The state read, with or without its query.
const stateReadAddresses = /\/api\/v1\/state(\?.*)?$/;

const pageScenarios = [
  // The program output: the one page that is a renderer to the server.
  {
    name: 'reads the state as a renderer when opened at /render/',
    pageAddress: '/render/',
    expectedStateReadPath: '/api/v1/state?role=renderer',
  },
  // The control page's "Programa" frame: a monitor, kept from the race data.
  {
    name: 'reads the state as a monitor when opened at /render/?monitor=1',
    pageAddress: '/render/?monitor=1',
    expectedStateReadPath: '/api/v1/state?role=monitor',
  },
  // The control page's "Prévia" frame: a monitor too.
  {
    name: 'reads the state as a monitor when opened at /render/?target=preview&monitor=1',
    pageAddress: '/render/?target=preview&monitor=1',
    expectedStateReadPath: '/api/v1/state?role=monitor',
  },
];

test.describe('a renderer page whose hello is late', () => {
  for (const scenario of pageScenarios) {
    test(scenario.name, async ({ page }) => {
      // Arrange: a stand-in server that accepts the WebSocket but never says hello, and
      // answers every state read 503 after writing down its address.
      const stateReadPaths: string[] = [];
      await page.routeWebSocket(webSocketAddressesOfTheServer, () => {
        // Accepted, and silent on purpose: no hello, so the page falls back to HTTP.
      });
      await page.route(stateReadAddresses, (route) => {
        const requestAddress = new URL(route.request().url());
        stateReadPaths.push(`${requestAddress.pathname}${requestAddress.search}`);
        return route.fulfill({ status: 503 });
      });

      // Act: open the page and let its 3 s wait for the hello run out.
      await page.goto(scenario.pageAddress);

      // Assert: the first state read names the page's own role.
      await expect
        .poll(() => stateReadPaths.at(0), {
          message: `the page at ${scenario.pageAddress} must read ${scenario.expectedStateReadPath}`,
          timeout: 10_000,
        })
        .toBe(scenario.expectedStateReadPath);
    });
  }
});
