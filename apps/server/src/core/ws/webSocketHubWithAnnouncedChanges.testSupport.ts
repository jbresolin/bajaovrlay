// Test support for webSocketHubScreenSlices.test.ts and webSocketHubNestedChanges.test.ts:
// a hub on a real store whose changes the test can announce itself (for a change no
// command makes) or react to before the hub hears of them, connecting a
// client up to its hello, and a way to wait until a renderer or a monitor has received
// everything sent to it so far. Nothing here keeps state between calls.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { ServerMessage } from '@bajaovrlay/shared';
import { onTestFinished } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../store/builtGraphicsFolder.testSupport.js';
import {
  createStateStore,
  type SliceChangeListener,
  type StateStore,
} from '../store/createStateStore.js';
import { attachWebSocketHub } from './webSocketHub.js';
import { momentTheServerClockIsHeldAt } from './webSocketHubOnARandomPort.testSupport.js';
import {
  connectWebSocketTestClient,
  type WebSocketTestClient,
} from './webSocketTestClient.testSupport.js';

/**
 * Starts a hub on a random free port with a real store on a fresh database, and hands
 * the test the listener the hub gave the store, so the test can tell the hub of a change
 * no command makes. `registerBeforeTheHub`, when given, is handed the real store before the
 * hub is attached, so a listener it registers is told of each change before the hub is.
 * Everything is closed when the test ends.
 */
export async function startHubWhoseChangesTheTestCanAnnounce(
  options: { registerBeforeTheHub?: (realStateStore: StateStore) => void } = {},
): Promise<{
  port: number;
  realStateStore: StateStore;
  listenersTheHubRegistered: SliceChangeListener[];
}> {
  const logger = createLogger({ level: 'silent' });
  const realStateStore = createStateStore({
    database: openTemporaryDatabase().database,
    logger,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => new Date(momentTheServerClockIsHeldAt),
  });
  options.registerBeforeTheHub?.(realStateStore);
  const listenersTheHubRegistered: SliceChangeListener[] = [];
  const stateStore: StateStore = {
    readAllSlices: realStateStore.readAllSlices,
    applyCommand: realStateStore.applyCommand,
    subscribeToSliceChanges: (listener) => {
      listenersTheHubRegistered.push(listener);
      return realStateStore.subscribeToSliceChanges(listener);
    },
    readEventLogEntriesBelow: realStateStore.readEventLogEntriesBelow,
    readNewestAcceptedEventLogEntryOfCommand:
      realStateStore.readNewestAcceptedEventLogEntryOfCommand,
  };
  const httpServer = createServer();
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const webSocketHub = attachWebSocketHub({
    httpServer,
    stateStore,
    logger,
    heartbeatIntervalInMilliseconds: 15_000,
    readCurrentTime: () => new Date(momentTheServerClockIsHeldAt),
  });
  onTestFinished(async () => {
    await webSocketHub.close();
    httpServer.close();
    httpServer.closeAllConnections();
  });
  const port = (httpServer.address() as AddressInfo).port;
  return { port, realStateStore, listenersTheHubRegistered };
}

/**
 * Waits until everything the server has sent a screen connection (a renderer or a
 * monitor) so far has arrived, without sleeping: it reports a status about an instance
 * that does not exist and waits for the answer (ok from a renderer, which changes
 * nothing; NOT_ALLOWED from a monitor, whose refusal row a screen is never sent). A
 * socket delivers in order, so every message sent before that answer has arrived by then.
 */
export async function waitUntilTheScreenHasEverythingSentSoFar(
  screen: WebSocketTestClient,
): Promise<void> {
  screen.sendJson({
    type: 'instanceStatus',
    instanceId: '6d1e4b2a-8c3f-4a5e-9b7d-0f2c4e6a8b13',
    status: 'on-air',
  });
  await screen.waitForMessage('the answer to the status report', (message) => {
    return message.type === 'commandResult';
  });
}

/** Connects a client and waits for its hello, so it is surely in the hub's client list. */
export async function connectAndWaitForHello(
  port: number,
  options: { role?: 'renderer' | 'monitor'; output?: string } = {},
): Promise<{ client: WebSocketTestClient; hello: ServerMessage }> {
  const client = await connectWebSocketTestClient(port, options);
  const hello = await client.waitForMessage('hello', (message) => message.type === 'hello');
  return { client, hello };
}
