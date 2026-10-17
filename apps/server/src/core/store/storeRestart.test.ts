/**
 * Restarting the server from its database file (apps/server)
 *
 * What this module is for:
 *   A page refresh or a server restart must lose nothing. The store saves every slice
 *   that changes and every event-log entry to SQLite, and a new store opened on the
 *   same file loads them back, including the instances that were on the program output.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - A new store on the same file has exactly the slices the old one had.
 *   - The event log comes back in the order the commands were applied.
 *   - The database keeps every event-log entry (one per command that changed something
 *     or was refused), while the slice (in memory and after a restart) keeps only the
 *     newest 200.
 *
 * What these tests deliberately do not cover:
 *   - What is on the preview output, the one thing a restart drops on purpose;
 *     storeRestartDropsPreviews.test.ts covers it.
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
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';
import { createRaceClockItemOnTheStore } from './raceClockItemOnTheStore.testSupport.js';

/** Opens a store on the given database, the way the server does at boot. */
function openStoreOnDatabase(database: ServerDatabase, graphicPackagesFolder: string) {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder,
  });
}

/** Simulates a restart: closes the old connection and opens the same file again. */
function reopenDatabase(database: ServerDatabase, databasePath: string): ServerDatabase {
  database.$client.close();
  return openDatabaseForTests(databasePath);
}

describe('a store opened on the file of a previous store', () => {
  it('has exactly the slices the previous store had, including what was on air', () => {
    // Arrange: a store that took two race clock items on program, one on the clock
    // layer and one on the fullscreen layer. (Until BAJAOVRLAY-15 the second take was on
    // the preview output; a preview is now dropped at boot, see storeRestartDropsPreviews.test.ts.)
    const databasePath = createTemporaryDatabasePath();
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabase(firstDatabase, graphicPackagesFolder);
    const clockItemId = createRaceClockItemOnTheStore(storeBeforeRestart);
    const fullscreenClockItemId = createRaceClockItemOnTheStore(storeBeforeRestart, {
      label: 'Relógio do enduro — tela cheia',
      layerId: 'fullscreen',
    });
    storeBeforeRestart.applyCommand(
      { type: 'takeItem', itemId: clockItemId },
      'operador:conexao-7',
    );
    storeBeforeRestart.applyCommand(
      { type: 'takeItem', itemId: fullscreenClockItemId },
      'operador:conexao-7',
    );
    const slicesBeforeRestart = storeBeforeRestart.readAllSlices();

    // Act: restart, opening a new store on the same file.
    const secondDatabase = reopenDatabase(firstDatabase, databasePath);
    const storeAfterRestart = openStoreOnDatabase(secondDatabase, graphicPackagesFolder);

    // Assert: every slice is identical, and both instances are still there.
    expect(storeAfterRestart.readAllSlices(), 'a restart must lose nothing').toEqual(
      slicesBeforeRestart,
    );
    expect(storeAfterRestart.readAllSlices().instances.length, 'both takes must survive').toBe(2);
  });

  it('has the event log in the order the commands were applied', () => {
    // Arrange: a store that prepared an item, took it, ran a refused clear and a
    // clearAll, in that order.
    const databasePath = createTemporaryDatabasePath();
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabase(firstDatabase, graphicPackagesFolder);
    const clockItemId = createRaceClockItemOnTheStore(storeBeforeRestart);
    storeBeforeRestart.applyCommand(
      { type: 'takeItem', itemId: clockItemId },
      'operador:conexao-7',
    );
    storeBeforeRestart.applyCommand(
      { type: 'clearLayer', layerId: 'placar' },
      'operador:conexao-7',
    );
    storeBeforeRestart.applyCommand({ type: 'clearAll' }, 'operador:conexao-8');

    // Act: restart and read the event log back.
    const secondDatabase = reopenDatabase(firstDatabase, databasePath);
    const eventLogAfterRestart = openStoreOnDatabase(
      secondDatabase,
      graphicPackagesFolder,
    ).readAllSlices().eventLog;

    // Assert: four entries, oldest first, with increasing ids and the right outcomes.
    expect(
      eventLogAfterRestart.map((entry) => [entry.id, entry.command, entry.result.status]),
      'the event log must come back in the order the commands were applied',
    ).toEqual([
      [1, 'createItem', 'ok'],
      [2, 'takeItem', 'ok'],
      [3, 'clearLayer', 'failed'],
      [4, 'clearAll', 'ok'],
    ]);
  });

  // 201 real SQLite transactions take about 4.5 s on a WSL disk, too close to Vitest's
  // 5 s default once other suites run beside it, so this test gets its own limit.
  it(
    'keeps every entry in the database but only the newest 200 in the slice',
    { timeout: 30_000 },
    () => {
      // Arrange: a store that prepared the race clock item and took it 200 times: 201
      // entries, one more than the slice keeps. Each take replaces the clock before it,
      // so each one changes the stage and is written to the event log; a command that
      // changes nothing (a clearAll of an empty stage, say) writes no entry and could
      // not fill the log.
      const databasePath = createTemporaryDatabasePath();
      const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
      const firstDatabase = openDatabaseForTests(databasePath);
      const storeBeforeRestart = openStoreOnDatabase(firstDatabase, graphicPackagesFolder);
      const clockItemId = createRaceClockItemOnTheStore(storeBeforeRestart);
      for (let takeNumber = 1; takeNumber <= 200; takeNumber += 1) {
        storeBeforeRestart.applyCommand(
          { type: 'takeItem', itemId: clockItemId },
          'operador:conexao-7',
        );
      }
      const sliceBeforeRestart = storeBeforeRestart.readAllSlices().eventLog;

      // Act: restart and read the slice and the table back.
      const secondDatabase = reopenDatabase(firstDatabase, databasePath);
      const sliceAfterRestart = openStoreOnDatabase(
        secondDatabase,
        graphicPackagesFolder,
      ).readAllSlices().eventLog;

      // Assert: the table has all 201; the slice has ids 2 to 201, before and after.
      expect(countEventLogRows(secondDatabase), 'the database must keep every entry').toBe(201);
      expect(sliceBeforeRestart.length, 'the slice in memory keeps only 200').toBe(200);
      expect(sliceBeforeRestart[0]?.id, 'the oldest entry must have left the slice').toBe(2);
      expect(sliceAfterRestart, 'after a restart the slice holds the same newest 200').toEqual(
        sliceBeforeRestart,
      );
    },
  );
});
