/**
 * One snapshot row per source, through the real store (apps/server)
 *
 * What this module is for:
 *   Each source's last good snapshot is saved as its own row of the data_snapshots table
 *   (BAJAOVRLAY-40). Before, every snapshot sat in one `dataSnapshots` row of the slices
 *   table, so a 60-car poll of one source rewrote every other source's data too. Now a
 *   poll of source A writes A's row only, and deleting a source deletes its row only.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - Two simulators polled once each have a row each, and no `dataSnapshots` row is
 *     written in the slices table.
 *   - A later poll of "Simulador — Enduro" rewrites its row and leaves the row of
 *     "Simulador — Treino" exactly as it was, down to its write time.
 *   - Deleting "Simulador — Treino" deletes its row and leaves the enduro's alone.
 *   - A failed poll of the enduro keeps its last good row untouched (rule 4).
 *
 * What these tests deliberately do not cover:
 *   - Reading the rows back at a restart; dataSourceRestart.test.ts covers it.
 *   - The split of the single row an older database has; dataSnapshotRowsAtBoot.test.ts.
 *   - What the WebSocket sends; core/ws/webSocketHubDataSnapshotMessages.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { readAllDataSnapshotRows } from '../../core/db/dataSnapshotRowStorage.js';
import { readAllSliceRows } from '../../core/db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { missingGraphicsFolderPath } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { buildDataSourcePollerActor } from '../../core/store/commandActors.js';
import { createStateStore } from '../../core/store/createStateStore.js';
import { operatorActor, startOfTheEnduroMs } from './enduroSimulatorCommands.testSupport.js';
import { buildGreenFlagSessionAt } from './reducers/dataSourceSlices.testSupport.js';

const enduroSimulatorId = 'simulador-enduro';
const trainingSimulatorId = 'simulador-treino';
const twoSecondsIn = startOfTheEnduroMs + 2_000;
const fourSecondsIn = startOfTheEnduroMs + 4_000;

/**
 * Opens a store on a new SQLite file with a clock the test moves by hand: the seeded
 * "Simulador — Enduro" and a second source, "Simulador — Treino", both turned on at 14:00.
 */
function openStoreWithTwoSimulatorsOn() {
  const { database } = openTemporaryDatabase();
  let momentTheClockShowsMs = startOfTheEnduroMs;
  const stateStore = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: missingGraphicsFolderPath,
    readCurrentTime: () => new Date(momentTheClockShowsMs),
    createDataSourceId: () => trainingSimulatorId,
  });
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
  for (const sourceId of [enduroSimulatorId, trainingSimulatorId]) {
    stateStore.applyCommand(
      { type: 'setDataSourceEnabled', sourceId, isEnabled: true },
      operatorActor,
    );
  }
  return {
    database,
    stateStore,
    moveTheClockTo: (momentMs: number) => {
      momentTheClockShowsMs = momentMs;
    },
  };
}

/** Builds the poller's good poll of a source: the green-flag session at a moment. */
function buildGoodPollOfSourceAt(sourceId: string, receivedAtMs: number) {
  return {
    type: 'recordDataSourcePoll',
    sourceId,
    result: { ok: true, shapes: { session: buildGreenFlagSessionAt(receivedAtMs) }, receivedAtMs },
  };
}

/** The poller of a source sends its good poll at that moment, with the store's clock there. */
function pollSourceWellAt(
  store: ReturnType<typeof openStoreWithTwoSimulatorsOn>,
  sourceId: string,
  receivedAtMs: number,
): void {
  store.moveTheClockTo(receivedAtMs);
  store.stateStore.applyCommand(
    buildGoodPollOfSourceAt(sourceId, receivedAtMs),
    buildDataSourcePollerActor(sourceId),
  );
}

describe('the snapshot rows of two sources', () => {
  it('are one row per source, and the slices table gets no dataSnapshots row', () => {
    // Arrange: both simulators on.
    const store = openStoreWithTwoSimulatorsOn();

    // Act: each is polled well once, two seconds in.
    pollSourceWellAt(store, enduroSimulatorId, twoSecondsIn);
    pollSourceWellAt(store, trainingSimulatorId, twoSecondsIn);

    // Assert: a row each, holding the source's snapshot; no single row of every snapshot.
    expect(
      readAllDataSnapshotRows(store.database).map((row) => row.sourceId),
      'each source must have its own snapshot row',
    ).toEqual([enduroSimulatorId, trainingSimulatorId]);
    expect(
      readAllDataSnapshotRows(store.database)[1]?.json,
      'the training row must hold the training snapshot as the store holds it',
    ).toEqual(store.stateStore.readAllSlices().dataSnapshots[1]);
    expect(
      readAllSliceRows(store.database).map((row) => row.name),
      'the snapshots must no longer be written as one slice row',
    ).not.toContain('dataSnapshots');
  });

  it("rewrite only the enduro's row when the enduro is polled again", () => {
    // Arrange: both simulators polled once, and the training row as it stands.
    const store = openStoreWithTwoSimulatorsOn();
    pollSourceWellAt(store, enduroSimulatorId, twoSecondsIn);
    pollSourceWellAt(store, trainingSimulatorId, twoSecondsIn);
    const trainingRowBefore = readAllDataSnapshotRows(store.database)[1];

    // Act: the enduro alone is polled again, four seconds in, with a newer session.
    pollSourceWellAt(store, enduroSimulatorId, fourSecondsIn);

    // Assert: the enduro's row holds the new poll; the training row is the very same.
    const rowsAfter = readAllDataSnapshotRows(store.database);
    expect(rowsAfter[0], "the enduro's row must hold the new poll, written at its moment").toEqual({
      sourceId: enduroSimulatorId,
      json: {
        sourceId: enduroSimulatorId,
        receivedAtMs: fourSecondsIn,
        shapes: { session: buildGreenFlagSessionAt(fourSecondsIn) },
      },
      updatedAt: new Date(fourSecondsIn).toISOString(),
    });
    expect(
      rowsAfter[1],
      "the training row must not be rewritten by the enduro's poll, not even its write time",
    ).toEqual(trainingRowBefore);
  });

  it("keep the enduro's last good row when its next poll fails", () => {
    // Arrange: the enduro polled well once, and its row as it stands.
    const store = openStoreWithTwoSimulatorsOn();
    pollSourceWellAt(store, enduroSimulatorId, twoSecondsIn);
    const enduroRowBefore = readAllDataSnapshotRows(store.database)[0];

    // Act: the enduro's next poll fails.
    store.moveTheClockTo(fourSecondsIn);
    store.stateStore.applyCommand(
      {
        type: 'recordDataSourcePoll',
        sourceId: enduroSimulatorId,
        result: { ok: false, error: 'Tempo esgotado', attemptedAtMs: fourSecondsIn },
      },
      buildDataSourcePollerActor(enduroSimulatorId),
    );

    // Assert: the last good data stays on disk as it was (rule 4).
    expect(
      readAllDataSnapshotRows(store.database),
      'a failed poll must leave the last good row untouched',
    ).toEqual([enduroRowBefore]);
  });
});

describe('deleting a source', () => {
  it("deletes that source's row and leaves the other source's row alone", () => {
    // Arrange: both simulators polled once, and the enduro row as it stands.
    const store = openStoreWithTwoSimulatorsOn();
    pollSourceWellAt(store, enduroSimulatorId, twoSecondsIn);
    pollSourceWellAt(store, trainingSimulatorId, twoSecondsIn);
    const enduroRowBefore = readAllDataSnapshotRows(store.database)[0];

    // Act: the operator deletes "Simulador — Treino".
    store.moveTheClockTo(fourSecondsIn);
    store.stateStore.applyCommand(
      { type: 'deleteDataSource', sourceId: trainingSimulatorId },
      operatorActor,
    );

    // Assert: only the enduro's row is left, exactly as it was.
    expect(
      readAllDataSnapshotRows(store.database),
      "the deleted source's row must go and the other row must stay untouched",
    ).toEqual([enduroRowBefore]);
  });
});
