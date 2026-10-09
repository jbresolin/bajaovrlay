/**
 * Restarting the server from its database file (apps/server)
 *
 * What this module is for:
 *   A page refresh or a server restart must lose nothing. The store saves every slice
 *   that changes and every event-log entry to SQLite, and a new store opened on the
 *   same file loads them back, including the instances that were on air.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - A new store on the same file has exactly the slices the old one had.
 *   - The event log comes back in the order the commands were applied.
 *   - The database keeps every event-log entry, while the slice (in memory and after a
 *     restart) keeps only the newest 200.
 *
 * What these tests deliberately do not cover:
 *   - Seeding an empty database; loadInitialSlices.test.ts covers it.
 *   - A broken migration at boot; openDatabase.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import { countEventLogRows } from '../db/eventLogRowStorage.js';
import type { ServerDatabase } from '../db/openDatabase.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createStateStore } from './createStateStore.js';
import { writeTemporaryRaceClockManifest } from './raceClockManifest.testSupport.js';

const takeRaceClockOnProgram = {
  type: 'takeGraphic',
  graphicId: 'race-clock',
  layerId: 'clock',
  data: { sessionName: 'Enduro de Resistência', state: 'green' },
};

/** Opens a store on the given database, the way the server does at boot. */
function openStoreOnDatabase(database: ServerDatabase, raceClockManifestPath: string) {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    raceClockManifestPath,
  });
}

/** Simulates a restart: closes the old connection and opens the same file again. */
function reopenDatabase(database: ServerDatabase, databasePath: string): ServerDatabase {
  database.$client.close();
  return openDatabaseForTests(databasePath);
}

describe('a store opened on the file of a previous store', () => {
  it('has exactly the slices the previous store had, including what was on air', () => {
    // Arrange: a store that took the race clock on program and on preview.
    const databasePath = createTemporaryDatabasePath();
    const raceClockManifestPath = writeTemporaryRaceClockManifest();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabase(firstDatabase, raceClockManifestPath);
    storeBeforeRestart.applyCommand(takeRaceClockOnProgram, 'operador:conexao-7');
    storeBeforeRestart.applyCommand(
      { ...takeRaceClockOnProgram, target: 'preview' },
      'operador:conexao-7',
    );
    const slicesBeforeRestart = storeBeforeRestart.readAllSlices();

    // Act: restart, opening a new store on the same file.
    const secondDatabase = reopenDatabase(firstDatabase, databasePath);
    const storeAfterRestart = openStoreOnDatabase(secondDatabase, raceClockManifestPath);

    // Assert: every slice is identical, and both instances are still there.
    expect(storeAfterRestart.readAllSlices(), 'a restart must lose nothing').toEqual(
      slicesBeforeRestart,
    );
    expect(storeAfterRestart.readAllSlices().instances.length, 'both takes must survive').toBe(2);
  });

  it('has the event log in the order the commands were applied', () => {
    // Arrange: a store that ran a take, a refused clear and a clearAll, in that order.
    const databasePath = createTemporaryDatabasePath();
    const raceClockManifestPath = writeTemporaryRaceClockManifest();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabase(firstDatabase, raceClockManifestPath);
    storeBeforeRestart.applyCommand(takeRaceClockOnProgram, 'operador:conexao-7');
    storeBeforeRestart.applyCommand(
      { type: 'clearLayer', layerId: 'placar' },
      'operador:conexao-7',
    );
    storeBeforeRestart.applyCommand({ type: 'clearAll' }, 'operador:conexao-8');

    // Act: restart and read the event log back.
    const secondDatabase = reopenDatabase(firstDatabase, databasePath);
    const eventLogAfterRestart = openStoreOnDatabase(
      secondDatabase,
      raceClockManifestPath,
    ).readAllSlices().eventLog;

    // Assert: three entries, oldest first, with increasing ids and the right outcomes.
    expect(
      eventLogAfterRestart.map((entry) => [entry.id, entry.command, entry.result.status]),
      'the event log must come back in the order the commands were applied',
    ).toEqual([
      [1, 'takeGraphic', 'ok'],
      [2, 'clearLayer', 'failed'],
      [3, 'clearAll', 'ok'],
    ]);
  });

  it('keeps every entry in the database but only the newest 200 in the slice', () => {
    // Arrange: a store that ran 201 commands, one more than the slice keeps.
    const databasePath = createTemporaryDatabasePath();
    const raceClockManifestPath = writeTemporaryRaceClockManifest();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabase(firstDatabase, raceClockManifestPath);
    for (let commandNumber = 1; commandNumber <= 201; commandNumber += 1) {
      storeBeforeRestart.applyCommand({ type: 'clearAll' }, 'operador:conexao-7');
    }
    const sliceBeforeRestart = storeBeforeRestart.readAllSlices().eventLog;

    // Act: restart and read the slice and the table back.
    const secondDatabase = reopenDatabase(firstDatabase, databasePath);
    const sliceAfterRestart = openStoreOnDatabase(
      secondDatabase,
      raceClockManifestPath,
    ).readAllSlices().eventLog;

    // Assert: the table has all 201; the slice has ids 2 to 201, before and after.
    expect(countEventLogRows(secondDatabase), 'the database must keep every entry').toBe(201);
    expect(sliceBeforeRestart.length, 'the slice in memory keeps only 200').toBe(200);
    expect(sliceBeforeRestart[0]?.id, 'the oldest entry must have left the slice').toBe(2);
    expect(sliceAfterRestart, 'after a restart the slice holds the same newest 200').toEqual(
      sliceBeforeRestart,
    );
  });
});
