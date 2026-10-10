// Test support: a stand-in for the server's side of the renderer's WebSocket. A test
// drives it by hand (open, send a message, drop) with time faked, so every wait in
// serverConnection.ts is checked to the millisecond without a real server or a real wait.
import type { Instance, Slices } from '@bajaovrlay/shared';
import { onTestFinished, vi } from 'vitest';

import { connectToServer, type ServerSocket, type SlicesDelivery } from './serverConnection.js';

export const serverWebSocketAddress = 'ws://192.168.0.10:3000/ws';
export const serverStateAddress = 'http://192.168.0.10:3000/api/v1/state';

/** A stand-in socket the test drives by hand, as if it were the server's side talking. */
export type FakeServerSocket = ServerSocket & {
  address: string;
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
  let wasClosed = false;
  return {
    address,
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

/** Builds the race clock of the enduro, on air on the clock layer. */
export function createEnduroClockInstance(flagState: string): Instance {
  return {
    id: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: { sessionName: 'Enduro de Resistência', state: flagState },
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T13:00:00.000Z',
  };
}

/** Builds every slice as the server holds them: one layer, one graphic, the given instances. */
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
  };
}

/**
 * Starts a connection on stand-in sockets with time faked, and returns everything a test
 * looks at: the sockets opened so far, the deliveries, the log lines and the state reads.
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
    logEvent: (level, message) => {
      logLines.push({ level, message });
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

  return { openedSockets, deliveries, logLines, stateAddressesRead, latestSocket, readWarnings };
}
