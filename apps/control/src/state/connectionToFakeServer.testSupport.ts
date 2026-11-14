// Test support: a real control page connection (the real store, the real
// connectToServer) dialling a fake server, with every log line it writes recorded.
// Used by the tests of the connection itself; component tests use
// controlPageOnFakeServer.testSupport.tsx, which also draws the page.
import type { PageReloadForNewBuild } from '@bajaovrlay/shared';

import type { ConsoleIdMemory } from './consoleIdOfThisTab';
import { createFakeServerSocket } from './fakeServerSocket.testSupport';
import { connectToServer } from './serverConnection';
import { createServerStateStore } from './serverStateStore';
import { buildSlicesWithNothingOnAir } from './slicesLikeTheServerSends.testSupport';

/** One line the connection wrote to the log, as the test recorded it. */
export type RecordedLogLine = {
  level: string;
  message: string;
  details: Record<string, unknown>;
};

/**
 * Builds a control page connection dialling a fake server, which has not picked up yet.
 * The connection numbers its commands pedido-1, pedido-2, ... in the order they are sent.
 * With `pageReloadForNewBuild` it compares the build in each hello, as main.tsx's does;
 * without, it compares nothing. With `consoleIdMemory` it keeps and names its console id
 * there, as main.tsx's does in sessionStorage (BAJAOVRLAY-69); without, it keeps none.
 */
export function connectControlPageToFakeServer(
  options: {
    pageReloadForNewBuild?: PageReloadForNewBuild;
    consoleIdMemory?: ConsoleIdMemory;
  } = {},
) {
  const serverStateStore = createServerStateStore();
  const fakeServerSocket = createFakeServerSocket();
  const recordedLogLines: RecordedLogLine[] = [];

  const serverConnection = connectToServer({
    webSocketAddress: 'ws://192.168.0.10:3000/ws',
    serverStateStore,
    openSocket: fakeServerSocket.openSocket,
    pageReloadForNewBuild: options.pageReloadForNewBuild,
    consoleIdMemory: options.consoleIdMemory,
    logEvent: (level, message, details = {}) => {
      recordedLogLines.push({ level, message, details });
    },
  });

  return { serverStateStore, fakeServerSocket, recordedLogLines, serverConnection };
}

/** The same, after the server picked up and said hello with nothing on air. */
export function connectControlPageToFakeServerThatSaidHello() {
  const controlPage = connectControlPageToFakeServer();
  controlPage.fakeServerSocket.acceptConnection();
  controlPage.fakeServerSocket.sendMessage({
    type: 'hello',
    slices: buildSlicesWithNothingOnAir(),
  });
  return controlPage;
}
