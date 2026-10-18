/**
 * Data sources across a server restart (apps/server)
 *
 * What this module is for:
 *   A restart must lose nothing, data included: the last good snapshot of each source is
 *   saved with the slices and comes back when a new store opens the same file. It comes
 *   back stale, because it is data from before the restart, until the next good poll
 *   (rule 4: kept, and marked).
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - A new database shows the seeded simulator, off, and nothing else.
 *   - After a good poll and a restart, the snapshot is identical and the source is on,
 *     stale; the first good poll after the restart recovers it.
 *   - Deleting every source and restarting brings the seeded simulator back (D12).
 *
 * What these tests deliberately do not cover:
 *   - Each rule of the boot loader; loadDataSourceSlices.test.ts covers them.
 *   - The poller starting again after the restart; poller tests (commit 4).
 */
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../../core/db/openDatabase.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { missingGraphicsFolderPath } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { buildDataSourcePollerActor } from '../../core/store/commandActors.js';
import { createStateStore } from '../../core/store/createStateStore.js';
import {
  buildEnduroSimulatorTurnedOff,
  buildGreenFlagSessionAt,
} from './reducers/dataSourceSlices.testSupport.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
const enduroSimulatorPollerActor = buildDataSourcePollerActor('simulador-enduro');
const startOfTheEnduroMs = Date.parse('2027-08-14T14:00:00.000Z');

/** Opens a store on the given database at 14:00 on the enduro day, as the server does at boot. */
function openStoreOnDatabase(database: ServerDatabase) {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: missingGraphicsFolderPath,
    readCurrentTime: () => new Date(startOfTheEnduroMs),
  });
}

/** Simulates a restart: closes the old connection and opens the same file again. */
function reopenDatabase(database: ServerDatabase, databasePath: string): ServerDatabase {
  database.$client.close();
  return openDatabaseForTests(databasePath);
}

/** Builds the poller's good poll of the green-flag session at a moment. */
function buildGoodSessionPollAt(receivedAtMs: number) {
  return {
    type: 'recordDataSourcePoll',
    sourceId: 'simulador-enduro',
    result: { ok: true, shapes: { session: buildGreenFlagSessionAt(receivedAtMs) }, receivedAtMs },
  };
}

describe('data sources on a new database', () => {
  it('show the seeded simulator, off, and no data', () => {
    // Arrange: a new SQLite file.
    const database = openDatabaseForTests(createTemporaryDatabasePath());

    // Act: open a store on it.
    const slices = openStoreOnDatabase(database).readAllSlices();

    // Assert: the simulator, off; no snapshot; no recording.
    expect(slices.dataSources, 'the simulator must be seeded, off').toEqual([
      buildEnduroSimulatorTurnedOff(),
    ]);
    expect(slices.dataSnapshots, 'no data yet').toEqual([]);
    expect(slices.recordings, 'no recording yet').toEqual([]);
  });
});

describe('data sources across a restart', () => {
  it('keep the last snapshot, stale until the first good poll after the restart', () => {
    // Arrange: the simulator turned on and polled well once, before the restart.
    const databasePath = createTemporaryDatabasePath();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabase(firstDatabase);
    storeBeforeRestart.applyCommand(
      { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: true },
      operatorActor,
    );
    storeBeforeRestart.applyCommand(
      buildGoodSessionPollAt(startOfTheEnduroMs + 2_000),
      enduroSimulatorPollerActor,
    );
    const snapshotsBeforeRestart = storeBeforeRestart.readAllSlices().dataSnapshots;

    // Act: restart, then the first good poll arrives.
    const storeAfterRestart = openStoreOnDatabase(reopenDatabase(firstDatabase, databasePath));
    const slicesRightAfterRestart = storeAfterRestart.readAllSlices();
    storeAfterRestart.applyCommand(
      buildGoodSessionPollAt(startOfTheEnduroMs + 60_000),
      enduroSimulatorPollerActor,
    );

    // Assert: same snapshot, the source on and stale; healthy after the poll.
    const sourceRightAfterRestart = slicesRightAfterRestart.dataSources[0];
    expect(slicesRightAfterRestart.dataSnapshots, 'a restart must keep the data').toEqual(
      snapshotsBeforeRestart,
    );
    expect(sourceRightAfterRestart?.isEnabled, 'the source must still be on').toBe(true);
    expect(sourceRightAfterRestart?.status.isStale, 'old data must read as late').toBe(true);
    expect(
      storeAfterRestart.readAllSlices().dataSources[0]?.status.isStale,
      'the first good poll must recover it',
    ).toBe(false);
  });

  it('bring the seeded simulator back after every source was deleted', () => {
    // Arrange: the operator deleted the only source.
    const databasePath = createTemporaryDatabasePath();
    const firstDatabase = openDatabaseForTests(databasePath);
    openStoreOnDatabase(firstDatabase).applyCommand(
      { type: 'deleteDataSource', sourceId: 'simulador-enduro' },
      operatorActor,
    );

    // Act: restart.
    const storeAfterRestart = openStoreOnDatabase(reopenDatabase(firstDatabase, databasePath));

    // Assert: the simulator is back, off (decision D12).
    expect(
      storeAfterRestart.readAllSlices().dataSources,
      'a database with no source gets the simulator again',
    ).toEqual([buildEnduroSimulatorTurnedOff()]);
  });
});
