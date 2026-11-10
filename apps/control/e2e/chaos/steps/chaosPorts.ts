// Test support (chaos suite): the ports every scenario uses, one scenario at a time
// (workers: 1). Away from every other browser test's ports (5176–5225), and moved with
// them by BAJAOVRLAY_E2E_PORT_OFFSET, so two checkouts can run their suites at once.
import { portOffsetOfTheBrowserTests } from '../../../../../scripts/e2ePortOffset.js';

/** Where the scenario's own server listens. */
export const chaosServerPort = 5230 + portOffsetOfTheBrowserTests;

/**
 * Where each page's connection proxy listens (faults/connectionProxy.ts): one per page a
 * scenario may cut on its own, the operator's first console, a second one, and the output
 * OBS loads.
 */
export const firstConsoleProxyPort = 5231 + portOffsetOfTheBrowserTests;
export const secondConsoleProxyPort = 5232 + portOffsetOfTheBrowserTests;
export const outputProxyPort = 5233 + portOffsetOfTheBrowserTests;

/**
 * The proxies' addresses, for BAJAOVRLAY_PUBLIC_ORIGINS: a page opened through a proxy is
 * a page of another address than the server's, and the server lets such a page open the
 * console's WebSocket only when it is listed, as a reverse proxy's address is.
 */
export const addressesOfTheProxies = [
  firstConsoleProxyPort,
  secondConsoleProxyPort,
  outputProxyPort,
]
  .map((port) => `http://127.0.0.1:${String(port)}`)
  .join(',');
