/**
 * What a renderer connection is never sent: the data snapshots (apps/server)
 *
 * What this module is for:
 *   The data sources' latest answers (the `dataSnapshots` slice: 60 cars of positions,
 *   the standings, the session) change every two seconds per source. The renderer page
 *   in OBS never reads them: graphics receive resolved data only (architecture rule 3),
 *   and parsing a 60-car list every two seconds is a frame-drop risk there. So the hub
 *   keeps that slice from every `/ws?role=renderer` connection, while operator
 *   connections (the control page and its monitors) receive it as before.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - An operator's hello carries the stored snapshot; a renderer's hello carries an
 *     empty `dataSnapshots` list, on purpose, not because there is no data.
 *   - Polls recorded while both are connected reach the operator with `dataSnapshots`,
 *     and no message the renderer receives carries `dataSnapshots` at all.
 *   - A routine poll (it changes the source and its snapshot, not the event log) sends
 *     the renderer the `dataSources` slice alone, as a single `slice` message.
 *   - A change of `dataSnapshots` alone sends the renderer nothing, not an empty group
 *     (with a real hub and store, the change handed to the hub by the test, because no
 *     command changes that slice alone today).
 *
 * What these tests deliberately do not cover:
 *   - The control page's program and preview monitors: they connect without a role, so
 *     they are operator connections and still receive snapshots (a known limit).
 *   - GET /api/v1/state, the renderer's fallback for a hello, which still returns every
 *     slice; stateRoute tests cover that route.
 *   - The poller itself: the source is turned on, polled by hand and turned off within
 *     one tick, so the poller's first poll (armed on a 0 ms timer) never runs.
 *     modules/dataSources/poller.test.ts covers the poller.
 */
import type {
  DataSource,
  RecordDataSourcePollCommand,
  ServerMessage,
  SessionShape,
  SliceName,
} from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildDataSourcePollerActor } from '../store/commandActors.js';
import type { StateStore } from '../store/createStateStore.js';
import { startServerOnARandomPort } from './webSocketHubOnARandomPort.testSupport.js';
import {
  connectAndWaitForHello,
  startHubWhoseChangesTheTestCanAnnounce,
  waitUntilTheRendererHasEverythingSentSoFar,
} from './webSocketHubWithAnnouncedChanges.testSupport.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
// The seeded "Simulador — Enduro", which every new database has, turned off.
const enduroSimulatorId = 'simulador-enduro';
const enduroSimulatorPollerActor = buildDataSourcePollerActor(enduroSimulatorId);
// The enduro of 14 August 2027, polled two seconds apart.
const firstPollAtMs = Date.parse('2027-08-14T14:00:02.000Z');
const secondPollAtMs = Date.parse('2027-08-14T14:00:04.000Z');
const thirdPollAtMs = Date.parse('2027-08-14T14:00:06.000Z');

/** Builds the enduro session with the given number of laps done by the leader. */
function buildEnduroSessionWithLeaderLaps(
  lapsCompletedByLeader: number,
  updatedAtMs: number,
): SessionShape {
  return {
    sessionId: 'enduro-2027-nacional',
    eventName: 'Baja SAE Brasil 2027 — Etapa Nacional',
    sessionName: 'Enduro de Resistência',
    sessionKind: 'enduro',
    state: 'green',
    clock: {
      clockMode: 'remaining',
      referenceTimeMs: 12_475_000,
      referenceWallClockMs: updatedAtMs,
      running: true,
    },
    scheduledDurationMs: 14_400_000,
    lapsCompletedByLeader,
    updatedAtMs,
  };
}

/** The poller's good poll of the simulator: the session after some laps, at a moment. */
function buildGoodPollOfTheSimulator(
  lapsCompletedByLeader: number,
  receivedAtMs: number,
): RecordDataSourcePollCommand {
  return {
    type: 'recordDataSourcePoll',
    sourceId: enduroSimulatorId,
    result: {
      ok: true,
      shapes: { session: buildEnduroSessionWithLeaderLaps(lapsCompletedByLeader, receivedAtMs) },
      receivedAtMs,
    },
  };
}

/**
 * Turns the simulator on, records the given polls by hand and turns it off again, all
 * within one tick: the poller's first poll waits on a 0 ms timer, and turning the source
 * off calls that timer off, so the only polls recorded are these. The snapshot stays.
 */
function recordPollsOfTheSimulatorByHand(
  stateStore: StateStore,
  polls: RecordDataSourcePollCommand[],
): void {
  stateStore.applyCommand(
    { type: 'setDataSourceEnabled', sourceId: enduroSimulatorId, isEnabled: true },
    operatorActor,
  );
  for (const poll of polls) {
    stateStore.applyCommand(poll, enduroSimulatorPollerActor);
  }
  stateStore.applyCommand(
    { type: 'setDataSourceEnabled', sourceId: enduroSimulatorId, isEnabled: false },
    operatorActor,
  );
}

/** True for any message that carries the dataSnapshots slice, in whatever form. */
function carriesDataSnapshots(message: ServerMessage): boolean {
  if (message.type === 'hello') {
    return message.slices.dataSnapshots.length > 0;
  }
  if (message.type === 'slices') {
    return message.slices.dataSnapshots !== undefined;
  }
  if (message.type === 'slice') {
    return message.name === 'dataSnapshots';
  }
  return false;
}

describe('the hello of a connection', () => {
  it('gives an operator the stored snapshot and a renderer an empty dataSnapshots list', async () => {
    // Arrange: a running server whose simulator was polled once before anyone connected.
    const runningServer = await startServerOnARandomPort();
    recordPollsOfTheSimulatorByHand(runningServer.stateStore, [
      buildGoodPollOfTheSimulator(6, firstPollAtMs),
    ]);
    const storedSnapshots = runningServer.stateStore.readAllSlices().dataSnapshots;

    // Act: the control page and the renderer connect.
    const { hello: helloOfTheOperator } = await connectAndWaitForHello(runningServer.port);
    const { hello: helloOfTheRenderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
    });

    // Assert: the operator hello has the snapshot, the renderer's an empty list, the rest equal.
    const slicesOnTheServer = runningServer.stateStore.readAllSlices();
    expect(storedSnapshots, 'the poll must have stored one snapshot').toHaveLength(1);
    expect(helloOfTheOperator, 'the operator hello must carry the stored snapshot').toEqual({
      type: 'hello',
      slices: slicesOnTheServer,
      serverNowMs: expect.any(Number),
    });
    expect(helloOfTheRenderer, 'the renderer hello must carry no snapshot at all').toEqual({
      type: 'hello',
      slices: { ...slicesOnTheServer, dataSnapshots: [] },
      serverNowMs: expect.any(Number),
    });
  });
});

describe('polls recorded while an operator and a renderer are connected', () => {
  it('reach the operator with dataSnapshots and never put dataSnapshots in a renderer message', async () => {
    // Arrange: a running server, the control page and the renderer connected.
    const runningServer = await startServerOnARandomPort();
    const { client: controlPage } = await connectAndWaitForHello(runningServer.port);
    const { client: renderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
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
        message.type === 'slices' &&
        message.slices.dataSnapshots?.[0]?.receivedAtMs === thirdPollAtMs,
    );
    await waitUntilTheRendererHasEverythingSentSoFar(renderer);

    // Assert: the operator got the latest snapshot; no renderer message carries one.
    expect(
      lastSnapshotOnTheControlPage,
      'the operator must receive the snapshot the store holds after the third poll',
    ).toMatchObject({
      type: 'slices',
      slices: { dataSnapshots: runningServer.stateStore.readAllSlices().dataSnapshots },
    });
    const messagesOfTheRenderer = renderer.readReceivedMessages();
    expect(
      messagesOfTheRenderer.filter(carriesDataSnapshots),
      'no message to a renderer may carry dataSnapshots',
    ).toEqual([]);
    expect(
      messagesOfTheRenderer.some(
        (message) => message.type === 'slices' && message.slices.dataSources !== undefined,
      ),
      'the renderer must still hear that the source was turned on and off',
    ).toBe(true);
  });

  it('send a renderer just the dataSources slice, as a slice message, for a routine poll', async () => {
    // Arrange: a running server, the control page and the renderer connected.
    const runningServer = await startServerOnARandomPort();
    const { client: controlPage } = await connectAndWaitForHello(runningServer.port);
    const { client: renderer } = await connectAndWaitForHello(runningServer.port, {
      role: 'renderer',
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
    await waitUntilTheRendererHasEverythingSentSoFar(renderer);

    // Assert: the operator got the source and snapshot, the renderer one `slice` of the source.
    const routinePollChange = changesTheStoreAnnounced[2];
    expect(
      routinePollChange?.names,
      'the second poll must be routine: the source and its snapshot, no event-log row',
    ).toEqual(['dataSources', 'dataSnapshots']);
    expect(
      controlPage.readReceivedMessages(),
      'the operator must get the routine poll as the source and the snapshot together',
    ).toContainEqual({
      type: 'slices',
      slices: {
        dataSources: routinePollChange?.dataSources,
        dataSnapshots: runningServer.stateStore.readAllSlices().dataSnapshots,
      },
      serverNowMs: expect.any(Number),
    });
    expect(
      renderer.readReceivedMessages(),
      'the renderer must get the routine poll as the dataSources slice alone',
    ).toContainEqual({
      type: 'slice',
      name: 'dataSources',
      slice: routinePollChange?.dataSources,
      serverNowMs: expect.any(Number),
    });
  });
});

describe('a change of the dataSnapshots slice alone', () => {
  it('sends a renderer nothing at all, while the operator gets the slice', async () => {
    // Arrange: a hub whose changes the test can announce, a snapshot stored, and the
    // control page and the renderer connected.
    const { port, realStateStore, listenersTheHubRegistered } =
      await startHubWhoseChangesTheTestCanAnnounce();
    recordPollsOfTheSimulatorByHand(realStateStore, [
      buildGoodPollOfTheSimulator(6, firstPollAtMs),
    ]);
    const { client: controlPage } = await connectAndWaitForHello(port);
    const { client: renderer } = await connectAndWaitForHello(port, { role: 'renderer' });
    const messagesOfTheRendererBefore = renderer.readReceivedMessages().length;

    // Act: the hub is told that only the snapshots changed.
    for (const listener of listenersTheHubRegistered) {
      listener(['dataSnapshots'], realStateStore.readAllSlices());
    }
    const sliceOnTheControlPage = await controlPage.waitForMessage(
      'the dataSnapshots slice',
      (message) => message.type === 'slice' && message.name === 'dataSnapshots',
    );
    await waitUntilTheRendererHasEverythingSentSoFar(renderer);

    // Assert: the operator got the slice; the renderer got only the answer to its report.
    expect(sliceOnTheControlPage, 'the operator must get the snapshots the store holds').toEqual({
      type: 'slice',
      name: 'dataSnapshots',
      slice: realStateStore.readAllSlices().dataSnapshots,
      serverNowMs: expect.any(Number),
    });
    expect(
      renderer.readReceivedMessages().slice(messagesOfTheRendererBefore),
      'the renderer must get no message for the change, not even an empty group',
    ).toEqual([{ type: 'commandResult', requestId: null, ok: true }]);
  });
});
