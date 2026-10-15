// Test support: a stand-in for the server's side of the renderer's WebSocket. A test
// drives it by hand (open, send a message, drop) with time faked, so every wait in
// serverConnection.ts is checked to the millisecond without a real server or a real wait.
// It also keeps what the renderer sent, so a test can read back what the server would hear.
// It also builds what that stand-in server says: the slices of a hello, and an answer to
// GET /api/v1/state that the test gives by hand.
import type { Instance, Slices } from '@bajaovrlay/shared';
import { onTestFinished, vi } from 'vitest';

import { connectToServer, type ServerSocket, type SlicesDelivery } from './serverConnection.js';

export const serverWebSocketAddress = 'ws://192.168.0.10:3000/ws?role=renderer';
export const serverStateAddress = 'http://192.168.0.10:3000/api/v1/state';

/** A stand-in socket the test drives by hand, as if it were the server's side talking. */
export type FakeServerSocket = ServerSocket & {
  address: string;
  /** Every text the renderer sent on this socket, oldest first. */
  textsSentByTheRenderer: string[];
  wasClosedByTheRenderer: () => boolean;
  simulateOpen: () => void;
  simulateMessage: (message: unknown) => void;
  simulateText: (text: string) => void;
  simulateDrop: () => void;
};

/** Builds one stand-in socket that remembers its listeners and calls them on demand. */
function createFakeServerSocket(address: string): FakeServerSocket {
  const openListeners: Array<() => void> = [];
  const messageListeners: Array<(data: unknown) => void> = [];
  const closeListeners: Array<() => void> = [];
  const textsSentByTheRenderer: string[] = [];
  let wasClosed = false;
  return {
    address,
    textsSentByTheRenderer,
    send: (text) => textsSentByTheRenderer.push(text),
    onOpen: (listener) => openListeners.push(listener),
    onMessage: (listener) => messageListeners.push(listener),
    onClose: (listener) => closeListeners.push(listener),
    // Like a browser socket, closing it from our side also fires its close event.
    close: () => {
      wasClosed = true;
      closeListeners.forEach((listener) => listener());
    },
    wasClosedByTheRenderer: () => wasClosed,
    simulateOpen: () => openListeners.forEach((listener) => listener()),
    simulateMessage: (message) =>
      messageListeners.forEach((listener) => listener(JSON.stringify(message))),
    simulateText: (text) => messageListeners.forEach((listener) => listener(text)),
    simulateDrop: () => closeListeners.forEach((listener) => listener()),
  };
}

/**
 * Builds every slice as the server sends them in a hello: one layer, one graphic and the
 * given instances (built with the factories of instancesOnAir.testSupport.ts).
 */
export function createSlicesWithInstances(instances: Instance[]): Slices {
  return {
    layers: [
      { id: 'clock', name: 'Relógio', zIndex: 30, replacePolicy: 'out-then-in', persistent: true },
    ],
    graphics: [
      {
        id: 'race-clock',
        manifest: { id: 'baja-race-clock', name: 'Relógio de prova', main: 'race-clock.js' },
        defaultLayerId: 'clock',
        category: 'clock',
        thumbnailUrl: null,
        defaultFields: {},
      },
    ],
    instances,
    eventLog: [],
    // The renderer never reads these five; they are here because every hello carries them.
    rundowns: [],
    items: [],
    quickFirePanels: [],
    macros: [],
    macroRuns: [],
  };
}

/**
 * Builds a GET /api/v1/state that stays under way until the test answers it or makes it
 * fail, so a test can make something else happen while the read is still in flight.
 */
export function createStateReadAnsweredByHand() {
  let answerWith: (body: unknown) => void = () => undefined;
  let failWith: (reason: Error) => void = () => undefined;
  const stateReadUnderWay = new Promise<unknown>((resolve, reject) => {
    answerWith = resolve;
    failWith = reject;
  });
  return {
    readStateOverHttp: () => stateReadUnderWay,
    answerWith: (body: unknown) => answerWith(body),
    failWith: (reason: Error) => failWith(reason),
  };
}

/**
 * Starts a connection on stand-in sockets with time faked, and returns everything a test
 * looks at: the sockets opened so far, the deliveries, the log lines (once as level and
 * message only, once with their details) and the state reads. `sendInstanceStatus` is the
 * connection's own, for the tests about what the renderer tells the server.
 */
export function startConnectionForTests(
  readStateOverHttp: (address: string) => Promise<unknown> = async () => {
    throw new Error('GET /api/v1/state was not expected in this test');
  },
) {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });

  const openedSockets: FakeServerSocket[] = [];
  const deliveries: SlicesDelivery[] = [];
  const logLines: Array<{ level: string; message: string }> = [];
  const logLinesWithDetails: Array<{ level: string; message: string; details: unknown }> = [];
  const stateAddressesRead: string[] = [];

  const connection = connectToServer({
    webSocketAddress: serverWebSocketAddress,
    stateAddress: serverStateAddress,
    openSocket: (address) => {
      const socket = createFakeServerSocket(address);
      openedSockets.push(socket);
      return socket;
    },
    fetchJson: (address) => {
      stateAddressesRead.push(address);
      return readStateOverHttp(address);
    },
    logEvent: (level, message, details = {}) => {
      logLines.push({ level, message });
      logLinesWithDetails.push({ level, message, details });
    },
  });
  connection.onSlices((delivery) => deliveries.push(delivery));

  /** The socket opened most recently; a test that reads it expects one to exist. */
  function latestSocket(): FakeServerSocket {
    const socket = openedSockets.at(-1);
    if (socket === undefined) {
      throw new Error('the connection has not opened any socket yet');
    }
    return socket;
  }

  /** Only the warnings; lines such as "connected" are left out. */
  function readWarnings(): Array<{ level: string; message: string }> {
    return logLines.filter((line) => line.level === 'warn');
  }

  return {
    openedSockets,
    deliveries,
    logLines,
    logLinesWithDetails,
    stateAddressesRead,
    latestSocket,
    readWarnings,
    sendInstanceStatus: connection.sendInstanceStatus,
  };
}
