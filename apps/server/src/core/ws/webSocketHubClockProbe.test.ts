/**
 * The hub's answer to a page's clock probe, and the NTP offset in `time` (apps/server)
 *
 * What this module is for:
 *   Pages line their clock up with the server's (BAJAOVRLAY-62): a page sends
 *   `{ type: 'clockProbe', pageSentAtMs }`, the hub answers that page alone with
 *   `{ type: 'clockProbeAnswer', pageSentAtMs, serverNowMs }`, and the page takes the
 *   midpoint of its send and the answer's arrival as the moment the server read its
 *   clock. The ten-second `time` message also says how far the server clock still is
 *   from real time by NTP, which the control page's header warns about from 2 s on.
 *
 * What these tests prove (a real hub on a random port, real sockets, a real store on a
 *   temporary SQLite file, and a clock that only moves when the test says so):
 *   - A probe is answered to its sender, with its own `pageSentAtMs` and the server clock.
 *   - A monitor (the control page's "Programa" frame), which may send no command, gets
 *     its probes answered too; and nobody else hears the answer.
 *   - A probe changes no state: the event log stays as it was.
 *   - The `time` message carries `offFromRealTimeMs` when the server clock knows it, and
 *     leaves it out when it does not.
 *
 * What these tests deliberately do not cover:
 *   - What a page does with the answer; serverAlignedTime.test.ts in packages/shared.
 *   - The ten-second timer itself; webSocketHubServerTime.test.ts.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { operatorLoginOff } from '../operatorLogin/operatorLoginOff.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../store/builtGraphicsFolder.testSupport.js';
import { createStateStore } from '../store/createStateStore.js';
import { createClockAndTimerMovedByHand } from './clockAndTimerMovedByHand.testSupport.js';
import { attachWebSocketHub } from './webSocketHub.js';
import { connectWebSocketTestClient } from './webSocketTestClient.testSupport.js';

// The server's clock starts at 14:32:05 UTC on 9 October 2026 and moves only by hand.
const momentTheServerClockStartsAt = '2026-10-09T14:32:05.000Z';
const momentTheServerClockStartsAtInMilliseconds = 1_791_556_325_000;

/**
 * Starts a hub on a random free port with a store on a fresh database, on a clock and a
 * timer the test moves by hand; the server clock is `offFromRealTimeMs` off real time
 * (undefined: not known). Everything is closed when the test ends.
 */
async function startHubOnAClockMovedByHand(offFromRealTimeMs: number | undefined) {
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
    operatorLogin: operatorLoginOff,
    httpServer,
    stateStore,
    logger,
    heartbeatIntervalInMilliseconds: 15_000,
    readCurrentTime: clockAndTimer.readCurrentTime,
    readOffFromRealTimeMs: () => offFromRealTimeMs,
    startRepeatingTimer: clockAndTimer.startRepeatingTimer,
    cancelRepeatingTimer: clockAndTimer.cancelRepeatingTimer,
  });
  onTestFinished(async () => {
    await webSocketHub.close();
    httpServer.close();
    httpServer.closeAllConnections();
  });
  const port = (httpServer.address() as AddressInfo).port;
  return { clockAndTimer, stateStore, port };
}

/** True for a clockProbeAnswer. */
function isClockProbeAnswer(message: ServerMessage): boolean {
  return message.type === 'clockProbeAnswer';
}

describe("the hub's answer to a clock probe", () => {
  it('answers the page that probed, with its own send time and the server clock', async () => {
    // Arrange: the control page connected, the server clock 40 s after 14:32:05.
    const { clockAndTimer, port } = await startHubOnAClockMovedByHand(undefined);
    const controlPage = await connectWebSocketTestClient(port);
    await controlPage.waitForMessage('hello', (message) => message.type === 'hello');
    clockAndTimer.letTimePass(40_000);

    // Act: the page probes, saying it sent the probe at its own 1 000 123 ms.
    controlPage.sendJson({ type: 'clockProbe', pageSentAtMs: 1_000_123 });
    const answer = await controlPage.waitForMessage('the probe answer', isClockProbeAnswer);

    // Assert: its send time back, and 14:32:45 on the server clock.
    expect(answer, 'the answer echoes the probe and reads the server clock').toEqual({
      type: 'clockProbeAnswer',
      pageSentAtMs: 1_000_123,
      serverNowMs: momentTheServerClockStartsAtInMilliseconds + 40_000,
    });
  });

  it("answers a monitor's probe too, and no one else hears it", async () => {
    // Arrange: the "Programa" monitor and the control page connected.
    const { port } = await startHubOnAClockMovedByHand(undefined);
    const programMonitor = await connectWebSocketTestClient(port, { role: 'monitor' });
    const controlPage = await connectWebSocketTestClient(port);
    await programMonitor.waitForMessage('hello', (message) => message.type === 'hello');
    await controlPage.waitForMessage('hello', (message) => message.type === 'hello');

    // Act: the monitor probes, then the control page probes (its answer proves that
    // everything the hub sent it before has arrived).
    programMonitor.sendJson({ type: 'clockProbe', pageSentAtMs: 52_000 });
    const monitorAnswer = await programMonitor.waitForMessage(
      'the probe answer',
      isClockProbeAnswer,
    );
    controlPage.sendJson({ type: 'clockProbe', pageSentAtMs: 61_000 });
    await controlPage.waitForMessage('its own answer', isClockProbeAnswer);

    // Assert: the monitor got its answer; the control page got only its own.
    expect(monitorAnswer.type, 'a monitor may probe though it may send no command').toBe(
      'clockProbeAnswer',
    );
    const answersHeardByTheControlPage = controlPage
      .readReceivedMessages()
      .filter(isClockProbeAnswer)
      .map((message) => message.type === 'clockProbeAnswer' && message.pageSentAtMs);
    expect(answersHeardByTheControlPage, 'an answer goes to the prober alone').toEqual([61_000]);
  });

  it('changes no state', async () => {
    // Arrange: the control page connected, and the event log as it is.
    const { stateStore, port } = await startHubOnAClockMovedByHand(undefined);
    const controlPage = await connectWebSocketTestClient(port);
    await controlPage.waitForMessage('hello', (message) => message.type === 'hello');
    const eventLogBefore = stateStore.readAllSlices().eventLog;

    // Act: the page probes four times, as after a hello.
    for (const pageSentAtMs of [1_000, 1_020, 1_040, 1_060]) {
      controlPage.sendJson({ type: 'clockProbe', pageSentAtMs });
      await controlPage.waitForMessage(
        `the answer to ${pageSentAtMs}`,
        (message) => message.type === 'clockProbeAnswer' && message.pageSentAtMs === pageSentAtMs,
      );
    }

    // Assert: the event log is unchanged.
    expect(stateStore.readAllSlices().eventLog, 'a probe is not a command').toEqual(eventLogBefore);
  });
});

describe('the NTP offset in the time message', () => {
  const offsetScenarios = [
    // A server clock held 2.35 s behind real time while the enduro clock runs.
    { name: 'carries the offset when NTP has told it', offFromRealTimeMs: 2_350 },
    // NTP off, or no answer yet: nothing to say, so the field is left out.
    { name: 'leaves the offset out when it is not known', offFromRealTimeMs: undefined },
  ];

  it.each(offsetScenarios)('$name', async ({ offFromRealTimeMs }) => {
    // Arrange: a hub whose server clock is off real time as this row says, and a page.
    const { clockAndTimer, port } = await startHubOnAClockMovedByHand(offFromRealTimeMs);
    const controlPage = await connectWebSocketTestClient(port);
    await controlPage.waitForMessage('hello', (message) => message.type === 'hello');

    // Act: ten seconds pass.
    clockAndTimer.letTimePass(10_000);
    const timeMessage = await controlPage.waitForMessage(
      'time',
      (message) => message.type === 'time',
    );

    // Assert: the offset as the row says, beside the server clock.
    const expectedTimeMessage =
      offFromRealTimeMs === undefined
        ? { type: 'time', serverNowMs: momentTheServerClockStartsAtInMilliseconds + 10_000 }
        : {
            type: 'time',
            serverNowMs: momentTheServerClockStartsAtInMilliseconds + 10_000,
            offFromRealTimeMs,
          };
    expect(timeMessage, 'the header reads the offset from here').toEqual(expectedTimeMessage);
  });
});
