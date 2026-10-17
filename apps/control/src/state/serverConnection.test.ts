/**
 * Server connection: state in, commands out (apps/control)
 *
 * What this module is for:
 *   The control page talks to the server over one WebSocket. Everything the page knows
 *   arrives on it (a hello with all the state, then one message per change), and
 *   everything the operator does leaves on it as a command. sendCommand numbers each
 *   command and waits for the server's answer to that number.
 *
 * What these tests prove:
 *   - The page dials the address it was given; a hello fills the store and marks the
 *     page connected; a slice message updates that slice; a slices message updates every
 *     slice it carries in one store update.
 *   - A message that is not JSON, or not in the protocol, changes nothing and is logged.
 *
 * What these tests deliberately do not cover:
 *   - Sending commands and their answers: serverConnectionSendCommand.test.ts.
 *   - What happens when the line drops; serverConnectionRedialling.test.ts covers that.
 *   - The browser's real WebSocket: a fake server socket stands in for it, driven by
 *     hand. The few lines that adapt the real one are exercised by e2e/takeAndClear.e2e.ts.
 *   - The real clock: time is moved by hand, so "5 seconds" takes no time to test.
 */
import { describe, expect, it } from 'vitest';

import {
  connectControlPageToFakeServer,
  connectControlPageToFakeServerThatSaidHello,
} from './connectionToFakeServer.testSupport';
import {
  buildRaceClockInstanceOnTheClockLayer,
  buildSlicesWithTheRaceClockOnAir,
} from './slicesLikeTheServerSends.testSupport';

const momentTheClockWentOnAir = '2026-10-09T13:00:00.000Z';

describe('connecting and receiving state', () => {
  it('dials the address it was given and says connecting until the server says hello', () => {
    // Arrange: nothing to prepare.

    // Act: connect; the server picks up but has not sent its hello yet.
    const { serverStateStore, fakeServerSocket } = connectControlPageToFakeServer();
    fakeServerSocket.acceptConnection();

    // Assert: one call went out to the right address, and the page is still connecting.
    expect(fakeServerSocket.countConnectionsOpened(), 'the page must dial exactly once').toBe(1);
    expect(
      fakeServerSocket.readLastAddressDialled(),
      'the page must dial the address it was given',
    ).toBe('ws://192.168.0.10:3000/ws');
    expect(
      serverStateStore.getState().connectionStatus,
      'the page is not connected until it has the state from the hello',
    ).toBe('connecting');
  });

  it('fills the store and says connected when the server says hello', () => {
    // Arrange: a connection the server has picked up.
    const { serverStateStore, fakeServerSocket } = connectControlPageToFakeServer();
    fakeServerSocket.acceptConnection();

    // Act: the server says hello with the race clock already on air.
    fakeServerSocket.sendMessage({
      type: 'hello',
      slices: buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir),
    });

    // Assert: the store mirrors the hello and the page is connected.
    const state = serverStateStore.getState();
    expect(state.connectionStatus, 'a hello means the page is connected').toBe('connected');
    expect(state.layers, 'the layers from the hello must be in the store').toHaveLength(5);
    expect(state.instances, 'the instance from the hello must be in the store').toEqual([
      buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir),
    ]);
  });

  it('updates one slice when the server sends a slice message', () => {
    // Arrange: a connected page with nothing on air.
    const { serverStateStore, fakeServerSocket } = connectControlPageToFakeServerThatSaidHello();

    // Act: the server says the instances slice now holds the race clock.
    fakeServerSocket.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir)],
    });

    // Assert: the store shows the race clock on air.
    expect(
      serverStateStore.getState().instances,
      'the instances slice must be what the server just sent',
    ).toEqual([buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir)]);
  });
});

describe('a slices message, the several slices of one state change', () => {
  it('updates every slice it carries in one store update', () => {
    // Arrange: a connected page with nothing on air, and a listener that counts how
    // often the store tells it something changed.
    const { serverStateStore, fakeServerSocket } = connectControlPageToFakeServerThatSaidHello();
    const instanceCountSeenAtEachStoreUpdate: number[] = [];
    serverStateStore.subscribe((state) => {
      instanceCountSeenAtEachStoreUpdate.push(state.instances.length);
    });

    // Act: the operator takes the race clock; the server sends the instances and the
    // event-log line of that take in one slices message.
    fakeServerSocket.sendMessage({
      type: 'slices',
      slices: {
        instances: [buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir)],
        eventLog: [
          {
            id: 7,
            ts: momentTheClockWentOnAir,
            actor: 'operador:3f2a9c1e',
            command: 'takeItem',
            payload: { type: 'takeItem', itemId: 'item-largada-do-enduro' },
            result: { status: 'ok' },
          },
        ],
      },
      serverNowMs: 1_791_550_800_000,
    });

    // Assert: one store update, holding the race clock and the event-log line together.
    expect(
      instanceCountSeenAtEachStoreUpdate,
      'the slices of one state change must reach the store in ONE update',
    ).toEqual([1]);
    expect(
      serverStateStore.getState().eventLog.map((entry) => entry.command),
      'the event-log line must have arrived with the instances',
    ).toEqual(['takeItem']);
  });
});

describe('messages the page cannot understand', () => {
  const unreadableMessageScenarios = [
    // Text that is not JSON at all, as a proxy's HTML error page would be.
    {
      name: 'ignores and logs a message that is not JSON',
      rawText: '<html>502 Bad Gateway</html>',
    },
    // Valid JSON of a kind the protocol does not have (a newer server, or a bug).
    {
      name: 'ignores and logs a JSON message that is not in the protocol',
      rawText: JSON.stringify({ type: 'placar', teams: [{ number: 42, name: 'Baja UFPR' }] }),
    },
    // A known kind with the wrong content: a slice message whose instance has no id.
    {
      name: 'ignores and logs a slice message whose content breaks the schema',
      rawText: JSON.stringify({ type: 'slice', name: 'instances', slice: [{ layerId: 'clock' }] }),
    },
  ];

  it.each(unreadableMessageScenarios)('$name', ({ rawText }) => {
    // Arrange: a connected page with the race clock on air.
    const { serverStateStore, fakeServerSocket, recordedLogLines } =
      connectControlPageToFakeServer();
    fakeServerSocket.acceptConnection();
    fakeServerSocket.sendMessage({
      type: 'hello',
      slices: buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir),
    });
    const stateBeforeTheBadMessage = serverStateStore.getState();

    // Act: the bad message arrives.
    fakeServerSocket.sendRawText(rawText);

    // Assert: nothing changed, and one warning was logged about it.
    expect(serverStateStore.getState(), 'a bad message must not change any state').toBe(
      stateBeforeTheBadMessage,
    );
    expect(recordedLogLines, 'a bad message must be logged, exactly once').toHaveLength(1);
    expect(recordedLogLines[0]?.level, 'a bad message is a warning, not a crash').toBe('warn');
    expect(recordedLogLines[0]?.message, 'the log line must say what happened').toBe(
      'ignored a server message that is not in the protocol',
    );
  });
});
