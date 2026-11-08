// Dated backups of the server's SQLite database, taken with SQLite's online backup while
// the server runs (BAJAOVRLAY-34). backupDatabase.ts is the command that calls this; the
// backup download (modules/backup, BAJAOVRLAY-33) uses copyDatabaseIntoFile alone.
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

/** How many backups the folder keeps: two weeks of nightly runs. */
export const backupsKept = 14;

// Only files this module wrote match, so a copy made by hand in the same folder is never
// removed. The moment is UTC, so the names sort in the order the backups were taken.
const backupFileNamePattern = /^bajaovrlay-\d{4}-\d{2}-\d{2}T\d{6}Z\.sqlite$/;

// The largest page count better-sqlite3 accepts for one step: more than any database has.
const allRemainingPagesInOneStep = 0x7fffffff;

/** What one backup did: the file it wrote, and the oldest backups it removed. */
export type DatabaseBackupOutcome = { backupPath: string; removedBackupPaths: string[] };

/**
 * Copies the database into `backupFolder` as bajaovrlay-<date>T<time>Z.sqlite, then
 * removes the oldest backups past the newest 14. Rejects, writing nothing, when the
 * database file does not exist.
 */
export async function writeDatabaseBackup(options: {
  databasePath: string;
  backupFolder: string;
  readCurrentTime?: (() => Date) | undefined;
}): Promise<DatabaseBackupOutcome> {
  const readCurrentTime = options.readCurrentTime ?? (() => new Date());
  // Checked before the folder is made, so a wrong DATABASE_PATH writes nothing at all.
  assertDatabaseFileExists(options.databasePath);
  mkdirSync(options.backupFolder, { recursive: true });
  const backupPath = join(options.backupFolder, nameBackupFile(readCurrentTime()));
  // Written under another name first and renamed when whole, so a backup cut short (the
  // container stopped, the disk full) is never counted among the 14 kept.
  const unfinishedBackupPath = `${backupPath}.partial`;
  await copyDatabaseIntoFile(options.databasePath, unfinishedBackupPath);
  renameSync(unfinishedBackupPath, backupPath);

  const removedBackupPaths = removeBackupsPastTheNewest(options.backupFolder, backupsKept);
  return { backupPath, removedBackupPaths };
}

/**
 * Copies the database into `destinationPath` with SQLite's online backup, as one
 * consistent moment while the server keeps writing; the nightly command above and the
 * download (modules/backup, BAJAOVRLAY-33) both use it. Rejects, leaving no file behind,
 * when the database cannot be opened or the copy fails.
 */
export async function copyDatabaseIntoFile(
  databasePath: string,
  destinationPath: string,
): Promise<void> {
  // fileMustExist: a wrong DATABASE_PATH must fail, not create and copy an empty database.
  let database: Database.Database;
  try {
    database = new Database(databasePath, { readonly: true, fileMustExist: true });
  } catch (openError) {
    throw new Error(`cannot open the database to back it up: ${databasePath}`, {
      cause: openError,
    });
  }
  try {
    // SQLite's online backup starts over by itself when the server writes between two of
    // its steps, so the copy is always one consistent moment. better-sqlite3 copies 100
    // pages per step by default, and against a server writing without pause it started
    // over again and again (3 to 10 times longer in backupDatabaseWhileTheServerWrites
    // .test.ts); a bigger database, at every poll, could start over without end. So every
    // step after the first copies all that is left, under one read lock, and the server's
    // writes wait until it is done (its busy timeout is 5 s). The trade-off: that wait is
    // the time to copy the whole file, so it grows with the database, and event_log is
    // never pruned. Measured on João's machine: 35 ms for 10 MB, 160 ms for 100 MB, 465 ms
    // for 300 MB. Near 3 GB the wait would pass 5 s and a write would fail (SQLITE_BUSY)
    // during the backup: long before that, event_log needs pruning.
    await database.backup(destinationPath, { progress: () => allRemainingPagesInOneStep });
  } catch (backupError) {
    rmSync(destinationPath, { force: true });
    throw backupError;
  } finally {
    database.close();
  }
}

/** Throws the same error copyDatabaseIntoFile would when the database file is missing. */
function assertDatabaseFileExists(databasePath: string): void {
  if (!existsSync(databasePath)) {
    throw new Error(`cannot open the database to back it up: ${databasePath}`);
  }
}

/** The file name of a backup taken at `moment`: bajaovrlay-2026-11-14T030000Z.sqlite. */
export function nameBackupFile(moment: Date): string {
  // "2026-11-14T03:00:00.000Z" becomes "2026-11-14T030000Z": no colons, which Windows
  // refuses in a file name, and João copies these to a USB stick.
  const isoMoment = moment.toISOString();
  const date = isoMoment.slice(0, 10);
  const time = isoMoment.slice(11, 19).replaceAll(':', '');
  return `bajaovrlay-${date}T${time}Z.sqlite`;
}

/** Removes every backup but the newest `keptCount`, answering the paths it removed. */
function removeBackupsPastTheNewest(backupFolder: string, keptCount: number): string[] {
  const backupNamesOldestFirst = readdirSync(backupFolder)
    .filter((fileName) => backupFileNamePattern.test(fileName))
    .sort();
  const countToRemove = Math.max(backupNamesOldestFirst.length - keptCount, 0);
  const namesToRemove = backupNamesOldestFirst.slice(0, countToRemove);
  const removedBackupPaths: string[] = [];
  for (const fileName of namesToRemove) {
    const backupPath = join(backupFolder, fileName);
    rmSync(backupPath);
    removedBackupPaths.push(backupPath);
  }
  return removedBackupPaths;
}
