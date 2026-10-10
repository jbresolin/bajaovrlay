/**
 * The renderer's connection to the server: drops and a late hello (apps/renderer)
 *
 * What this module is for:
 *   OBS keeps the renderer page open for hours while the server may restart or the network
 *   may blink. serverConnection reconnects by itself, waiting longer after each failed
 *   attempt, and never leaves the stage waiting on a socket that opened but stays quiet.
 *
 * What these tests prove:
 *   - A drop by itself delivers nothing, so whatever is on the stage stays there until
 *     the next hello.
 *   - After a drop the waits are 0.5 s, 1 s, 2 s, 4 s, then 5 s every time.
 *   - A full snapshot starts the waits over at 0.5 s.
 *   - The `hello` after a reconnect is a full snapshot again, so the stage is rebuilt.
 *   - If no `hello` arrives within 3 s of the socket opening, the state is read from
 *     GET /api/v1/state instead and delivered as a full snapshot; a hello in time makes
 *     that read unnecessary.
 *   - If that read fails too, the socket is closed so the normal reconnect takes over.
 *   - An HTTP answer that comes back after a hello arrived, or after the socket dropped,
 *     is ignored: it is older than what the renderer already knows or is about to hear.
 *
 * What these tests deliberately do not cover:
 *   - The messages themselves (hello, slice, unusable ones); serverConnection.test.ts.
 *   - Real time and a real socket: time is faked and the socket is a stand-in
 *     (serverConnection.testSupport.ts). e2e/lifecycle.e2e.ts drops a real connection
 *     in Chromium and watches the page reconnect.
 */
import { describe, expect, it, vi } from 'vitest';

import { createEnduroClockInstance } from './instancesOnAir.testSupport.js';
import {
  createSlicesWithInstances,
  createStateReadAnsweredByHand,
  serverStateAddress,
  startConnectionForTests,
} from './serverConnection.testSupport.js';

/** Builds the slices of a server whose enduro clock is on air under the given flag. */
function createSlicesWithEnduroClockUnderFlag(flagState: string) {
  const enduroClock = createEnduroClockInstance({
    resolvedData: { sessionName: 'Enduro de Resistência', state: flagState, running: true },
  });
  return createSlicesWithInstances([enduroClock]);
}

describe('reconnecting after the socket drops', () => {
  it('delivers nothing when the socket drops, so what is on the stage stays there', () => {
    // Arrange: a connection that received its hello with the clock on air.
    const connection = startConnectionForTests();
    const slicesWithGreenClock = createSlicesWithEnduroClockUnderFlag('green');
    connection.latestSocket().simulateOpen();
    connection.latestSocket().simulateMessage({ type: 'hello', slices: slicesWithGreenClock });

    // Act: the socket drops, and the first reconnect wait passes with the server still away.
    connection.latestSocket().simulateDrop();
    vi.advanceTimersByTime(500);

    // Assert: the renderer heard nothing new, so it has no reason to touch the clock; a
    // second socket is being tried meanwhile.
    expect(
      connection.deliveries,
      'a drop must deliver nothing: the stage is only rebuilt by the next hello',
    ).toEqual([{ slices: slicesWithGreenClock, isFullSnapshot: true }]);
    expect(connection.openedSockets, 'the renderer must be trying to reconnect').toHaveLength(2);
  });

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
    const slicesAfterRestart = createSlicesWithEnduroClockUnderFlag('yellow');
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
    const slicesWithRedClock = createSlicesWithEnduroClockUnderFlag('red');
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
      name: 'closes the socket to try again when the request fails',
      readStateOverHttp: async () => {
        throw new TypeError('Failed to fetch');
      },
    },
    // The server answered, but not with slices (an error body, or another program on the port).
    {
      name: 'closes the socket to try again when the answer is not the slices',
      readStateOverHttp: async () => ({
        error: { code: 'ROUTE_NOT_FOUND', message: 'Endereço não encontrado no servidor.' },
      }),
    },
  ];

  it.each(failedStateReadScenarios)('$name', async ({ readStateOverHttp }) => {
    // Arrange: a socket that opens but never greets, and a state read that fails.
    const connection = startConnectionForTests(readStateOverHttp);
    const silentSocket = connection.latestSocket();
    silentSocket.simulateOpen();

    // Act: let the 3 s pass, then the first 0.5 s reconnect wait.
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(500);

    // Assert: nothing was delivered, the failure was logged, and a fresh socket is tried.
    expect(connection.deliveries, 'a failed state read must deliver nothing').toEqual([]);
    expect(connection.logLines, 'the failed state read must be logged as an error').toContainEqual({
      level: 'error',
      message: 'state read over HTTP failed; reconnecting',
    });
    expect(
      silentSocket.wasClosedByTheRenderer(),
      'the silent socket must be closed so the reconnect starts',
    ).toBe(true);
    expect(connection.openedSockets, 'a new socket must be opened after the wait').toHaveLength(2);
  });
});

describe('something else happening while GET /api/v1/state is under way', () => {
  it('ignores the HTTP answer when the hello arrives while the read is under way', async () => {
    // Arrange: a socket that opened 3 s ago without a hello, so the state is being read
    // over HTTP; the test decides when that read is answered.
    const stateRead = createStateReadAnsweredByHand();
    const connection = startConnectionForTests(stateRead.readStateOverHttp);
    const slicesOfTheHello = createSlicesWithEnduroClockUnderFlag('yellow');
    const olderSlicesReadOverHttp = createSlicesWithEnduroClockUnderFlag('red');
    connection.latestSocket().simulateOpen();
    await vi.advanceTimersByTimeAsync(3000);

    // Act: the late hello arrives first, then the HTTP read is answered with what the
    // server held a moment earlier.
    connection.latestSocket().simulateMessage({ type: 'hello', slices: slicesOfTheHello });
    stateRead.answerWith(olderSlicesReadOverHttp);
    await vi.advanceTimersByTimeAsync(0);

    // Assert: only the hello was delivered; the older HTTP answer never reached the stage.
    expect(
      connection.stateAddressesRead,
      'the state read must have been under way when the hello arrived',
    ).toEqual([serverStateAddress]);
    expect(
      connection.deliveries,
      'an HTTP answer older than the hello must not be delivered after it',
    ).toEqual([{ slices: slicesOfTheHello, isFullSnapshot: true }]);
  });

  it('ignores the HTTP answer when the socket dropped while the read was under way', async () => {
    // Arrange: the same quiet socket, with the state read under way.
    const stateRead = createStateReadAnsweredByHand();
    const connection = startConnectionForTests(stateRead.readStateOverHttp);
    const quietSocket = connection.latestSocket();
    quietSocket.simulateOpen();
    await vi.advanceTimersByTimeAsync(3000);

    // Act: the socket drops (the server went down), and then the HTTP read fails too.
    quietSocket.simulateDrop();
    stateRead.failWith(new TypeError('Failed to fetch'));
    await vi.advanceTimersByTimeAsync(0);

    // Assert: nothing was delivered, and the failed read changed nothing: the drop had
    // already started the reconnect, so there is no second close and no misleading line.
    expect(connection.deliveries, 'nothing may be delivered after the drop').toEqual([]);
    expect(
      connection.logLines.map((line) => line.message),
      'a read that fails after the drop must not be logged as the reason to reconnect',
    ).not.toContain('state read over HTTP failed; reconnecting');
    expect(
      quietSocket.wasClosedByTheRenderer(),
      'a socket that already dropped must not be closed a second time',
    ).toBe(false);
  });
});
