/**
 * Server state store: the data-source slices (apps/control)
 *
 * What this module is for:
 *   BAJAOVRLAY-17 adds three slices the control page mirrors: `dataSources` (the sources
 *   and their health), `dataSnapshots` (the last good data of each) and `recordings`
 *   (the recorded feeds a replay can play). Two of them come whole in `slice` messages;
 *   the store's replaceOneSlice has one case per slice name written out, so each new
 *   name needs its own case, or its messages would be dropped without a word. Since
 *   BAJAOVRLAY-40 the snapshots come whole only in the hello, then one source at a time
 *   in `dataSnapshot` messages, which the store merges into its list by `sourceId`.
 *
 * What these tests prove:
 *   - A new store starts with the three slices empty.
 *   - A slice message for `dataSources` and for `recordings` replaces exactly that slice
 *     and leaves the others alone.
 *   - A dataSnapshot message replaces its source's entry in place, adds a new source at
 *     the end, removes the source on null, and leaves every other source's entry as the
 *     very same object; a null for a source the page does not have changes nothing.
 *   - The connection hands a dataSnapshot message from the server to the store.
 *
 * What these tests deliberately do not cover:
 *   - Hello and grouped messages, which are generic over every slice name;
 *     serverStateStore.test.ts covers them.
 *   - When the server sends a dataSnapshot; apps/server's webSocketHub tests.
 */
import type { DataSnapshot, DataSnapshotMessage, SliceMessage } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { connectControlPageToFakeServerThatSaidHello } from './connectionToFakeServer.testSupport';
import { createServerStateStore } from './serverStateStore';
import { buildSlicesWithNothingOnAir } from './slicesLikeTheServerSends.testSupport';

/** Builds the slice message of the seeded simulator, off. */
function buildDataSourcesMessage(): SliceMessage {
  return {
    type: 'slice',
    name: 'dataSources',
    slice: [
      {
        id: 'simulador-enduro',
        label: 'Simulador — Enduro',
        kind: 'simulator',
        config: {
          seed: 2027,
          carCount: 60,
          sessionDurationMs: 14_400_000,
          lapLengthKm: 2,
          speed: 1,
          isFailing: false,
        },
        pollIntervalMs: 2_000,
        isEnabled: false,
        isRecording: false,
        status: {
          lastError: null,
          consecutiveFailures: 0,
          isStale: false,
          staleAfterMs: 6_000,
          recordingError: null,
        },
      },
    ],
  };
}

/**
 * Builds a source's last data: the enduro under green flag, as that source received it
 * at a moment, with the leader's laps so far.
 */
function buildEnduroSnapshotOfSource(
  sourceId: string,
  receivedAtMs: number,
  lapsCompletedByLeader: number,
): DataSnapshot {
  return {
    sourceId,
    receivedAtMs,
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
  };
}

const firstPollAtMs = Date.parse('2027-08-14T14:32:05.000Z');
const secondPollAtMs = Date.parse('2027-08-14T14:32:07.000Z');

/** Builds the dataSnapshot message of a source: its new snapshot, or null when deleted. */
function buildDataSnapshotMessage(
  sourceId: string,
  snapshot: DataSnapshot | null,
): DataSnapshotMessage {
  return { type: 'dataSnapshot', sourceId, snapshot, serverNowMs: secondPollAtMs + 4 };
}

/** Builds the slice message of Friday's closed recording. */
function buildRecordingsMessage(): SliceMessage {
  return {
    type: 'slice',
    name: 'recordings',
    slice: [
      {
        id: 'simulador-enduro/2027-08-13T13-00-00.000Z.jsonl',
        sourceId: 'simulador-enduro',
        sourceLabel: 'Simulador — Enduro',
        fileName: '2027-08-13T13-00-00.000Z.jsonl',
        startedAtMs: Date.parse('2027-08-13T13:00:00.000Z'),
        endedAtMs: Date.parse('2027-08-13T14:00:00.000Z'),
        snapshotCount: 1_800,
      },
    ],
  };
}

describe('the data-source slices in a new store', () => {
  it('start empty', () => {
    // Arrange: nothing to prepare.

    // Act: build the store, as the page does when it opens.
    const state = createServerStateStore().getState();

    // Assert: no source, no data, no recording before the server says hello.
    expect(state.dataSources, 'no source is known before the hello').toEqual([]);
    expect(state.dataSnapshots, 'no data is known before the hello').toEqual([]);
    expect(state.recordings, 'no recording is known before the hello').toEqual([]);
  });
});

describe('a slice message for a data-source slice', () => {
  const sliceMessageScenarios = [
    // The switch, a poll's health, an edit: the list of sources.
    { name: 'replaces the dataSources slice', message: buildDataSourcesMessage() },
    // "Gravar" and "Parar gravação": the list of recordings.
    { name: 'replaces the recordings slice', message: buildRecordingsMessage() },
  ];

  it.each(sliceMessageScenarios)('$name', ({ message }) => {
    // Arrange: a store that has had its hello.
    const serverStateStore = createServerStateStore();
    serverStateStore.getState().replaceEverySlice(buildSlicesWithNothingOnAir());
    const layersBeforeTheMessage = serverStateStore.getState().layers;

    // Act: the slice message of this row arrives.
    serverStateStore.getState().replaceOneSlice(message);

    // Assert: that slice is what the server sent; the layers untouched.
    const state = serverStateStore.getState();
    expect(state[message.name], 'the slice must be exactly what the server sent').toEqual(
      message.slice,
    );
    expect(state.layers, 'a data-source message must not touch the layers').toBe(
      layersBeforeTheMessage,
    );
  });
});

describe('a dataSnapshot message', () => {
  // The page holds, from its hello, the enduro simulator's data and the training one's.
  const enduroAtTheHello = buildEnduroSnapshotOfSource('simulador-enduro', firstPollAtMs, 33);
  const trainingAtTheHello = buildEnduroSnapshotOfSource('simulador-treino', firstPollAtMs, 12);
  const enduroAfterThePoll = buildEnduroSnapshotOfSource('simulador-enduro', secondPollAtMs, 34);
  const replayAfterThePoll = buildEnduroSnapshotOfSource('reproducao-sexta', secondPollAtMs, 5);

  const mergeScenarios = [
    // A good poll of a source the page has: its entry is replaced where it stands.
    {
      name: "replaces the enduro's entry in place after its poll",
      message: buildDataSnapshotMessage('simulador-enduro', enduroAfterThePoll),
      expectedSnapshots: [enduroAfterThePoll, trainingAtTheHello],
    },
    // The first good poll of a source with no data yet: it joins at the end.
    {
      name: 'adds the first snapshot of a new source at the end',
      message: buildDataSnapshotMessage('reproducao-sexta', replayAfterThePoll),
      expectedSnapshots: [enduroAtTheHello, trainingAtTheHello, replayAfterThePoll],
    },
    // "Excluir": the source and its data are gone.
    {
      name: 'removes the entry of a deleted source on null',
      message: buildDataSnapshotMessage('simulador-enduro', null),
      expectedSnapshots: [trainingAtTheHello],
    },
  ];

  it.each(mergeScenarios)('$name', ({ message, expectedSnapshots }) => {
    // Arrange: a store that has had its hello with both simulators' data.
    const serverStateStore = createServerStateStore();
    serverStateStore.getState().replaceEverySlice({
      ...buildSlicesWithNothingOnAir(),
      dataSnapshots: [enduroAtTheHello, trainingAtTheHello],
    });

    // Act: the dataSnapshot message of this row arrives.
    serverStateStore.getState().mergeOneDataSnapshot(message);

    // Assert: the list is as the row says, and the training source's entry, which the
    // message did not name, is the very object the hello brought (so nothing redraws).
    const snapshotsAfter = serverStateStore.getState().dataSnapshots;
    expect(snapshotsAfter, 'only the named source may change in the list').toEqual(
      expectedSnapshots,
    );
    expect(
      snapshotsAfter.find((snapshot) => snapshot.sourceId === 'simulador-treino'),
      'a source the message does not name must keep its very same entry',
    ).toBe(trainingAtTheHello);
  });

  it('changes nothing on null for a source the page has no data of', () => {
    // Arrange: a store that has had its hello with both simulators' data.
    const serverStateStore = createServerStateStore();
    serverStateStore.getState().replaceEverySlice({
      ...buildSlicesWithNothingOnAir(),
      dataSnapshots: [enduroAtTheHello, trainingAtTheHello],
    });
    const snapshotsBefore = serverStateStore.getState().dataSnapshots;

    // Act: a null arrives for Friday's replay, which never had data.
    serverStateStore
      .getState()
      .mergeOneDataSnapshot(buildDataSnapshotMessage('reproducao-sexta', null));

    // Assert: the very same list, so no component redraws.
    expect(
      serverStateStore.getState().dataSnapshots,
      'a null for an unknown source must leave the very same list',
    ).toBe(snapshotsBefore);
  });

  it('reaches the store when the server sends it over the connection', () => {
    // Arrange: a connected page whose hello had no data yet.
    const { serverStateStore, fakeServerSocket } = connectControlPageToFakeServerThatSaidHello();

    // Act: the server sends the enduro simulator's first snapshot.
    fakeServerSocket.sendMessage(buildDataSnapshotMessage('simulador-enduro', enduroAfterThePoll));

    // Assert: the store now holds that snapshot.
    expect(
      serverStateStore.getState().dataSnapshots,
      'the snapshot the server sent must be in the store',
    ).toEqual([enduroAfterThePoll]);
  });
});
