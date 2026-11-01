// Test support: where the built server of this package's Playwright run listens, and the
// files it writes. playwright.config.ts starts it from dist/ (`node dist/main.js`), the
// same file the Docker image runs, never from the TypeScript source.

import { portOffsetOfTheBrowserTests } from '../../../scripts/e2ePortOffset.js';

// BAJAOVRLAY_E2E_PORT_OFFSET moves every port of the browser tests by the same amount
// (scripts/e2ePortOffset.ts, the one place it is read); CI leaves it unset.

/** The built server's port in a Playwright run; far from 3000 and 8080, so it meets neither. */
export const builtServerPort = 5186 + portOffsetOfTheBrowserTests;

/** The built server's address: the only origin the pages may load anything from. */
export const builtServerAddress = `http://127.0.0.1:${String(builtServerPort)}`;

/** The data folder (DATA_DIR) of the run, from the repository root; gitignored, made anew each run. */
export const builtServerDataFolder = 'apps/server/.e2e-data';

/** The SQLite file of the run, inside that folder. */
export const builtServerDatabasePath = 'apps/server/.e2e-data/offline.sqlite';
