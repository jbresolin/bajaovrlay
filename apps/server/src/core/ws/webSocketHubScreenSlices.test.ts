/**
 * What a screen connection is never sent: the data snapshots and the event log (apps/server)
 *
 * What this module is for:
 *   A screen connection is a renderer page: the one OBS loads (`/ws?role=renderer`) or a
 *   copy the control page frames as its "Programa" or "Prévia" monitor
 *   (`/ws?role=monitor`). None of them reads the data sources' latest answers (the
 *   `dataSnapshots` slice: 60 cars of positions, the standings, the session, every two
 *   seconds per source) or the operator's history (the `eventLog` slice): graphics
 *   receive resolved data only (architecture rule 3), and parsing either on every change
 *   is a frame-drop risk in OBS. So the hub keeps both slices from every screen
 *   connection, and the `dataSnapshot` message (one source's change, BAJAOVRLAY-40) as
 *   well, while operator connections (the control page itself) receive them all.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - An operator's hello carries the stored snapshot and the event log; the hello of a
 *     renderer and of a monitor carries both as empty lists, on purpose, not because
 *     there is no data.
 *   - Polls recorded while all three are connected reach the operator as `dataSnapshot`
 *     messages, and no message the renderer or the monitor receives is a `dataSnapshot`
 *     or carries `dataSnapshots` or `eventLog` at all, while both still hear the source
 *     change.
 *   - A routine poll (it changes the source and its snapshot, not the event log) sends
 *     the operator the source's `dataSnapshot` and then the `dataSources` slice, and a
 *     renderer and a monitor the `dataSources` slice alone, as a single `slice` message.
 *   - A refused command (it changes the event log alone) sends a renderer and a monitor
 *     nothing, while the operator gets the `eventLog` slice.
 *   - A change of `dataSnapshots` alone sends the operator the one `dataSnapshot` message
 *     and a renderer and a monitor nothing, not an empty group (with a real hub and
 *     store, the change handed to the hub by the test, because no command changes that
 *     slice alone today).
 *
 * What these tests deliberately do not cover:
 *   - GET /api/v1/state, the renderer's fallback for a hello, which applies the same
 *     filter when asked with `?role=`; api/v1/stateRoute.test.ts covers it.
 *   - How a connection gets its role, and what a monitor may send; connectionActor.test.ts,
 *     webSocketHubRoles.test.ts and store/authorizeMonitorCommands.test.ts cover those.
 *   - The poller itself: the source is turned on, polled by hand and turned off within
 *     one tick, so the poller's first poll (armed on a 0 ms timer) never runs.
 *     modules/dataSources/poller.test.ts covers the poller.
 */
import type { DataSource, ServerMessage, SliceName } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildGoodPollOfTheSimulator,
  firstPollAtMs,
  recordPollsOfTheSimulatorByHand,
  secondPollAtMs,
  thirdPollAtMs,
} from './simulatorPolledByHand.testSupport.js';
import { startServerOnARandomPort } from './webSocketHubOnARandomPort.testSupport.js';
import {
  connectAndWaitForHello,
  startHubWhoseChangesTheTestCanAnnounce,
  waitUntilTheScreenHasEverythingSentSoFar,
} from './webSocketHubWithAnnouncedChanges.testSupport.js';
import type { WebSocketTestClient } from './webSocketTestClient.testSupport.js';

/**
 * True for any message that carries the named slice, in whatever form: a `dataSnapshot`
 * message carries part of `dataSnapshots`. A `slices` group is checked by its keys, so a
 * `dataSnapshots` key would be caught even though the schema no longer has one.
 */
function carriesSlice(message: ServerMessage, sliceName: 'dataSnapshots' | 'eventLog'): boolean {
  if (message.type === 'hello') {
    return message.slices[sliceName].length > 0;
  }
  if (message.type === 'slices') {
    return Object.keys(message.slices).includes(sliceName);
  }
  if (message.type === 'slice') {
    return message.name === sliceName;
  }
  if (message.type === 'dataSnapshot') {
    return sliceName === 'dataSnapshots';
  }
  return false;
}

/** The messages a screen received that carry race data or the operator's history. */
function findMessagesWithHiddenSlices(screen: WebSocketTestClient): ServerMessage[] {
  return screen.readReceivedMessages().filter((message) => {
    return carriesSlice(message, 'dataSnapshots') || carriesSlice(message, 'eventLog');
  });
}

/** True for a `slice` or `slices` message that carries the dataSources slice. */
function carriesDataSources(message: ServerMessage): boolean {
  if (message.type === 'slices') {
    return message.slices.dataSources !== undefined;
  }
  return message.type === 'slice' && message.name === 'dataSources';
}

describe('the hello of a connection', () => {
  it('gives an operator the snapshot and the event log, and a renderer and a monitor empty lists of both', async () => {
    // Arrange: a running server whose simulator was turned on, polled once and turned off
    // before anyone connected, so both a snapshot and event-log rows are stored.
    const runningServer = await startServerOnARandomPort();
    recordPollsOfTheSimulatorByHand(runningServer.stateStore, [
      buildGoodPollOfTheSimulator(6, firstPollAtMs),
    ]);
    const slicesOnTheServer = runningServer.stateStore.readAllSlices();

    // Act: the control page, the renderer OBS loads and the "Programa" monitor connect.
    const { hello: helloOfTheOperator } = await connectAndWaitForHello(runningServer.port);
    const { hello: helloOfTheRenderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
    });
    const { hello: helloOfTheMonitor } = await connectAndWaitForHello(runningServer.port, {
      role: 'monitor',
    });

    // Assert: the operator hello has everything; the two screens get both slices empty.
    expect(slicesOnTheServer.dataSnapshots, 'the poll must have stored one snapshot').toHaveLength(
      1,
    );
    expect(
      slicesOnTheServer.eventLog.length,
      'turning the source on and off must have written rows',
    ).toBeGreaterThan(0);
    expect(helloOfTheOperator, 'the operator hello must carry every slice').toEqual({
      type: 'hello',
      slices: slicesOnTheServer,
      serverNowMs: expect.any(Number),
    });
    expect(helloOfTheRenderer, 'the renderer hello must carry no snapshot and no history').toEqual({
      type: 'hello',
      slices: { ...slicesOnTheServer, dataSnapshots: [], eventLog: [] },
      serverNowMs: expect.any(Number),
    });
    expect(helloOfTheMonitor, 'the monitor hello must carry no snapshot and no history').toEqual({
      type: 'hello',
      slices: { ...slicesOnTheServer, dataSnapshots: [], eventLog: [] },
      serverNowMs: expect.any(Number),
    });
  });
});

describe('polls recorded while an operator, a renderer and a monitor are connected', () => {
  it('reach the operator as dataSnapshot messages and never put snapshots or eventLog in a screen message', async () => {
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
    await waitUntilTheScreenHasEverythingSentSoFar(renderer);
    await waitUntilTheScreenHasEverythingSentSoFar(monitor);

    // Assert: the operator got the latest snapshot; no screen message carries a hidden
    // slice, and both screens still heard the source being turned on and off.
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
      findMessagesWithHiddenSlices(renderer),
      'no message to a renderer may carry dataSnapshots or eventLog',
    ).toEqual([]);
    expect(
      findMessagesWithHiddenSlices(monitor),
      'no message to a monitor may carry dataSnapshots or eventLog',
    ).toEqual([]);
    expect(
      renderer.readReceivedMessages().some(carriesDataSources),
      'the renderer must still hear that the source was turned on and off',
    ).toBe(true);
    expect(
      monitor.readReceivedMessages().some(carriesDataSources),
      'the monitor must still hear that the source was turned on and off',
    ).toBe(true);
  });

  it('send a renderer and a monitor just the dataSources slice, as a slice message, for a routine poll', async () => {
    // Arrange: a running server, the control page, the renderer and the monitor connected.
    const runningServer = await startServerOnARandomPort();
    const { client: controlPage } = await connectAndWaitForHello(runningServer.port);
    const { client: renderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
    });
    const { client: monitor } = await connectAndWaitForHello(runningServer.port, {
      role: 'monitor',
    });
    // The store's changes are noted; four come: turned on, first poll, second poll, off.
    const changesTheStoreAnnounced: { names: SliceName[]; dataSources: DataSource[] }[] = [];
    runningServer.stateStore.subscribeToSliceChanges((names, slices) => {
      changesTheStoreAnnounced.push({ names, dataSources: slices.dataSources });
    });

    // Act: the simulator is turned on, polled twice (the second poll is routine) and turned off.
    recordPollsOfTheSimulatorByHand(runningServer.stateStore, [
      buildGoodPollOfTheSimulator(6, firstPollAtMs),
      buildGoodPollOfTheSimulator(7, secondPollAtMs),
    ]);
    await controlPage.waitForMessage('the source turned off', (message) => {
      return message.type === 'slices' && message.slices.dataSources?.[0]?.isEnabled === false;
    });
    await waitUntilTheScreenHasEverythingSentSoFar(renderer);
    await waitUntilTheScreenHasEverythingSentSoFar(monitor);

    // Assert: the operator got the source and snapshot, each screen one `slice` of the source.
    const routinePollChange = changesTheStoreAnnounced[2];
    const routinePollAsASliceOfTheSource = {
      type: 'slice',
      name: 'dataSources',
      slice: routinePollChange?.dataSources,
      serverNowMs: expect.any(Number),
    };
    expect(
      routinePollChange?.names,
      'the second poll must be routine: the source and its snapshot, no event-log row',
    ).toEqual(['dataSources', 'dataSnapshots']);
    const messagesOfTheControlPage = controlPage.readReceivedMessages();
    const routineSnapshotPlace = messagesOfTheControlPage.findIndex(
      (message) =>
        message.type === 'dataSnapshot' && message.snapshot?.receivedAtMs === secondPollAtMs,
    );
    expect(
      messagesOfTheControlPage.slice(routineSnapshotPlace, routineSnapshotPlace + 2),
      "the operator must get the routine poll as the source's snapshot, then the source",
    ).toEqual([
      {
        type: 'dataSnapshot',
        sourceId: 'simulador-enduro',
        snapshot: runningServer.stateStore.readAllSlices().dataSnapshots[0],
        serverNowMs: expect.any(Number),
      },
      routinePollAsASliceOfTheSource,
    ]);
    expect(
      renderer.readReceivedMessages(),
      'the renderer must get the routine poll as the dataSources slice alone',
    ).toContainEqual(routinePollAsASliceOfTheSource);
    expect(
      monitor.readReceivedMessages(),
      'the monitor must get the routine poll as the dataSources slice alone',
    ).toContainEqual(routinePollAsASliceOfTheSource);
  });
});

/** Whether a message carries slices: one `slice`, or a `slices` group. */
function isSliceOrGroupOfSlices(message: ServerMessage): boolean {
  return message.type === 'slice' || message.type === 'slices';
}

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
