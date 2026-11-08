// Test support: the server's HTTP app with the operator login on (BAJAOVRLAY-29), on a real
// SQLite file and a clock the test moves by hand, and the requests a control page makes to
// log in, read its session and log out. Nothing here keeps state between calls.
import type { OperatorRole } from '@bajaovrlay/shared';

import type { ApiTokens } from '../apiAccess/apiTokens.js';
import { openDatabaseForTests } from '../db/temporaryDatabase.testSupport.js';
import { createServerApp } from '../http/createServerApp.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../store/builtGraphicsFolder.testSupport.js';
import { createStateStore } from '../store/createStateStore.js';
import { operatorPinsOfTheTests } from './fakeOperatorPins.testSupport.js';
import { createOperatorLogin } from './operatorLogin.js';
import type { OperatorPins } from './operatorPins.js';

// The clock starts at 08:00 on race day, Saturday 7 November 2026 (São Paulo, UTC-3).
export const momentTheLoginClockStartsAt = '2026-11-07T11:00:00.000Z';

/** A clock a test moves by hand: `read` is the clock, `moveForwardBy` moves it. */
export type ClockMovedByHand = {
  read: () => Date;
  moveForwardBy: (milliseconds: number) => void;
};

/** A clock held at the race day's 08:00 until the test moves it. */
export function createClockMovedByHand(): ClockMovedByHand {
  let nowInMilliseconds = Date.parse(momentTheLoginClockStartsAt);
  return {
    read: () => new Date(nowInMilliseconds),
    moveForwardBy: (milliseconds) => {
      nowInMilliseconds += milliseconds;
    },
  };
}

/**
 * Builds the server app on the database at `databasePath` with the login of the given
 * PINs (the tests' two by default), on the given clock. Opening a second app on the same
 * path, after closing the first database, is how a test restarts the server.
 */
export function createServerAppWithOperatorLogin(options: {
  databasePath: string;
  clock: ClockMovedByHand;
  operatorPins?: OperatorPins;
  logger?: ServerLogger;
  /** DATA_DIR/media, for the upload route and the image addresses; none when left out. */
  mediaFolder?: string;
  /** BAJAOVRLAY_API_TOKENS as the boot read it; the command API off when left out. */
  apiTokens?: ApiTokens;
}) {
  const logger = options.logger ?? createLogger({ level: 'silent' });
  const database = openDatabaseForTests(options.databasePath);
  const stateStore = createStateStore({
    database,
    logger,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: options.clock.read,
  });
  const operatorLogin = createOperatorLogin({
    database,
    operatorPins: options.operatorPins ?? operatorPinsOfTheTests,
    readCurrentTime: options.clock.read,
    logger,
  });
  const app = createServerApp({
    logger,
    version: '0.3.1',
    stateStore,
    operatorLogin,
    mediaFolder: options.mediaFolder,
    apiTokens: options.apiTokens,
  });
  return { app, stateStore, database, operatorLogin };
}

/** What @hono/node-server puts in a request's environment, for a test's client address. */
export function fromTheAddress(clientAddress: string) {
  return { incoming: { socket: { remoteAddress: clientAddress } } };
}

/** Sends the login a control page sends: the role, the PIN and the station. */
export function sendLogin(
  app: ReturnType<typeof createServerApp>,
  login: { role: OperatorRole; pin: string; station: string },
  clientAddress = '192.168.0.21',
) {
  return app.request(
    '/api/v1/session',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(login),
    },
    fromTheAddress(clientAddress),
  );
}

/**
 * The `name=value` part of a Set-Cookie header, as a browser sends it back in its Cookie
 * header; an empty text when the answer set no cookie.
 */
export function readCookieToSendBack(response: Response): string {
  const setCookieHeader = response.headers.get('set-cookie') ?? '';
  return setCookieHeader.split(';')[0] ?? '';
}

/** Logs in with the right PIN of the role and gives back the cookie to send with requests. */
export async function logInAndKeepTheCookie(
  app: ReturnType<typeof createServerApp>,
  role: OperatorRole,
  station: string,
): Promise<string> {
  const pin =
    role === 'produtor' ? operatorPinsOfTheTests.producerPin : operatorPinsOfTheTests.dataRolePin;
  const response = await sendLogin(app, { role, pin, station });
  if (response.status !== 200) {
    throw new Error(`the login as ${role} answered ${String(response.status)}`);
  }
  return readCookieToSendBack(response);
}

/** Reads GET /api/v1/session with the cookie (or none, with an empty text). */
export async function readTheSession(app: ReturnType<typeof createServerApp>, cookie: string) {
  const headers: Record<string, string> = cookie === '' ? {} : { cookie };
  const response = await app.request('/api/v1/session', { headers });
  return { status: response.status, body: (await response.json()) as unknown };
}
