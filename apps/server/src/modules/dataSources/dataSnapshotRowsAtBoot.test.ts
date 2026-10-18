/**
 * Booting on a database written before per-source snapshot rows (apps/server)
 *
 * What this module is for:
 *   A server built from main before BAJAOVRLAY-40 has no data_snapshots table: it keeps
 *   every source's last good data in one `dataSnapshots` row of the slices table. The
 *   first boot of this server on such a file applies the new migration, splits that row
 *   into one row per source and removes it, in the boot's one transaction, so the race
 *   data of yesterday is still there after the upgrade (rule 1: a restart loses nothing).
 *
 * What these tests prove (with a real SQLite file laid out by the older migrations):
 *   - After the first boot, the store holds both snapshots as they were, the
 *     data_snapshots table holds one row per source, and the slices table has no
 *     `dataSnapshots` row any more.
 *   - A second boot reads the rows back and writes none of them again: the split ran once.
 *
 * What these tests deliberately do not cover:
 *   - Each rule of the split (a bad snapshot, a row that is not a list, a database with
 *     both); loadDataSnapshotsAtBoot.test.ts covers them.
 *   - The sources coming back stale after the restart; loadDataSourceSlices.test.ts.
 */
import type { DataSnapshot } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { readAllDataSnapshotRows } from '../../core/db/dataSnapshotRowStorage.js';
import type { ServerDatabase } from '../../core/db/openDatabase.js';
import { readAllSliceRows, writeSliceRows } from '../../core/db/sliceRowStorage.js';
import {
  createTemporaryDatabasePath,
  openDatabaseAsTheServerBeforeBajaovrlay40LaidItOut,
  openDatabaseForTests,
} from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { missingGraphicsFolderPath } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { createStateStore } from '../../core/store/createStateStore.js';
import { seededLayers } from '../../core/store/seedLayers.js';
import {
  buildEnduroSimulatorTurnedOff,
  buildFridayReplayTurnedOff,
  buildSimulatorSnapshotReceivedAt,
  momentOfTheCommandMs,
} from './reducers/dataSourceSlices.testSupport.js';

const momentTheOlderServerWrote = '2027-08-14T14:32:05.000Z';
const momentOfTheFirstBoot = '2027-08-14T15:00:00.000Z';
const momentOfTheSecondBoot = '2027-08-14T15:10:00.000Z';

/** Builds the last good data of Friday's replay: car 42, Baja UFPR, leading after 3 laps. */
function buildFridayReplaySnapshot(): DataSnapshot {
  return {
    sourceId: 'reproducao-sexta',
    receivedAtMs: momentOfTheCommandMs,
    shapes: {
      positions: {
        sessionId: 'treino-2027-sexta',
        updatedAtMs: momentOfTheCommandMs,
        entries: [
          {
            position: 1,
            carNumber: 42,
            teamName: 'Baja UFPR',
            schoolName: 'UFPR',
            laps: 3,
            lastLapMs: 278_293,
            status: 'running',
          },
        ],
      },
    },
  };
}

/**
 * Writes, on a database laid out by the older migrations, the rows an older server left
 * after a day's work: its layers, two sources (off) and the single row of both snapshots.
 * Then closes it, as that server stopping does.
 */
function writeTheDatabaseAsTheOlderServerLeftIt(databasePath: string): void {
  const olderDatabase = openDatabaseAsTheServerBeforeBajaovrlay40LaidItOut(databasePath);
  writeSliceRows(olderDatabase, [
    { name: 'layers', json: seededLayers, updatedAt: momentTheOlderServerWrote },
    {
      name: 'dataSources',
      json: [buildEnduroSimulatorTurnedOff(), buildFridayReplayTurnedOff()],
      updatedAt: momentTheOlderServerWrote,
    },
    {
      name: 'dataSnapshots',
      json: [buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs), buildFridayReplaySnapshot()],
      updatedAt: momentTheOlderServerWrote,
    },
  ]);
  olderDatabase.$client.close();
}

/** Boots this server's store on the database, at the given moment. */
function bootStoreOn(database: ServerDatabase, momentOfTheBoot: string) {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: missingGraphicsFolderPath,
    readCurrentTime: () => new Date(momentOfTheBoot),
  });
}

describe('the first boot on a database the older server wrote', () => {
  it('splits the single snapshots row into one row per source and removes it', () => {
    // Arrange: the database exactly as the older server left it, then reopened with
    // every committed migration, as the upgraded server does.
    const databasePath = createTemporaryDatabasePath();
    writeTheDatabaseAsTheOlderServerLeftIt(databasePath);
    const upgradedDatabase = openDatabaseForTests(databasePath);

    // Act: this server boots on it.
    const stateStore = bootStoreOn(upgradedDatabase, momentOfTheFirstBoot);

    // Assert: both snapshots in memory as they were, one row each, the old row gone.
    expect(
      stateStore.readAllSlices().dataSnapshots,
      "yesterday's race data must survive the upgrade",
    ).toEqual([
      buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs),
      buildFridayReplaySnapshot(),
    ]);
    expect(
      readAllDataSnapshotRows(upgradedDatabase),
      'each source must now have its own row, written at the boot',
    ).toEqual([
      {
        sourceId: 'simulador-enduro',
        json: buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs),
        updatedAt: momentOfTheFirstBoot,
      },
      {
        sourceId: 'reproducao-sexta',
        json: buildFridayReplaySnapshot(),
        updatedAt: momentOfTheFirstBoot,
      },
    ]);
    expect(
      readAllSliceRows(upgradedDatabase).map((row) => row.name),
      'the single snapshots row must be removed once it is split',
    ).not.toContain('dataSnapshots');
  });
});

describe('a second boot after the split', () => {
  it('reads the rows back and writes none of them again', () => {
    // Arrange: the older server's database, booted once by this server, then closed.
    const databasePath = createTemporaryDatabasePath();
    writeTheDatabaseAsTheOlderServerLeftIt(databasePath);
    const databaseOfTheFirstBoot = openDatabaseForTests(databasePath);
    bootStoreOn(databaseOfTheFirstBoot, momentOfTheFirstBoot);
    databaseOfTheFirstBoot.$client.close();
    const databaseOfTheSecondBoot = openDatabaseForTests(databasePath);

    // Act: this server boots on it again, ten minutes later.
    const stateStore = bootStoreOn(databaseOfTheSecondBoot, momentOfTheSecondBoot);

    // Assert: the same snapshots; every row still carries the first boot's moment.
    expect(stateStore.readAllSlices().dataSnapshots, 'a second boot must keep the data').toEqual([
      buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs),
      buildFridayReplaySnapshot(),
    ]);
    expect(
      readAllDataSnapshotRows(databaseOfTheSecondBoot).map((row) => row.updatedAt),
      'the split must run once: the second boot rewrites no snapshot row',
    ).toEqual([momentOfTheFirstBoot, momentOfTheFirstBoot]);
  });
});
