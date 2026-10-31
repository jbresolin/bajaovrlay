/**
 * Dated backups of the SQLite database (apps/server)
 *
 * What this module is for:
 *   João's nightly script dumps the TrueNAS Postgres and MariaDB databases but cannot see
 *   SQLite inside a container. `node apps/server/dist/backupDatabase.js /data/backups`
 *   (run with `docker exec` from that script) writes a consistent copy of the server's
 *   database with SQLite's online backup, named by the moment it was taken, and keeps the
 *   newest 14. This file tests the part that copies, names and removes.
 *
 * What these tests prove (with real SQLite files in temporary folders):
 *   - A backup is a copy that opens and holds what the database held, named
 *     bajaovrlay-<date>T<time>Z.sqlite in UTC.
 *   - The backup folder is created when missing.
 *   - The 15th backup removes the oldest, so 14 are kept, and nothing else in the folder
 *     (a copy João made by hand) is ever removed.
 *   - A database file that does not exist fails naming the path, and writes nothing.
 *
 * What these tests deliberately do not cover:
 *   - A backup taken while the server writes: backupDatabaseWhileTheServerWrites.test.ts
 *     runs the command itself against a booted server.
 *   - The docker exec line and the TrueNAS script: deploy/truenas/README.md.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { describe, expect, it, onTestFinished } from 'vitest';

import { backupsKept, writeDatabaseBackup } from './databaseBackup.js';
import { writeSliceRows } from './sliceRowStorage.js';
import { openTemporaryDatabase } from './temporaryDatabase.testSupport.js';

/** An empty folder for the backups of one test, removed when the test ends. */
function createEmptyBackupFolder(): string {
  const backupFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-copias-'));
  onTestFinished(() => rmSync(backupFolder, { recursive: true, force: true }));
  return backupFolder;
}

/** A server database holding team 42, "Baja UFPR", in its teams slice. */
function createDatabaseHoldingTeam42(): string {
  const { database, databasePath } = openTemporaryDatabase();
  writeSliceRows(database, [
    {
      name: 'teams',
      json: [{ carNumber: 42, teamName: 'Baja UFPR', schoolName: 'UFPR' }],
      updatedAt: '2026-11-14T12:00:00.000Z',
    },
  ]);
  return databasePath;
}

/** 03:00 in UTC on the given day of November 2026: the nightly script's moment. */
function threeInTheMorningOfNovember(day: number): Date {
  return new Date(Date.UTC(2026, 10, day, 3, 0, 0));
}

/** Reads the teams row of a backup file, opened on its own as a separate database. */
function readTeamsRowOfBackup(backupPath: string): unknown {
  const backup = new Database(backupPath, { readonly: true });
  onTestFinished(() => {
    backup.close();
  });
  const row = backup.prepare("SELECT json FROM slices WHERE name = 'teams'").get() as
    { json: string } | undefined;
  return row === undefined ? undefined : JSON.parse(row.json);
}

describe('writeDatabaseBackup', () => {
  it('writes a copy named by the moment in UTC that holds what the database held', async () => {
    // Arrange: a database with team 42, and an empty backup folder.
    const databasePath = createDatabaseHoldingTeam42();
    const backupFolder = createEmptyBackupFolder();

    // Act: back it up at 03:00 UTC on 14 November.
    const outcome = await writeDatabaseBackup({
      databasePath,
      backupFolder,
      readCurrentTime: () => threeInTheMorningOfNovember(14),
    });

    // Assert: one file, named by the moment, holding team 42.
    expect(readdirSync(backupFolder), 'one backup, named by its moment').toEqual([
      'bajaovrlay-2026-11-14T030000Z.sqlite',
    ]);
    expect(outcome.backupPath, 'the outcome names the file written').toBe(
      join(backupFolder, 'bajaovrlay-2026-11-14T030000Z.sqlite'),
    );
    expect(readTeamsRowOfBackup(outcome.backupPath), 'the copy must hold team 42').toEqual([
      { carNumber: 42, teamName: 'Baja UFPR', schoolName: 'UFPR' },
    ]);
  });

  it('creates the backup folder when it is missing', async () => {
    // Arrange: a database, and a backup folder that does not exist yet (the first night).
    const databasePath = createDatabaseHoldingTeam42();
    const backupFolder = join(createEmptyBackupFolder(), 'backups');

    // Act: back it up.
    await writeDatabaseBackup({
      databasePath,
      backupFolder,
      readCurrentTime: () => threeInTheMorningOfNovember(14),
    });

    // Assert: the folder now holds the backup.
    expect(readdirSync(backupFolder), 'the folder must be created with the backup in it').toEqual([
      'bajaovrlay-2026-11-14T030000Z.sqlite',
    ]);
  });

  it(`keeps the newest ${String(backupsKept)}: the 15th backup removes the oldest`, async () => {
    // Arrange: a database, and fourteen nights of backups, 1 to 14 November.
    const databasePath = createDatabaseHoldingTeam42();
    const backupFolder = createEmptyBackupFolder();
    for (let day = 1; day <= 14; day += 1) {
      await writeDatabaseBackup({
        databasePath,
        backupFolder,
        readCurrentTime: () => threeInTheMorningOfNovember(day),
      });
    }

    // Act: the fifteenth night, 15 November.
    const outcome = await writeDatabaseBackup({
      databasePath,
      backupFolder,
      readCurrentTime: () => threeInTheMorningOfNovember(15),
    });

    // Assert: 14 backups, 2 to 15 November; the one of 1 November is gone.
    const backupNames = readdirSync(backupFolder).sort();
    expect(backupNames, 'fourteen backups must be kept').toHaveLength(14);
    expect(backupNames[0], 'the oldest kept is 2 November').toBe(
      'bajaovrlay-2026-11-02T030000Z.sqlite',
    );
    expect(backupNames.at(-1), 'the newest is 15 November').toBe(
      'bajaovrlay-2026-11-15T030000Z.sqlite',
    );
    expect(outcome.removedBackupPaths, 'the outcome names the backup removed').toEqual([
      join(backupFolder, 'bajaovrlay-2026-11-01T030000Z.sqlite'),
    ]);
  });

  it('never removes a file it did not write', async () => {
    // Arrange: fourteen nights of backups, plus a copy João made by hand before the event
    // and a folder of his own, all in the same backup folder.
    const databasePath = createDatabaseHoldingTeam42();
    const backupFolder = createEmptyBackupFolder();
    writeFileSync(join(backupFolder, 'antes-da-etapa-sul.sqlite'), 'copia manual');
    mkdirSync(join(backupFolder, 'usb'));
    for (let day = 1; day <= 14; day += 1) {
      await writeDatabaseBackup({
        databasePath,
        backupFolder,
        readCurrentTime: () => threeInTheMorningOfNovember(day),
      });
    }

    // Act: the fifteenth night.
    await writeDatabaseBackup({
      databasePath,
      backupFolder,
      readCurrentTime: () => threeInTheMorningOfNovember(15),
    });

    // Assert: the hand-made copy and the folder are still there.
    expect(
      existsSync(join(backupFolder, 'antes-da-etapa-sul.sqlite')),
      'a copy made by hand must never be removed',
    ).toBe(true);
    expect(existsSync(join(backupFolder, 'usb')), 'a folder must never be removed').toBe(true);
  });

  it('fails naming the path when the database file does not exist, writing nothing', async () => {
    // Arrange: a database path with no file (a wrong DATABASE_PATH), and an empty folder.
    const backupFolder = createEmptyBackupFolder();
    const missingDatabasePath = join(createEmptyBackupFolder(), 'bajaovrlay.sqlite');

    // Act: try to back it up.
    const backingUp = writeDatabaseBackup({
      databasePath: missingDatabasePath,
      backupFolder,
      readCurrentTime: () => threeInTheMorningOfNovember(14),
    });

    // Assert: it fails naming the path, and the backup folder stays empty (no empty
    // database was created and copied instead).
    await expect(backingUp, 'the failure must name the missing file').rejects.toThrow(
      missingDatabasePath,
    );
    expect(readdirSync(backupFolder), 'nothing must be written').toEqual([]);
    expect(existsSync(missingDatabasePath), 'no empty database must be created').toBe(false);
  });
});
