/**
 * Saving a command's outcome in one transaction (apps/server)
 *
 * What this module is for:
 *   After a command, the store saves the slices it changed, the rows of the data
 *   snapshots it changed (one per source) and its event-log row. All are written in one
 *   SQLite transaction, so a crash or a failed write can never leave the slices saying
 *   one thing and the event log another.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - The changed slices, a source's snapshot row and the event-log row are all saved,
 *     and the row's id is returned.
 *   - When the event-log write fails, neither the slices nor the snapshot row is saved.
 *   - Each new event-log row gets a larger id than the one before, so ids give the order.
 *
 * What these tests deliberately do not cover:
 *   - Deciding what to save; the store does that (createStateStore.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { saveCommandOutcome } from './commandOutcomeStorage.js';
import {
  buildNoDataSnapshotRowChanges,
  readAllDataSnapshotRows,
} from './dataSnapshotRowStorage.js';
import { readNewestEventLogRows } from './eventLogRowStorage.js';
import { readAllSliceRows } from './sliceRowStorage.js';
import { openTemporaryDatabase } from './temporaryDatabase.testSupport.js';

const savedAt = '2026-10-09T14:32:05.000Z';

const raceClockInstances = [
  {
    id: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: { sessionName: 'Enduro de Resistência', state: 'green' },
    currentStep: 0,
    status: 'loading',
    takenAt: savedAt,
    itemId: 'item-largada-do-enduro',
  },
];

/** Builds the snapshot row of the seeded simulator after one good poll of the enduro. */
function buildEnduroSimulatorSnapshotRow() {
  const receivedAtMs = Date.parse(savedAt);
  return {
    sourceId: 'simulador-enduro',
    json: {
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
    updatedAt: savedAt,
  };
}

/** Builds the event-log row of a successful take of the race clock item by the operator. */
function buildRaceClockTakeRow() {
  return {
    ts: savedAt,
    actor: 'operador:conexao-7',
    command: 'takeItem',
    payload: { type: 'takeItem', itemId: 'item-largada-do-enduro' },
    result: { status: 'ok' },
  };
}

describe('saveCommandOutcome', () => {
  it('saves the changed slices, the snapshot row and the event-log row, and returns the row id', () => {
    // Arrange: an empty database.
    const { database } = openTemporaryDatabase();

    // Act: save an outcome that changed the instances slice and the simulator's snapshot
    // (no single command does both today; the storage does not care which command it was).
    const eventLogId = saveCommandOutcome(database, {
      changedSliceRows: [{ name: 'instances', json: raceClockInstances, updatedAt: savedAt }],
      dataSnapshotRowChanges: {
        rowsToWrite: [buildEnduroSimulatorSnapshotRow()],
        sourceIdsToDelete: [],
      },
      eventLogRow: buildRaceClockTakeRow(),
    });

    // Assert: all three are in the database, and the first row has id 1.
    expect(eventLogId, 'the first event-log row must have id 1').toBe(1);
    expect(readAllSliceRows(database), 'the instances slice must be saved').toEqual([
      { name: 'instances', json: raceClockInstances, updatedAt: savedAt },
    ]);
    expect(readAllDataSnapshotRows(database), "the simulator's snapshot row must be saved").toEqual(
      [buildEnduroSimulatorSnapshotRow()],
    );
    expect(readNewestEventLogRows(database, 10), 'the event-log row must be saved').toEqual([
      { id: 1, ...buildRaceClockTakeRow() },
    ]);
  });

  it('saves neither the slices, the snapshot row nor the event-log row when the event-log write fails', () => {
    // Arrange: a database whose event_log table has vanished, as a damaged file might.
    const { database } = openTemporaryDatabase();
    database.$client.exec('DROP TABLE event_log');

    // Act: try to save a take.
    const saveTheTake = () =>
      saveCommandOutcome(database, {
        changedSliceRows: [{ name: 'instances', json: raceClockInstances, updatedAt: savedAt }],
        dataSnapshotRowChanges: {
          rowsToWrite: [buildEnduroSimulatorSnapshotRow()],
          sourceIdsToDelete: [],
        },
        eventLogRow: buildRaceClockTakeRow(),
      });

    // Assert: the save throws and the instances slice and the snapshot row were rolled back.
    expect(saveTheTake, 'a failed event-log write must fail the whole save').toThrow();
    expect(readAllSliceRows(database), 'the slices must not be saved without their row').toEqual(
      [],
    );
    expect(
      readAllDataSnapshotRows(database),
      'the snapshot row must not be saved without its event-log row',
    ).toEqual([]);
  });

  it('gives each new event-log row a larger id than the one before', () => {
    // Arrange: an empty database.
    const { database } = openTemporaryDatabase();

    // Act: save three outcomes one after the other.
    const savedIds = [1, 2, 3].map(() =>
      saveCommandOutcome(database, {
        changedSliceRows: [],
        dataSnapshotRowChanges: buildNoDataSnapshotRowChanges(),
        eventLogRow: buildRaceClockTakeRow(),
      }),
    );

    // Assert: the ids go up, so they give the order the commands ran in.
    expect(savedIds, 'event-log ids must increase with every row').toEqual([1, 2, 3]);
  });
});
