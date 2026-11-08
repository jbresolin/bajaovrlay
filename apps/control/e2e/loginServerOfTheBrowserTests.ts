// Test support: the second real server of the Playwright run, the one with the operator
// login on (BAJAOVRLAY-29), and what its tests type at the login. playwright.config.ts
// starts it; the shared server (5187) keeps the login off, so every other test runs as
// before the PINs existed. Nothing here keeps state between calls.
import { portOffsetOfTheBrowserTests } from './emptyTheServerState';

/**
 * Its port: away from the shared server (5187), the page (5188) and the restart test's own
 * server (5189), moved with them by BAJAOVRLAY_E2E_PORT_OFFSET.
 */
export const loginServerPort = 5181 + portOffsetOfTheBrowserTests;

/** Where the browser opens it: the server serves the built control page itself. */
export const loginServerAddress = `http://127.0.0.1:${String(loginServerPort)}`;

/** The producer's PIN on that server; made up, never a show's. */
export const producerPinOfTheBrowserTests = '246802';

/** The data role's PIN on that server; made up, never a show's. */
export const dataRolePinOfTheBrowserTests = '135791';
