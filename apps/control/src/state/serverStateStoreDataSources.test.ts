/**
 * Server state store: the data-source slices (apps/control)
 *
 * What this module is for:
 *   BAJAOVRLAY-17 adds three slices the control page mirrors like every other one:
 *   `dataSources` (the sources and their health), `dataSnapshots` (the last good data of
 *   each) and `recordings` (the recorded feeds a replay can play). The store's
 *   replaceOneSlice has one case per slice name written out, so each new name needs its
 *   own case, or its messages would be dropped without a word.
 *
 * What these tests prove:
 *   - A new store starts with the three slices empty.
 *   - A slice message for each of the three replaces exactly that slice and leaves the
 *     others alone.
 *
 * What these tests deliberately do not cover:
 *   - Hello and grouped messages, which are generic over every slice name;
 *     serverStateStore.test.ts covers them.
 */
import type { SliceMessage } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

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

/** Builds the slice message of the simulator's last data: the enduro under green flag. */
function buildDataSnapshotsMessage(): SliceMessage {
  const receivedAtMs = Date.parse('2027-08-14T14:32:05.000Z');
  return {
    type: 'slice',
    name: 'dataSnapshots',
    slice: [
      {
        sourceId: 'simulador-enduro',
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
            updatedAtMs: receivedAtMs,
          },
        },
      },
    ],
  };
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
    // A good poll: the source's new data.
    { name: 'replaces the dataSnapshots slice', message: buildDataSnapshotsMessage() },
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
