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
 *   - A recording left open lists again from its file, closed at its last line, and the
 *     source comes back not recording (D13).
 *
 * What these tests deliberately do not cover:
 *   - Each rule of the boot loader; loadDataSourceSlices.test.ts covers them.
 *   - The poller starting again after the restart; pollerLifecycle.test.ts covers it.
 *   - Reading the recordings folder line by line; recordingsFromFolder.test.ts covers it.
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
  operatorActor,
  readTheSimulator,
  startOfTheEnduroMs,
  turnTheSimulatorOn,
} from './enduroSimulatorCommands.testSupport.js';
import {
  fileNameOfTheRecordingStartedAt1400,
  openStoreOnTheDatabaseAndFolder,
  pressRecordOnTheSimulator,
  sendAGoodSimulatorPollAt,
  startRecorderWatchingAStore,
} from './recorder.testSupport.js';
import {
  buildEnduroSimulatorTurnedOff,
  buildGreenFlagSessionAt,
} from './reducers/dataSourceSlices.testSupport.js';

const enduroSimulatorPollerActor = buildDataSourcePollerActor('simulador-enduro');

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

describe('the recordings across a restart', () => {
  it('are listed again from the folder, closed at their last line, with the source not recording', () => {
    // Arrange: the simulator on and recording, two good polls written, never stopped.
    const { stateStore, recordingsFolder, database } = startRecorderWatchingAStore();
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);
    sendAGoodSimulatorPollAt(stateStore, startOfTheEnduroMs + 2_000);
    sendAGoodSimulatorPollAt(stateStore, startOfTheEnduroMs + 4_000);

    // Act: the server restarts at 14:05: a new store opens the same database and folder.
    const storeAfterTheRestart = openStoreOnTheDatabaseAndFolder(
      database,
      recordingsFolder,
      () => startOfTheEnduroMs + 300_000,
    );

    // Assert: the recording is back, closed at its last line, and nothing records.
    expect(
      storeAfterTheRestart.readAllSlices().recordings,
      'the recording must be rebuilt from its file, closed at its last line (D13)',
    ).toEqual([
      {
        id: `simulador-enduro/${fileNameOfTheRecordingStartedAt1400}`,
        sourceId: 'simulador-enduro',
        sourceLabel: 'Simulador — Enduro',
        fileName: fileNameOfTheRecordingStartedAt1400,
        startedAtMs: startOfTheEnduroMs,
        endedAtMs: startOfTheEnduroMs + 4_000,
        snapshotCount: 2,
      },
    ]);
    expect(
      readTheSimulator(storeAfterTheRestart).isRecording,
      'a restart closes the recordings, so the source must not be recording',
    ).toBe(false);
  });
});
