/**
 * The WebSocket hub's ten-second `time` message (apps/server)
 *
 * What this module is for:
 *   A race clock on air counts on the server's clock: every page compares the server's
 *   time, carried by `hello` and `slice` messages, with its own. But those messages only
 *   come when something changes. During a quiet stretch of a race nothing does, and a
 *   page whose own clock stepped (a time sync on the OBS machine) stayed wrong until the
 *   next change. So the hub also sends every client `{ type: 'time', serverNowMs }` every
 *   ten seconds, whether or not anything changed.
 *
 * What these tests prove (with a real hub on a random port, real sockets, a real store on
 * a temporary SQLite file, and a clock and timer that only move when the test says so):
 *   - Nothing is sent before ten seconds have passed.
 *   - At ten seconds every connected client gets one `time` message carrying the server's
 *     clock at that moment, and at twenty seconds another one.
 *   - A client that connects in the middle of an interval gets the next tick, not one of
 *     its own ten seconds after it connected.
 *   - Closing the hub cancels the timer: no tick runs afterwards.
 *   - A `time` message is not a state change: the event log stays as it was.
 *
 * What these tests deliberately do not cover:
 *   - What a page does with the message; the serverConnection.serverClock tests of
 *     apps/renderer and apps/control cover it.
 *   - Node's own timer behind the default; serverTimeBroadcast.test.ts covers it.
 *   - Everything else the hub does; webSocketHub.test.ts covers it.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../store/builtGraphicsFolder.testSupport.js';
import { createStateStore } from '../store/createStateStore.js';
import { createClockAndTimerMovedByHand } from './clockAndTimerMovedByHand.testSupport.js';
import { attachWebSocketHub } from './webSocketHub.js';
import {
  connectWebSocketTestClient,
  type WebSocketTestClient,
} from './webSocketTestClient.testSupport.js';

// The server's clock starts at 14:32:05 UTC on 9 October 2026 and moves only by hand.
const momentTheServerClockStartsAt = '2026-10-09T14:32:05.000Z';
const momentTheServerClockStartsAtInMilliseconds = 1_791_556_325_000;

/**
 * Starts a hub on a random free port with a store on a fresh database, both on a clock
 * and a timer the test moves by hand. The heartbeat keeps its real 15 s timer, far longer
 * than a test. Everything is closed when the test ends.
 */
async function startHubWithClockAndTimerMovedByHand() {
  const clockAndTimer = createClockAndTimerMovedByHand(momentTheServerClockStartsAt);
  const logger = createLogger({ level: 'silent' });
  const stateStore = createStateStore({
    database: openTemporaryDatabase().database,
    logger,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: clockAndTimer.readCurrentTime,
  });
  const httpServer = createServer();
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const webSocketHub = attachWebSocketHub({
    httpServer,
    stateStore,
    logger,
    heartbeatIntervalInMilliseconds: 15_000,
    readCurrentTime: clockAndTimer.readCurrentTime,
    startRepeatingTimer: clockAndTimer.startRepeatingTimer,
    cancelRepeatingTimer: clockAndTimer.cancelRepeatingTimer,
  });
  onTestFinished(async () => {
    await webSocketHub.close();
    httpServer.close();
    httpServer.closeAllConnections();
  });
  const port = (httpServer.address() as AddressInfo).port;
  return { clockAndTimer, stateStore, webSocketHub, port };
}

/** Connects a client and waits for its hello, so it is surely in the hub's client list. */
async function connectClientThatHasItsHello(port: number): Promise<WebSocketTestClient> {
  const client = await connectWebSocketTestClient(port);
  await client.waitForMessage('hello', (message) => message.type === 'hello');
  return client;
}

/**
 * Waits until everything the server has sent this client so far has arrived, without
 * sleeping: the client sends a clearAll of the empty stage (accepted, changes nothing)
 * and waits for its answer. A socket delivers in order, so any `time` message sent
 * before that answer has arrived by then.
 */
async function waitUntilEverythingSentSoFarHasArrived(
  client: WebSocketTestClient,
  requestId: string,
): Promise<void> {
  client.sendJson({ type: 'command', requestId, command: { type: 'clearAll' } });
  await client.waitForMessage(
    `the answer to ${requestId}`,
    (message) => message.type === 'commandResult' && message.requestId === requestId,
  );
}

/** Reads the `time` messages a client has received, in arrival order. */
function readTimeMessagesReceivedBy(client: WebSocketTestClient): ServerMessage[] {
  return client.readReceivedMessages().filter((message) => message.type === 'time');
}

/** True for a `time` message. */
function isTimeMessage(message: ServerMessage): boolean {
  return message.type === 'time';
}

describe('the time message of the hub', () => {
  it('is not sent before ten seconds have passed', async () => {
    // Arrange: a hub with the control page and a renderer connected.
    const { clockAndTimer, port } = await startHubWithClockAndTimerMovedByHand();
    const controlPage = await connectClientThatHasItsHello(port);
    const renderer = await connectClientThatHasItsHello(port);

    // Act: let 9.999 seconds pass, then wait for everything sent so far to arrive.
    clockAndTimer.letTimePass(9_999);
    await waitUntilEverythingSentSoFarHasArrived(controlPage, 'pedido-1');
    await waitUntilEverythingSentSoFarHasArrived(renderer, 'pedido-2');

    // Assert: neither client got a time message yet.
    expect(
      [readTimeMessagesReceivedBy(controlPage), readTimeMessagesReceivedBy(renderer)],
      'no time message may be sent before the first ten seconds are over',
    ).toEqual([[], []]);
  });

  it('is sent once to every client at ten seconds, with the server clock of that moment', async () => {
    // Arrange: a hub with the control page and a renderer connected.
    const { clockAndTimer, port } = await startHubWithClockAndTimerMovedByHand();
    const controlPage = await connectClientThatHasItsHello(port);
    const renderer = await connectClientThatHasItsHello(port);

    // Act: let exactly ten seconds pass, and wait for everything to arrive.
    clockAndTimer.letTimePass(10_000);
    await waitUntilEverythingSentSoFarHasArrived(controlPage, 'pedido-1');
    await waitUntilEverythingSentSoFarHasArrived(renderer, 'pedido-2');

    // Assert: one time message each, saying 14:32:15 on the server's clock.
    const timeMessageOfTenSeconds = {
      type: 'time',
      serverNowMs: momentTheServerClockStartsAtInMilliseconds + 10_000,
    };
    expect(
      [readTimeMessagesReceivedBy(controlPage), readTimeMessagesReceivedBy(renderer)],
      'every client must get exactly one time message at ten seconds',
    ).toEqual([[timeMessageOfTenSeconds], [timeMessageOfTenSeconds]]);
  });

  it('is sent again at twenty seconds', async () => {
    // Arrange: a hub with a renderer connected.
    const { clockAndTimer, port } = await startHubWithClockAndTimerMovedByHand();
    const renderer = await connectClientThatHasItsHello(port);

    // Act: let twenty-five seconds pass in one go, and wait for everything to arrive.
    clockAndTimer.letTimePass(25_000);
    await waitUntilEverythingSentSoFarHasArrived(renderer, 'pedido-1');

    // Assert: two time messages, each carrying the clock of its own tick (not of the end
    // of the wait), and no third one before thirty seconds.
    expect(
      readTimeMessagesReceivedBy(renderer),
      'a time message must be sent at ten and at twenty seconds, each with its own time',
    ).toEqual([
      { type: 'time', serverNowMs: momentTheServerClockStartsAtInMilliseconds + 10_000 },
      { type: 'time', serverNowMs: momentTheServerClockStartsAtInMilliseconds + 20_000 },
    ]);
  });

  it('reaches a client that connected in the middle of an interval at the next tick', async () => {
    // Arrange: a hub that has been running for six seconds when a renderer connects.
    const { clockAndTimer, port } = await startHubWithClockAndTimerMovedByHand();
    clockAndTimer.letTimePass(6_000);
    const lateRenderer = await connectClientThatHasItsHello(port);

    // Act: four more seconds pass, which is ten seconds for the hub.
    clockAndTimer.letTimePass(4_000);
    const timeMessage = await lateRenderer.waitForMessage('time', isTimeMessage);

    // Assert: the late client got the hub's tick of ten seconds; there is one timer for
    // everyone, not one per client.
    expect(timeMessage, 'a late client must get the very next tick').toEqual({
      type: 'time',
      serverNowMs: momentTheServerClockStartsAtInMilliseconds + 10_000,
    });
    expect(clockAndTimer.countRunningTimers(), 'the hub must run one timer for all clients').toBe(
      1,
    );
  });

  it('is not sent after the hub is closed', async () => {
    // Arrange: a hub with a renderer connected and its timer running.
    const { clockAndTimer, webSocketHub, port } = await startHubWithClockAndTimerMovedByHand();
    const renderer = await connectClientThatHasItsHello(port);
    const numberOfTimersWhileOpen = clockAndTimer.countRunningTimers();

    // Act: close the hub, as a server shutdown does, then let a whole minute pass.
    await webSocketHub.close();
    await renderer.waitUntilClosed();
    const numberOfTimersAfterClose = clockAndTimer.countRunningTimers();
    clockAndTimer.letTimePass(60_000);

    // Assert: the timer ran while the hub was open and was cancelled by the close, so no
    // tick ran in that minute and the client never got a time message.
    expect(
      [numberOfTimersWhileOpen, numberOfTimersAfterClose],
      'closing the hub must cancel its time timer',
    ).toEqual([1, 0]);
    expect(
      readTimeMessagesReceivedBy(renderer),
      'no time message may be sent after the close',
    ).toEqual([]);
  });

  it('leaves the event log alone, because telling the time changes no state', async () => {
    // Arrange: a hub with a renderer connected.
    const { clockAndTimer, stateStore, port } = await startHubWithClockAndTimerMovedByHand();
    const renderer = await connectClientThatHasItsHello(port);

    // Act: let half a minute pass: three time messages.
    clockAndTimer.letTimePass(30_000);
    await waitUntilEverythingSentSoFarHasArrived(renderer, 'pedido-1');

    // Assert: three time messages went out, nothing was logged, and no slice message
    // was sent with them.
    expect(readTimeMessagesReceivedBy(renderer).length, 'three ticks in thirty seconds').toBe(3);
    expect(stateStore.readAllSlices().eventLog, 'a time message is not a command').toEqual([]);
    expect(
      renderer.readReceivedMessages().filter((message) => message.type === 'slice'),
      'a time message must not come with slice messages',
    ).toEqual([]);
  });
});
