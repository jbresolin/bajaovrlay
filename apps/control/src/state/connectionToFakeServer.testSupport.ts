// Test support: a real control page connection (the real store, the real
// connectToServer) dialling a fake server, with every log line it writes recorded.
// Used by the tests of the connection itself; component tests use
// controlPageOnFakeServer.testSupport.tsx, which also draws the page.
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
 */
export function connectControlPageToFakeServer() {
  const serverStateStore = createServerStateStore();
  const fakeServerSocket = createFakeServerSocket();
  const recordedLogLines: RecordedLogLine[] = [];

  const serverConnection = connectToServer({
    webSocketAddress: 'ws://192.168.0.10:3000/ws',
    serverStateStore,
    openSocket: fakeServerSocket.openSocket,
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
