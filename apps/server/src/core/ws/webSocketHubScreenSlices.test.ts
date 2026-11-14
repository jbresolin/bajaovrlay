/**
 * What a screen connection is sent: the four slices it draws, and nothing else (apps/server)
 *
 * What this module is for:
 *   A screen connection is a renderer page: the one OBS loads (`/ws?role=renderer`) or a
 *   copy the control page frames as its "Programa" or "Prévia" monitor
 *   (`/ws?role=monitor`). A screen draws the layers, the graphics, the instances on air
 *   and the layers Prévia shows as "vai limpar" (`previewClearedLayerIds`), and reads no
 *   other slice. So the hub sends a screen those four slices only (João's ruling at gate 2
 *   of PR #17): every other slice is an empty list in its hello and is never in a later
 *   message, and the `dataSnapshot` message (one source's change) never goes to a screen.
 *   Operator connections (the control page itself) receive everything. Two reasons:
 *   graphics receive resolved data only (architecture rule 3), so parsing a 60-car
 *   snapshot every two seconds would be a frame-drop risk in OBS; and an OBS page opened
 *   before an upgrade keeps its old schemas, so a slice it never reads (a data source of a
 *   kind it does not know, such as `httpJson`) must not be able to make it refuse its hello.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - An operator's hello carries every slice; the hello of a renderer and of a monitor
 *     carries the four drawn slices as the server holds them and each of the nine other
 *     slices as an empty list, on purpose: the server holds something in every one of
 *     those nine (a macro run and a recording included), so none is empty by accident.
 *   - Polls recorded while all three are connected reach the operator as `dataSnapshot`
 *     messages and the `dataSources` slice; a renderer and a monitor receive no message
 *     for them at all (each poll changes only slices a screen is not sent).
 *   - A take from the control page reaches a renderer and a monitor as the `instances`
 *     slice alone, as a single `slice` message.
 *   - A refused command (it changes the event log alone) sends a renderer and a monitor
 *     nothing, while the operator gets the `eventLog` slice.
 *   - A change of `dataSnapshots` alone sends the operator the one `dataSnapshot` message
 *     and a renderer and a monitor nothing, not an empty group (with a real hub and
 *     store, the change handed to the hub by the test, because no command changes that
 *     slice alone today).
 *
 * What these tests deliberately do not cover:
 *   - A renderer's hello once an `httpJson` source exists:
 *     webSocketHubScreenHelloWithAFlexSource.test.ts.
 *   - GET /api/v1/state, the renderer's fallback for a hello, which gives the same copy
 *     when asked with `?role=`; api/v1/stateRoute.test.ts covers it.
 *   - How a connection gets its role, and what a monitor may send; connectionActor.test.ts,
 *     webSocketHubRoles.test.ts and store/authorizeMonitorCommands.test.ts cover those.
 *   - The renderer's own handling of a hello: apps/renderer/src/serverConnection*.test.ts.
 *   - The poller itself: the source is turned on, polled by hand and turned off within
 *     one tick, so the poller's first poll (armed on a 0 ms timer) never runs.
 *     modules/dataSources/poller.test.ts covers the poller.
 */
import type { ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  fillEverySliceAScreenIsNotSent,
  listHiddenSlicesTheServerHoldsNothingIn,
} from './hiddenSlicesFilledOnTheStore.testSupport.js';
import {
  buildGoodPollOfTheSimulator,
  firstPollAtMs,
  recordPollsOfTheSimulatorByHand,
  secondPollAtMs,
  thirdPollAtMs,
} from './simulatorPolledByHand.testSupport.js';
import {
  buildTheCopyAScreenShouldGet,
  sliceNamesAScreenDraws,
} from './slicesSentToScreens.testSupport.js';
import {
  prepareTheTakeOfTheClockItem,
  startServerOnARandomPort,
} from './webSocketHubOnARandomPort.testSupport.js';
import {
  connectAndWaitForHello,
  startHubWhoseChangesTheTestCanAnnounce,
  waitUntilTheScreenHasEverythingSentSoFar,
} from './webSocketHubWithAnnouncedChanges.testSupport.js';
import type { WebSocketTestClient } from './webSocketTestClient.testSupport.js';

/**
 * The names of the slices a message carries something of, whatever its form: every
 * non-empty slice of a hello, the keys of a `slices` group, the name of a `slice`, and
 * `dataSnapshots` for a `dataSnapshot` message (part of that slice).
 */
function listSliceNamesTheMessageCarries(message: ServerMessage): string[] {
  if (message.type === 'hello') {
    // `obs` is an object, always there; a screen's copy says "no OBS" (checked apart).
    return Object.entries(message.slices)
      .filter(
        ([sliceName, slice]) => sliceName !== 'obs' && Array.isArray(slice) && slice.length > 0,
      )
      .map(([sliceName]) => sliceName);
  }
  if (message.type === 'slices') {
    return Object.keys(message.slices);
  }
  if (message.type === 'slice') {
    return [message.name];
  }
  if (message.type === 'dataSnapshot') {
    return ['dataSnapshots'];
  }
  return [];
}

/** The names of every slice a screen received something of that it does not draw. */
function listSlicesTheScreenShouldNeverHaveReceived(screen: WebSocketTestClient): string[] {
  const sliceNamesReceived = screen.readReceivedMessages().flatMap(listSliceNamesTheMessageCarries);
  return sliceNamesReceived.filter((sliceName) => {
    const isDrawnByAScreen = sliceNamesAScreenDraws.some((drawnName) => drawnName === sliceName);
    return !isDrawnByAScreen;
  });
}

/** Whether a message carries slices: one `slice`, or a `slices` group. */
function isSliceOrGroupOfSlices(message: ServerMessage): boolean {
  return message.type === 'slice' || message.type === 'slices';
}

describe('the hello of a connection', () => {
  it('gives an operator every slice, and a renderer and a monitor the four drawn slices with the rest empty', async () => {
    // Arrange: a running server with something in every slice a screen is not sent (an
    // item, a macro and its run, and the simulator recorded and polled once), all done
    // before anyone connected.
    const runningServer = await startServerOnARandomPort();
    fillEverySliceAScreenIsNotSent(runningServer.stateStore);
    const slicesOnTheServer = runningServer.stateStore.readAllSlices();

    // Act: the control page, the renderer OBS loads and the "Programa" monitor connect.
    const { hello: helloOfTheOperator } = await connectAndWaitForHello(runningServer.port);
    const { hello: helloOfTheRenderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
    });
    const { hello: helloOfTheMonitor } = await connectAndWaitForHello(runningServer.port, {
      role: 'monitor',
    });

    // Assert: the server holds something in each of the nine slices a screen is not
    // sent; the operator hello has everything; the two screens get the four drawn slices
    // and those nine empty.
    expect(
      listHiddenSlicesTheServerHoldsNothingIn(slicesOnTheServer),
      'every slice a screen is not sent must hold something on the server, so its emptiness on a screen is proven',
    ).toEqual([]);
    // The operator's hello also names its console (BAJAOVRLAY-69); a screen's names none.
    expect(helloOfTheOperator, 'the operator hello must carry every slice').toEqual({
      type: 'hello',
      slices: slicesOnTheServer,
      serverNowMs: expect.any(Number),
      serverClockStepCount: expect.any(Number),
      consoleId: expect.any(String),
    });
    expect(helloOfTheRenderer, 'the renderer hello must carry only what a screen draws').toEqual({
      type: 'hello',
      slices: buildTheCopyAScreenShouldGet(slicesOnTheServer),
      serverNowMs: expect.any(Number),
      serverClockStepCount: expect.any(Number),
    });
    expect(helloOfTheMonitor, 'the monitor hello must carry only what a screen draws').toEqual({
      type: 'hello',
      slices: buildTheCopyAScreenShouldGet(slicesOnTheServer),
      serverNowMs: expect.any(Number),
      serverClockStepCount: expect.any(Number),
    });
  });
});

describe('polls recorded while an operator, a renderer and a monitor are connected', () => {
  it('reach the operator as dataSnapshot messages and the source, and send a screen no message at all', async () => {
    // Arrange: a running server, the control page, the renderer and the monitor connected.
    const runningServer = await startServerOnARandomPort();
    const { client: controlPage } = await connectAndWaitForHello(runningServer.port);
    const { client: renderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
    });
    const { client: monitor } = await connectAndWaitForHello(runningServer.port, {
      role: 'monitor',
    });

    // Act: the simulator is turned on, polled three times and turned off.
    recordPollsOfTheSimulatorByHand(runningServer.stateStore, [
      buildGoodPollOfTheSimulator(6, firstPollAtMs),
      buildGoodPollOfTheSimulator(7, secondPollAtMs),
      buildGoodPollOfTheSimulator(8, thirdPollAtMs),
    ]);
    const lastSnapshotOnTheControlPage = await controlPage.waitForMessage(
      'the snapshot of the third poll',
      (message) =>
        message.type === 'dataSnapshot' && message.snapshot?.receivedAtMs === thirdPollAtMs,
    );
    await controlPage.waitForMessage('the source turned off', (message) => {
      return message.type === 'slices' && message.slices.dataSources?.[0]?.isEnabled === false;
    });
    await waitUntilTheScreenHasEverythingSentSoFar(renderer);
    await waitUntilTheScreenHasEverythingSentSoFar(monitor);

    // Assert: the operator got the latest snapshot and the source; neither screen got a
    // slice or a group of slices, nor any slice it does not draw.
    expect(
      lastSnapshotOnTheControlPage,
      'the operator must receive the snapshot the store holds after the third poll',
    ).toEqual({
      type: 'dataSnapshot',
      sourceId: 'simulador-enduro',
      snapshot: runningServer.stateStore.readAllSlices().dataSnapshots[0],
      serverNowMs: expect.any(Number),
    });
    expect(
      listSlicesTheScreenShouldNeverHaveReceived(renderer),
      'no message to a renderer may carry a slice a screen does not draw',
    ).toEqual([]);
    expect(
      listSlicesTheScreenShouldNeverHaveReceived(monitor),
      'no message to a monitor may carry a slice a screen does not draw',
    ).toEqual([]);
    expect(
      renderer.readReceivedMessages().filter(isSliceOrGroupOfSlices),
      'the renderer must get no message for a source turned on, polled and turned off',
    ).toEqual([]);
    expect(
      monitor.readReceivedMessages().filter(isSliceOrGroupOfSlices),
      'the monitor must get no message for a source turned on, polled and turned off',
    ).toEqual([]);
  });
});

describe('a take from the control page', () => {
  it('reaches a renderer and a monitor as the instances slice alone, in one slice message', async () => {
    // Arrange: a running server with the race clock prepared as a button of "Atalhos"
    // (its take changes the instances and the event log), and the three pages connected.
    const runningServer = await startServerOnARandomPort();
    const takeOfTheClockItem = prepareTheTakeOfTheClockItem(runningServer.stateStore);
    const { client: controlPage } = await connectAndWaitForHello(runningServer.port);
    const { client: renderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
    });
    const { client: monitor } = await connectAndWaitForHello(runningServer.port, {
      role: 'monitor',
    });

    // Act: the operator takes the race clock and the screens catch up.
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-relogio',
      command: takeOfTheClockItem,
    });
    await controlPage.waitForMessage(
      'the answer to the take',
      (message) => message.type === 'commandResult' && message.requestId === 'pedido-relogio',
    );
    await waitUntilTheScreenHasEverythingSentSoFar(renderer);
    await waitUntilTheScreenHasEverythingSentSoFar(monitor);

    // Assert: each screen got exactly one message for the take: the instances slice,
    // with the race clock in it and no event-log row beside it.
    const takeAsTheInstancesSlice = {
      type: 'slice',
      name: 'instances',
      slice: runningServer.stateStore.readAllSlices().instances,
      serverNowMs: expect.any(Number),
    };
    expect(
      takeAsTheInstancesSlice.slice.map((instance) => instance.graphicId),
      'the take must have put the race clock on air',
    ).toEqual(['race-clock']);
    expect(
      renderer.readReceivedMessages().filter(isSliceOrGroupOfSlices),
      'the renderer must get the take as the instances slice alone',
    ).toEqual([takeAsTheInstancesSlice]);
    expect(
      monitor.readReceivedMessages().filter(isSliceOrGroupOfSlices),
      'the monitor must get the take as the instances slice alone',
    ).toEqual([takeAsTheInstancesSlice]);
  });
});

describe('a refused command, which changes the event log alone', () => {
  it('sends a renderer and a monitor nothing, while the operator gets the eventLog slice', async () => {
    // Arrange: a running server, the control page, the renderer and the monitor connected.
    const runningServer = await startServerOnARandomPort();
    const { client: controlPage } = await connectAndWaitForHello(runningServer.port);
    const { client: renderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
    });
    const { client: monitor } = await connectAndWaitForHello(runningServer.port, {
      role: 'monitor',
    });

    // Act: the operator clears a layer the server does not have, which is refused.
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-placar',
      command: { type: 'clearLayer', layerId: 'placar' },
    });
    const refusalOnTheControlPage = await controlPage.waitForMessage(
      'the answer to the clear',
      (message) => message.type === 'commandResult' && message.requestId === 'pedido-placar',
    );
    await waitUntilTheScreenHasEverythingSentSoFar(renderer);
    await waitUntilTheScreenHasEverythingSentSoFar(monitor);

    // Assert: the operator heard of the refusal row; neither screen got any slice at all,
    // alone or in a group.
    expect(refusalOnTheControlPage, 'the clear must have been refused').toMatchObject({
      ok: false,
    });
    expect(
      controlPage.readReceivedMessages(),
      'the operator must get the event log with the refusal row',
    ).toContainEqual({
      type: 'slice',
      name: 'eventLog',
      slice: expect.any(Array),
      serverNowMs: expect.any(Number),
    });
    expect(
      renderer.readReceivedMessages().filter(isSliceOrGroupOfSlices),
      'the renderer must get no slice nor group of slices for a change of the event log alone',
    ).toEqual([]);
    expect(
      monitor.readReceivedMessages().filter(isSliceOrGroupOfSlices),
      'the monitor must get no slice nor group of slices for a change of the event log alone',
    ).toEqual([]);
  });
});

describe('a change of the dataSnapshots slice alone', () => {
  it("sends a renderer and a monitor nothing at all, while the operator gets the source's dataSnapshot", async () => {
    // Arrange: a hub whose changes the test can announce, a snapshot stored, and the
    // control page, the renderer and the monitor connected.
    const { port, realStateStore, listenersTheHubRegistered } =
      await startHubWhoseChangesTheTestCanAnnounce();
    recordPollsOfTheSimulatorByHand(realStateStore, [
      buildGoodPollOfTheSimulator(6, firstPollAtMs),
    ]);
    const { client: controlPage } = await connectAndWaitForHello(port);
    const { client: renderer } = await connectAndWaitForHello(port, { role: 'renderer' });
    const { client: monitor } = await connectAndWaitForHello(port, { role: 'monitor' });
    const messagesOfTheRendererBefore = renderer.readReceivedMessages().length;
    const messagesOfTheMonitorBefore = monitor.readReceivedMessages().length;

    // Act: the hub is told that only the simulator's snapshot changed.
    const storedSnapshot = realStateStore.readAllSlices().dataSnapshots[0] ?? null;
    const messagesOfTheControlPageBefore = controlPage.readReceivedMessages().length;
    for (const listener of listenersTheHubRegistered) {
      listener(['dataSnapshots'], realStateStore.readAllSlices(), [
        { sourceId: 'simulador-enduro', snapshot: storedSnapshot },
      ]);
    }
    await controlPage.waitForMessage(
      "the simulator's dataSnapshot",
      (message) => message.type === 'dataSnapshot',
    );
    await waitUntilTheScreenHasEverythingSentSoFar(renderer);
    await waitUntilTheScreenHasEverythingSentSoFar(monitor);

    // Assert: the operator got that one message and no slice; each screen got only the
    // answer to its report (ok for the renderer; NOT_ALLOWED for the monitor, which may
    // report nothing).
    // The monitor's refused report adds an eventLog slice for the operator; it is left out.
    const messagesOfTheChangeOnTheControlPage = controlPage
      .readReceivedMessages()
      .slice(messagesOfTheControlPageBefore)
      .filter((message) => !(message.type === 'slice' && message.name === 'eventLog'));
    expect(
      messagesOfTheChangeOnTheControlPage,
      "the operator must get the simulator's snapshot alone, with no slice and no empty group",
    ).toEqual([
      {
        type: 'dataSnapshot',
        sourceId: 'simulador-enduro',
        snapshot: storedSnapshot,
        serverNowMs: expect.any(Number),
      },
    ]);
    expect(
      renderer.readReceivedMessages().slice(messagesOfTheRendererBefore),
      'the renderer must get no message for the change, not even an empty group',
    ).toEqual([{ type: 'commandResult', requestId: null, ok: true }]);
    expect(
      monitor.readReceivedMessages().slice(messagesOfTheMonitorBefore),
      'the monitor must get no message for the change, not even an empty group',
    ).toEqual([
      {
        type: 'commandResult',
        requestId: null,
        ok: false,
        error: {
          code: 'NOT_ALLOWED',
          message: 'Você não tem permissão para executar este comando.',
        },
      },
    ]);
  });
});
