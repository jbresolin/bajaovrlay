// Test support: the server the WebSocket hub tests talk to (a real one on a random port,
// with a fresh SQLite file and its clock held), the take those tests send, and two ways
// to recognise a message. Shared by webSocketHub.test.ts, webSocketHubBadMessages.test.ts
// and webSocketHubConnections.test.ts. Nothing here keeps state between calls.
import type { ServerMessage } from '@bajaovrlay/shared';
import { onTestFinished } from 'vitest';

import { noSourceHostAllowlist } from '../../modules/dataSources/index.js';
import { startServer } from '../boot/startServer.js';
import { createTemporaryDataFolder } from '../boot/temporaryDataFolder.testSupport.js';
import { committedMigrationsFolder } from '../db/openDatabase.js';
import { createTemporaryDatabasePath } from '../db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../store/builtGraphicsFolder.testSupport.js';
import type { StateStore } from '../store/createStateStore.js';
import {
  createRaceClockItemOnTheStore,
  shortcutsPanelHome,
} from '../store/raceClockItemOnTheStore.testSupport.js';

// The server's clock is held at 14:32:05 UTC on 9 October 2026 unless a test moves it,
// so the `serverNowMs` of every message can be compared exactly.
export const momentTheServerClockIsHeldAt = '2026-10-09T14:32:05.000Z';
export const momentTheServerClockIsHeldAtInMilliseconds = 1_791_556_325_000;

/**
 * Starts the whole server on a random free port with a fresh temporary database and the
 * race clock registered (silent unless a logger is given). It is shut down when the test ends.
 */
export async function startServerOnARandomPort(
  options: {
    heartbeatIntervalInMilliseconds?: number;
    logger?: ServerLogger;
    readCurrentTime?: () => Date;
    /** The build-id.json the boot reads once; none unless a test gives one. */
    buildIdFileUrl?: URL;
  } = {},
) {
  const runningServer = await startServer({
    logger: options.logger ?? createLogger({ level: 'silent' }),
    version: '0.3.1',
    host: '127.0.0.1',
    port: 0,
    databasePath: createTemporaryDatabasePath(),
    migrationsFolder: committedMigrationsFolder,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    dataFolder: createTemporaryDataFolder(),
    sourceHostAllowlist: noSourceHostAllowlist,
    buildIdFileUrl: options.buildIdFileUrl,
    heartbeatIntervalInMilliseconds: options.heartbeatIntervalInMilliseconds,
    readCurrentTime: options.readCurrentTime ?? (() => new Date(momentTheServerClockIsHeldAt)),
  });
  onTestFinished(() => runningServer.close());
  return runningServer;
}

/**
 * Prepares the race clock as a button of "Atalhos" on the server's store (before any
 * client connects, so none hears of it) and returns the take of it for a client to send.
 * A quick-fire item moves no cursor: its take changes only the instances and event log.
 */
export function prepareTheTakeOfTheClockItem(stateStore: StateStore) {
  const raceClockItemId = createRaceClockItemOnTheStore(stateStore, {
    home: shortcutsPanelHome,
  });
  return { type: 'takeItem', itemId: raceClockItemId };
}

/** True for a `slices` message carrying the instances slice. */
export function isSlicesMessageWithInstances(message: ServerMessage): boolean {
  return message.type === 'slices' && message.slices.instances !== undefined;
}

/** True for any `commandResult` message. */
export function isCommandResultMessage(message: ServerMessage): boolean {
  return message.type === 'commandResult';
}
