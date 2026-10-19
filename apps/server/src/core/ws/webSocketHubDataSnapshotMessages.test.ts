/**
 * One `dataSnapshot` message per source whose data changed (apps/server)
 *
 * What this module is for:
 *   A source's last good data is up to 60 cars of positions, polled every two seconds.
 *   Before BAJAOVRLAY-40 every change of it resent the whole `dataSnapshots` slice, every
 *   source's data, to every operator page. Now the hub sends the control page one
 *   `dataSnapshot` message (sourceId, the snapshot or null, serverNowMs) per source whose
 *   snapshot changed, and a `slice` or `slices` message never carries `dataSnapshots`.
 *   The hello still carries the full list.
 *
 * What these tests prove (with a real store on a real SQLite file and a real hub):
 *   - A poll of "Simulador — Enduro" sends the operator the enduro's snapshot alone,
 *     then the `dataSources` slice; the other source's snapshot is not sent again.
 *   - Deleting a source sends a `dataSnapshot` with `snapshot: null` for it, and the
 *     `slices` message of that change has no `dataSnapshots` in it.
 *   - A poll that repeats the stored data on a healthy source sends nothing at all.
 *   - A failed poll sends the source's new health and no `dataSnapshot`: the last good
 *     data stays as the page has it (rule 4).
 *
 * What these tests deliberately do not cover:
 *   - Screens, which never get a `dataSnapshot`; webSocketHubScreenSlices.test.ts.
 *   - The rows written; modules/dataSources/dataSnapshotRows.test.ts.
 *   - The poller; the polls here are sent by hand, on a store with no poller running.
 */
import type { RecordDataSourcePollCommand, ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildDataSourcePollerActor } from '../store/commandActors.js';
import type { StateStore } from '../store/createStateStore.js';
import {
  connectAndWaitForHello,
  startHubWhoseChangesTheTestCanAnnounce,
} from './webSocketHubWithAnnouncedChanges.testSupport.js';
import type { WebSocketTestClient } from './webSocketTestClient.testSupport.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
const enduroSimulatorId = 'simulador-enduro';
const firstPollAtMs = Date.parse('2027-08-14T14:00:02.000Z');
const secondPollAtMs = Date.parse('2027-08-14T14:00:04.000Z');

/** The poller's good poll of a source: the enduro session after some laps, at a moment. */
function buildGoodPollOfSource(
  sourceId: string,
  lapsCompletedByLeader: number,
  receivedAtMs: number,
): RecordDataSourcePollCommand {
  return {
    type: 'recordDataSourcePoll',
    sourceId,
    result: {
      ok: true,
      shapes: {
        session: {
          sessionId: 'enduro-2027-nacional',
          eventName: 'Baja SAE Brasil 2027 — Etapa Nacional',
          sessionName: 'Enduro de Resistência',
          sessionKind: 'enduro',
          state: 'green',
          clock: {
            clockMode: 'remaining',
            referenceTimeMs: 12_475_000,
            referenceWallClockMs: receivedAtMs,
            running: true,
          },
          lapsCompletedByLeader,
          updatedAtMs: receivedAtMs,
        },
      },
      receivedAtMs,
    },
  };
}

/**
 * Makes "Simulador — Treino" next to the seeded enduro, turns both on and polls each well
 * once, all on the store directly; returns the training source's id.
 */
function prepareTwoSimulatorsPolledOnce(stateStore: StateStore): string {
  stateStore.applyCommand(
    {
      type: 'createDataSource',
      label: 'Simulador — Treino',
      kind: 'simulator',
      config: {},
      pollIntervalMs: 2_000,
    },
    operatorActor,
  );
  const trainingSource = stateStore
    .readAllSlices()
    .dataSources.find((source) => source.label === 'Simulador — Treino');
  if (trainingSource === undefined) {
    throw new Error('the training source must have been made');
  }
  for (const sourceId of [enduroSimulatorId, trainingSource.id]) {
    stateStore.applyCommand(
      { type: 'setDataSourceEnabled', sourceId, isEnabled: true },
      operatorActor,
    );
    stateStore.applyCommand(
      buildGoodPollOfSource(sourceId, 6, firstPollAtMs),
      buildDataSourcePollerActor(sourceId),
    );
  }
  return trainingSource.id;
}

/**
 * The operator sends a clear of a layer the server does not have and waits for its
 * refusal: a socket delivers in order, so everything sent before has arrived by then.
 * The refusal itself adds the `eventLog` slice and the commandResult.
 */
async function waitUntilTheOperatorHasEverythingSentSoFar(
  controlPage: WebSocketTestClient,
): Promise<void> {
  controlPage.sendJson({
    type: 'command',
    requestId: 'pedido-placar',
    command: { type: 'clearLayer', layerId: 'placar' },
  });
  await controlPage.waitForMessage(
    'the refusal of the clear',
    (message) => message.type === 'commandResult' && message.requestId === 'pedido-placar',
  );
}

/** The types of the messages, with the slice names a slice or slices message carries. */
function describeMessages(messages: ServerMessage[]): string[] {
  return messages.map((message) => {
    if (message.type === 'slice') {
      return `slice ${message.name}`;
    }
    if (message.type === 'slices') {
      return `slices ${Object.keys(message.slices).join(' ')}`;
    }
    if (message.type === 'dataSnapshot') {
      return `dataSnapshot ${message.sourceId}`;
    }
    return message.type;
  });
}

describe('a good poll of one source', () => {
  it("sends the operator that source's snapshot alone, then the dataSources slice", async () => {
    // Arrange: two simulators polled once each, then the control page connected.
    const { port, realStateStore } = await startHubWhoseChangesTheTestCanAnnounce();
    prepareTwoSimulatorsPolledOnce(realStateStore);
    const { client: controlPage } = await connectAndWaitForHello(port);

    // Act: the enduro alone is polled again, with one more lap.
    realStateStore.applyCommand(
      buildGoodPollOfSource(enduroSimulatorId, 7, secondPollAtMs),
      buildDataSourcePollerActor(enduroSimulatorId),
    );
    await waitUntilTheOperatorHasEverythingSentSoFar(controlPage);

    // Assert: after the hello, the enduro's snapshot and the source list, nothing of the
    // training source; the snapshot is the one the store holds.
    const messagesAfterTheHello = controlPage.readReceivedMessages().slice(1);
    expect(
      describeMessages(messagesAfterTheHello),
      'the poll must send one dataSnapshot for the enduro and then the dataSources slice',
    ).toEqual([
      'dataSnapshot simulador-enduro',
      'slice dataSources',
      'slice eventLog',
      'commandResult',
    ]);
    const enduroSnapshot = realStateStore
      .readAllSlices()
      .dataSnapshots.find((snapshot) => snapshot.sourceId === enduroSimulatorId);
    expect(
      messagesAfterTheHello[0],
      'the message must carry the new snapshot and the clock',
    ).toEqual({
      type: 'dataSnapshot',
      sourceId: enduroSimulatorId,
      snapshot: enduroSnapshot,
      serverNowMs: expect.any(Number),
    });
  });
});

describe('deleting a source', () => {
  it('sends a dataSnapshot with null for it, and a slices message without dataSnapshots', async () => {
    // Arrange: two simulators polled once each, then the control page connected.
    const { port, realStateStore } = await startHubWhoseChangesTheTestCanAnnounce();
    const trainingSourceId = prepareTwoSimulatorsPolledOnce(realStateStore);
    const { client: controlPage } = await connectAndWaitForHello(port);

    // Act: the operator deletes "Simulador — Treino".
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-excluir',
      command: { type: 'deleteDataSource', sourceId: trainingSourceId },
    });
    await controlPage.waitForMessage(
      'the answer to the delete',
      (message) => message.type === 'commandResult' && message.requestId === 'pedido-excluir',
    );

    // Assert: the training source's snapshot goes as null, then the source list and the
    // event log together, with no snapshot list among them.
    const messagesAfterTheHello = controlPage.readReceivedMessages().slice(1);
    expect(
      describeMessages(messagesAfterTheHello),
      'the delete must send the null snapshot first, then the slices without dataSnapshots',
    ).toEqual([`dataSnapshot ${trainingSourceId}`, 'slices dataSources eventLog', 'commandResult']);
    expect(messagesAfterTheHello[0], 'the deleted source must have no snapshot any more').toEqual({
      type: 'dataSnapshot',
      sourceId: trainingSourceId,
      snapshot: null,
      serverNowMs: expect.any(Number),
    });
  });
});

describe('a poll that repeats the stored data on a healthy source', () => {
  it('sends the operator nothing at all', async () => {
    // Arrange: two simulators polled once each, then the control page connected.
    const { port, realStateStore } = await startHubWhoseChangesTheTestCanAnnounce();
    prepareTwoSimulatorsPolledOnce(realStateStore);
    const { client: controlPage } = await connectAndWaitForHello(port);

    // Act: the enduro is polled again with the very same data.
    realStateStore.applyCommand(
      buildGoodPollOfSource(enduroSimulatorId, 6, firstPollAtMs),
      buildDataSourcePollerActor(enduroSimulatorId),
    );
    await waitUntilTheOperatorHasEverythingSentSoFar(controlPage);

    // Assert: only what the operator's own refused clear caused arrived.
    expect(
      describeMessages(controlPage.readReceivedMessages().slice(1)),
      'a no-op poll must send no dataSnapshot and no slice',
    ).toEqual(['slice eventLog', 'commandResult']);
  });
});

describe('a failed poll', () => {
  it("sends the source's new health and no dataSnapshot", async () => {
    // Arrange: two simulators polled once each, then the control page connected.
    const { port, realStateStore } = await startHubWhoseChangesTheTestCanAnnounce();
    prepareTwoSimulatorsPolledOnce(realStateStore);
    const { client: controlPage } = await connectAndWaitForHello(port);

    // Act: the enduro's next poll times out.
    realStateStore.applyCommand(
      {
        type: 'recordDataSourcePoll',
        sourceId: enduroSimulatorId,
        result: { ok: false, error: 'Tempo esgotado', attemptedAtMs: secondPollAtMs },
      },
      buildDataSourcePollerActor(enduroSimulatorId),
    );
    await waitUntilTheOperatorHasEverythingSentSoFar(controlPage);

    // Assert: the source going stale (with its event-log row), and no snapshot message:
    // the page keeps the last good data it has (rule 4).
    expect(
      describeMessages(controlPage.readReceivedMessages().slice(1)),
      'a failed poll must change the source, never its snapshot',
    ).toEqual(['slices dataSources eventLog', 'slice eventLog', 'commandResult']);
  });
});
