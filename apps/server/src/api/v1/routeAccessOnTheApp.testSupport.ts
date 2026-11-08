// Test support: the server app with the operator login on and both roles logged in
// (BAJAOVRLAY-29), and how the route access tests send one request and read its status.
// Shared by operatorRouteAccess.test.ts and operatorRouteAccessOutsideTheTable.test.ts.
// Nothing here keeps state between calls.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { onTestFinished } from 'vitest';

import { parseApiTokens } from '../../core/apiAccess/apiTokens.js';
import { companionToken } from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import { createTemporaryDatabasePath } from '../../core/db/temporaryDatabase.testSupport.js';
import {
  createClockMovedByHand,
  createServerAppWithOperatorLogin,
  logInAndKeepTheCookie,
} from '../../core/operatorLogin/operatorLoginOnTheApp.testSupport.js';

/** A media folder in a new temporary folder, removed when the test ends. */
export function createTemporaryMediaFolder(): string {
  const mediaFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-midia-'));
  onTestFinished(() => rmSync(mediaFolder, { recursive: true, force: true }));
  return mediaFolder;
}

/**
 * The server app with the tests' two PINs set, the upload route mounted and, when asked,
 * Companion's token for the command API; with the cookies of Dados at "Mesa 2" and of
 * Produtor at "Mesa 1".
 */
export async function createAppWithTheLoginOnAndBothRolesLoggedIn(
  options: { isCompanionsTokenSet?: boolean } = {},
) {
  const apiTokensParsing = parseApiTokens(`companion=${companionToken}`);
  if (!apiTokensParsing.isValid) {
    throw new Error('the test token must parse');
  }
  const { app } = createServerAppWithOperatorLogin({
    databasePath: createTemporaryDatabasePath(),
    clock: createClockMovedByHand(),
    mediaFolder: createTemporaryMediaFolder(),
    apiTokens: options.isCompanionsTokenSet === true ? apiTokensParsing.apiTokens : undefined,
  });
  const dataRoleCookie = await logInAndKeepTheCookie(app, 'dados', 'Mesa 2');
  const producerCookie = await logInAndKeepTheCookie(app, 'produtor', 'Mesa 1');
  return { app, dataRoleCookie, producerCookie };
}

/** One request of the table, sent with the cookie (or none, with an empty text). */
export function sendTheRowsRequest(
  app: Awaited<ReturnType<typeof createAppWithTheLoginOnAndBothRolesLoggedIn>>['app'],
  request: { path: string; method?: string; json?: unknown },
  cookie: string,
) {
  const headers: Record<string, string> = {};
  if (cookie !== '') {
    headers.cookie = cookie;
  }
  if (request.json !== undefined) {
    headers['content-type'] = 'application/json';
  }
  return app.request(request.path, {
    method: request.method ?? 'GET',
    headers,
    body: request.json === undefined ? undefined : JSON.stringify(request.json),
  });
}

/** A status as the table writes it: the number, or `answered` for the route's own answer. */
export function describeStatusAsTheTableDoes(status: number): number | 'answered' {
  const isAnAccessRefusal = status === 401 || status === 403;
  return isAnAccessRefusal ? status : 'answered';
}
