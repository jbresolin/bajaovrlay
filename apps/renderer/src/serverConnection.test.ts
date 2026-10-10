/**
 * The renderer's connection to the server (apps/renderer)
 *
 * What this module is for:
 *   The renderer holds no state of its own: it draws what the server says. serverConnection
 *   keeps a WebSocket open to `/ws`, checks every message against the shared protocol and
 *   hands the renderer the slices: all of them after a `hello` (a "full snapshot"), or the
 *   same set with one slice replaced after a `slice` message. When the socket drops it
 *   reconnects by itself, waiting longer each time.
 *
 * What these tests prove:
 *   - A `hello` delivers every slice, marked as a full snapshot.
 *   - A `slice` message delivers the slices with that one replaced, not as a full snapshot.
 *   - Anything that is not a protocol message is logged and ignored; so is a `slice` that
 *     arrives before any `hello`. A `commandResult` is ignored silently.
 *   - After a drop the waits are 0.5 s, 1 s, 2 s, 4 s, then 5 s every time; a full snapshot
 *     starts the sequence over, and the `hello` after a reconnect is a full snapshot again.
 *   - If no `hello` arrives within 3 s of the socket opening, the state is read from
 *     GET /api/v1/state instead and delivered as a full snapshot.
 *   - If that read fails too, the socket is closed so the normal reconnect takes over.
 *
 * What these tests deliberately do not cover:
 *   - A real WebSocket or a real server: a stand-in socket is driven by hand and time is
 *     faked. e2e/raceClockOnAir.e2e.ts connects the real renderer to the real server.
 *   - What the renderer does with the slices; instanceReconciler.test.ts covers that.
 */
import type { Instance, Slices } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { connectToServer, type ServerSocket, type SlicesDelivery } from './serverConnection.js';

const serverWebSocketAddress = 'ws://192.168.0.10:3000/ws';
const serverStateAddress = 'http://192.168.0.10:3000/api/v1/state';

/** A stand-in socket the test drives by hand, as if it were the server's side talking. */
type FakeServerSocket = ServerSocket & {
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
function createEnduroClockInstance(flagState: string): Instance {
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
function createSlicesWithInstances(instances: Instance[]): Slices {
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
function startConnectionForTests(
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

describe('messages from the server', () => {
  it('delivers every slice of a hello as a full snapshot', () => {
    // Arrange: a connection whose socket has just opened.
    const connection = startConnectionForTests();
    const slicesWithGreenClock = createSlicesWithInstances([createEnduroClockInstance('green')]);
    connection.latestSocket().simulateOpen();

    // Act: the server greets with every slice.
    connection.latestSocket().simulateMessage({ type: 'hello', slices: slicesWithGreenClock });

    // Assert: one delivery, holding those slices and marked as the full truth.
    expect(
      connection.openedSockets.map((socket) => socket.address),
      'the connection must open one socket, at the /ws address it was given',
    ).toEqual([serverWebSocketAddress]);
    expect(connection.deliveries, 'a hello must deliver its slices as a full snapshot').toEqual([
      { slices: slicesWithGreenClock, isFullSnapshot: true },
    ]);
  });

  it('delivers a slice message as the same slices with that one replaced', () => {
    // Arrange: a connection that already received a hello with nothing on air.
    const connection = startConnectionForTests();
    connection.latestSocket().simulateOpen();
    connection
      .latestSocket()
      .simulateMessage({ type: 'hello', slices: createSlicesWithInstances([]) });

    // Act: the operator takes the clock, so the server sends the new instances slice.
    connection.latestSocket().simulateMessage({
      type: 'slice',
      name: 'instances',
      slice: [createEnduroClockInstance('green')],
    });

    // Assert: the second delivery has the clock and the untouched layers and graphics,
    // and is not a full snapshot (so nothing on screen is rebuilt).
    expect(
      connection.deliveries.at(-1),
      'a slice message must deliver all slices with the changed one replaced',
    ).toEqual({
      slices: createSlicesWithInstances([createEnduroClockInstance('green')]),
      isFullSnapshot: false,
    });
    expect(connection.deliveries, 'there must be one delivery per message').toHaveLength(2);
  });

  const unusableMessageScenarios = [
    // A proxy or a bug sent plain text: it cannot even be read as JSON.
    { name: 'text that is not JSON', text: 'servidor reiniciando' },
    // Valid JSON, but not a message of the protocol.
    { name: 'JSON that is not in the protocol', text: '{"type":"placar","pontos":42}' },
    // A hello whose slices are broken must not reach the screen half-read.
    {
      name: 'a hello whose slices are incomplete',
      text: '{"type":"hello","slices":{"layers":[]}}',
    },
  ];

  it.each(unusableMessageScenarios)('logs and ignores $name', ({ text }) => {
    // Arrange: a connection whose socket has just opened.
    const connection = startConnectionForTests();
    connection.latestSocket().simulateOpen();

    // Act: the unusable text arrives.
    connection.latestSocket().simulateText(text);

    // Assert: nothing was delivered, one warning was logged, and the socket stays open.
    expect(connection.deliveries, 'an unusable message must not deliver anything').toEqual([]);
    expect(connection.readWarnings(), 'an unusable message must be logged as a warning').toEqual([
      { level: 'warn', message: 'server message ignored: not in the protocol' },
    ]);
    expect(
      connection.latestSocket().wasClosedByTheRenderer(),
      'one bad message must not make the renderer hang up',
    ).toBe(false);
  });

  it('logs and ignores a slice message that arrives before any hello', () => {
    // Arrange: a connection whose socket has just opened, with no hello yet.
    const connection = startConnectionForTests();
    connection.latestSocket().simulateOpen();

    // Act: a slice arrives first; the other slices are still unknown.
    connection.latestSocket().simulateMessage({ type: 'slice', name: 'instances', slice: [] });

    // Assert: nothing is delivered, because one slice alone is not the whole truth.
    expect(connection.deliveries, 'a slice before the hello must not deliver anything').toEqual([]);
    expect(connection.readWarnings(), 'the early slice must be logged as a warning').toEqual([
      { level: 'warn', message: 'slice message ignored: no full snapshot received yet' },
    ]);
  });

  it('ignores a commandResult without logging, because the renderer sends no commands', () => {
    // Arrange: a connection that already received its hello.
    const connection = startConnectionForTests();
    connection.latestSocket().simulateOpen();
    connection
      .latestSocket()
      .simulateMessage({ type: 'hello', slices: createSlicesWithInstances([]) });
    const logLineCountAfterHello = connection.logLines.length;

    // Act: a commandResult arrives.
    connection
      .latestSocket()
      .simulateMessage({ type: 'commandResult', requestId: 'pedido-17', ok: true });

    // Assert: still only the hello's delivery, and no new log line.
    expect(connection.deliveries, 'a commandResult must not deliver anything').toHaveLength(1);
    expect(connection.logLines, 'a commandResult must not be logged').toHaveLength(
      logLineCountAfterHello,
    );
  });
});

describe('reconnecting after the socket drops', () => {
  it('waits 0.5 s, then doubles up to 5 s between attempts', () => {
    // Arrange: a connection whose first socket is about to drop, and the waits we expect.
    const connection = startConnectionForTests();
    const expectedWaitsInMilliseconds = [500, 1000, 2000, 4000, 5000, 5000];
    const socketCountsJustBeforeEachWaitEnds: number[] = [];
    const socketCountsOnceEachWaitEnds: number[] = [];

    // Act: drop every socket as soon as it exists (a server that stays down), and count
    // the sockets one millisecond before each wait ends and right when it ends.
    for (const waitInMilliseconds of expectedWaitsInMilliseconds) {
      connection.latestSocket().simulateDrop();
      vi.advanceTimersByTime(waitInMilliseconds - 1);
      socketCountsJustBeforeEachWaitEnds.push(connection.openedSockets.length);
      vi.advanceTimersByTime(1);
      socketCountsOnceEachWaitEnds.push(connection.openedSockets.length);
    }

    // Assert: no new socket before each wait is over, exactly one more when it is.
    expect(
      socketCountsJustBeforeEachWaitEnds,
      'no reconnect may happen before its wait is over',
    ).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      socketCountsOnceEachWaitEnds,
      'each wait of 0.5, 1, 2, 4, 5 and 5 seconds must end with one new socket',
    ).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('starts the waits over at 0.5 s once a full snapshot has arrived', () => {
    // Arrange: two failed attempts (so the next wait would be 2 s), then a socket that
    // opens and receives its hello.
    const connection = startConnectionForTests();
    connection.latestSocket().simulateDrop();
    vi.advanceTimersByTime(500);
    connection.latestSocket().simulateDrop();
    vi.advanceTimersByTime(1000);
    connection.latestSocket().simulateOpen();
    connection
      .latestSocket()
      .simulateMessage({ type: 'hello', slices: createSlicesWithInstances([]) });
    const socketCountWhileConnected = connection.openedSockets.length;

    // Act: the connection drops again, and half a second passes.
    connection.latestSocket().simulateDrop();
    vi.advanceTimersByTime(500);

    // Assert: a new socket was opened after only 0.5 s.
    expect(
      connection.openedSockets.length,
      'after a good connection the first retry must come after 0.5 s again',
    ).toBe(socketCountWhileConnected + 1);
  });

  it('treats the hello after a reconnect as a full snapshot again', () => {
    // Arrange: a connection that got its hello, then dropped and reconnected.
    const connection = startConnectionForTests();
    connection.latestSocket().simulateOpen();
    connection
      .latestSocket()
      .simulateMessage({ type: 'hello', slices: createSlicesWithInstances([]) });
    connection.latestSocket().simulateDrop();
    vi.advanceTimersByTime(500);
    connection.latestSocket().simulateOpen();

    // Act: the server (restarted meanwhile) greets with the clock on air.
    const slicesAfterRestart = createSlicesWithInstances([createEnduroClockInstance('yellow')]);
    connection.latestSocket().simulateMessage({ type: 'hello', slices: slicesAfterRestart });

    // Assert: the new hello is the full truth, so the renderer rebuilds the stage from it.
    expect(
      connection.deliveries.at(-1),
      'every hello must be delivered as a full snapshot, also after a reconnect',
    ).toEqual({ slices: slicesAfterRestart, isFullSnapshot: true });
  });
});

describe('reading the state over HTTP when the hello is late', () => {
  it('reads GET /api/v1/state 3 s after the socket opened without a hello', async () => {
    // Arrange: a server whose socket opens but never greets, and whose state address works.
    const slicesWithRedClock = createSlicesWithInstances([createEnduroClockInstance('red')]);
    const connection = startConnectionForTests(async () => slicesWithRedClock);
    connection.latestSocket().simulateOpen();

    // Act: let 3 s pass, one millisecond short first.
    await vi.advanceTimersByTimeAsync(2999);
    const stateReadsJustBefore3Seconds = [...connection.stateAddressesRead];
    await vi.advanceTimersByTimeAsync(1);

    // Assert: the state was read only once the 3 s were over, and delivered as the full truth.
    expect(stateReadsJustBefore3Seconds, 'the state must not be read before 3 s').toEqual([]);
    expect(
      connection.stateAddressesRead,
      'after 3 s the state must be read from the address it was given',
    ).toEqual([serverStateAddress]);
    expect(
      connection.deliveries,
      'the state read over HTTP must be delivered as a full snapshot',
    ).toEqual([{ slices: slicesWithRedClock, isFullSnapshot: true }]);
  });

  it('does not read the state when the hello arrives in time', async () => {
    // Arrange: a socket that opens and greets one second later.
    const connection = startConnectionForTests();
    connection.latestSocket().simulateOpen();
    await vi.advanceTimersByTimeAsync(1000);
    connection
      .latestSocket()
      .simulateMessage({ type: 'hello', slices: createSlicesWithInstances([]) });

    // Act: let much more than 3 s pass.
    await vi.advanceTimersByTimeAsync(10_000);

    // Assert: the hello was enough; nobody asked the state address.
    expect(
      connection.stateAddressesRead,
      'a hello in time must make the HTTP read unnecessary',
    ).toEqual([]);
    expect(connection.deliveries, 'only the hello must have been delivered').toHaveLength(1);
  });

  const failedStateReadScenarios = [
    // The server is half up: the socket opened but HTTP answers nothing.
    {
      name: 'the request fails',
      readStateOverHttp: async () => {
        throw new TypeError('Failed to fetch');
      },
    },
    // The server answered, but not with slices (an error body, or another program on the port).
    {
      name: 'the answer is not the slices',
      readStateOverHttp: async () => ({
        error: { code: 'ROUTE_NOT_FOUND', message: 'Endereço não encontrado no servidor.' },
      }),
    },
  ];

  it.each(failedStateReadScenarios)(
    'closes the socket to try again when $name',
    async ({ readStateOverHttp }) => {
      // Arrange: a socket that opens but never greets, and a state read that fails.
      const connection = startConnectionForTests(readStateOverHttp);
      const silentSocket = connection.latestSocket();
      silentSocket.simulateOpen();

      // Act: let the 3 s pass, then the first 0.5 s reconnect wait.
      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(500);

      // Assert: nothing was delivered, the failure was logged, and a fresh socket is tried.
      expect(connection.deliveries, 'a failed state read must deliver nothing').toEqual([]);
      expect(
        connection.logLines,
        'the failed state read must be logged as an error',
      ).toContainEqual({ level: 'error', message: 'state read over HTTP failed; reconnecting' });
      expect(
        silentSocket.wasClosedByTheRenderer(),
        'the silent socket must be closed so the reconnect starts',
      ).toBe(true);
      expect(connection.openedSockets, 'a new socket must be opened after the wait').toHaveLength(
        2,
      );
    },
  );
});
