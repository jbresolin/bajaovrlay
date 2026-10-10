/**
 * The renderer's connection to the server: the messages it hears (apps/renderer)
 *
 * What this module is for:
 *   The renderer holds no state of its own: it draws what the server says. serverConnection
 *   keeps a WebSocket open to `/ws`, checks every message against the shared protocol and
 *   hands the renderer the slices: all of them after a `hello` (a "full snapshot"), or the
 *   same set with one slice replaced after a `slice` message.
 *
 * What these tests prove:
 *   - A `hello` delivers every slice, marked as a full snapshot.
 *   - A `slice` message delivers the slices with that one replaced, not as a full snapshot.
 *   - Anything that is not a protocol message is logged and ignored; so is a `slice` that
 *     arrives before any `hello`. A `commandResult` is ignored silently.
 *
 * What these tests deliberately do not cover:
 *   - Reconnecting after a drop, and reading the state over HTTP when the hello is late;
 *     serverConnection.reconnect.test.ts covers both.
 *   - A real WebSocket or a real server: a stand-in socket is driven by hand
 *     (serverConnection.testSupport.ts). e2e/raceClockOnAir.e2e.ts connects the real
 *     renderer to the real server.
 *   - What the renderer does with the slices; instanceReconciler.test.ts covers that.
 */
import { describe, expect, it } from 'vitest';

import { createEnduroClockInstance } from './instancesOnAir.testSupport.js';
import {
  createSlicesWithInstances,
  serverWebSocketAddress,
  startConnectionForTests,
} from './serverConnection.testSupport.js';

describe('messages from the server', () => {
  it('delivers every slice of a hello as a full snapshot', () => {
    // Arrange: a connection whose socket has just opened.
    const connection = startConnectionForTests();
    const slicesWithGreenClock = createSlicesWithInstances([createEnduroClockInstance()]);
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
      slice: [createEnduroClockInstance()],
    });

    // Assert: the second delivery has the clock and the untouched layers and graphics,
    // and is not a full snapshot (so nothing on screen is rebuilt).
    expect(
      connection.deliveries.at(-1),
      'a slice message must deliver all slices with the changed one replaced',
    ).toEqual({
      slices: createSlicesWithInstances([createEnduroClockInstance()]),
      isFullSnapshot: false,
    });
    expect(connection.deliveries, 'there must be one delivery per message').toHaveLength(2);
  });

  const unusableMessageScenarios = [
    // A proxy or a bug sent plain text: it cannot even be read as JSON.
    { name: 'logs and ignores text that is not JSON', text: 'servidor reiniciando' },
    // Valid JSON, but not a message of the protocol.
    {
      name: 'logs and ignores JSON that is not in the protocol',
      text: '{"type":"placar","pontos":42}',
    },
    // A hello whose slices are broken must not reach the screen half-read.
    {
      name: 'logs and ignores a hello whose slices are incomplete',
      text: '{"type":"hello","slices":{"layers":[]}}',
    },
  ];

  it.each(unusableMessageScenarios)('$name', ({ text }) => {
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
