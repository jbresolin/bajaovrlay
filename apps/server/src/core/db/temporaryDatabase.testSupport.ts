// Test support: real SQLite files in temporary folders, removed after each test.
// Files named *.testSupport.ts are left out of the build (tsconfig.build.json).
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { onTestFinished } from 'vitest';

import { committedMigrationsFolder, openDatabase, type ServerDatabase } from './openDatabase.js';

/** Returns a database file path in a new temporary folder, deleted when the test ends. */
export function createTemporaryDatabasePath(): string {
  const temporaryFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-banco-'));
  onTestFinished(() => rmSync(temporaryFolder, { recursive: true, force: true }));
  return join(temporaryFolder, 'bajaovrlay.sqlite');
}

/**
 * Opens the database at a path with the committed migrations, as the server does, and
 * closes it when the test ends (unless the test already closed it to simulate a restart).
 * Unlike the server's, it does not wait for the disk at each commit (see below).
 */
export function openDatabaseForTests(databasePath: string): ServerDatabase {
  const database = openDatabase({ databasePath, migrationsFolder: committedMigrationsFolder });
  // Every command commits, and by default SQLite waits for the disk to confirm each commit
  // (synchronous = FULL): about 7 ms here, far more when several verifies share the disk.
  // eventLogRoute.test.ts's 110 commands spent 97% of their time in that wait and once
  // went past 5 s under load (BAJAOVRLAY-61). What it buys is surviving a power cut, which
  // no test checks. With it off, a commit still reaches the operating system at once, so
  // a second connection or a reopened file (a restart test) reads every write as before.
  database.$client.pragma('synchronous = OFF');
  onTestFinished(() => {
    if (database.$client.open) {
      database.$client.close();
    }
  });
  return database;
}

/** Opens a brand-new database in a temporary folder; both go away when the test ends. */
export function openTemporaryDatabase(): { database: ServerDatabase; databasePath: string } {
  const databasePath = createTemporaryDatabasePath();
  const database = openDatabaseForTests(databasePath);
  return { database, databasePath };
}

// The first committed migration: the slices and event_log tables, and nothing else. It is
// the whole schema of every server built before BAJAOVRLAY-40 added data_snapshots.
const migrationOfTheServerBeforeBajaovrlay40 = '0000_create_slices_and_event_log';

/**
 * Opens a database at a path as a server built before BAJAOVRLAY-40 laid it out: only the
 * first committed migration applied (no data_snapshots table), with drizzle's own journal
 * of it, so opening the same path later with openDatabaseForTests applies the rest exactly
 * as a server upgrade does. Closed when the test ends unless the test closed it already.
 */
export function openDatabaseAsTheServerBeforeBajaovrlay40LaidItOut(
  databasePath: string,
): ServerDatabase {
  const migrationsFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-migracoes-antigas-'));
  onTestFinished(() => rmSync(migrationsFolder, { recursive: true, force: true }));
  mkdirSync(join(migrationsFolder, 'meta'));
  const committedJournalPath = join(committedMigrationsFolder, 'meta', '_journal.json');
  const committedJournal = JSON.parse(readFileSync(committedJournalPath, 'utf8')) as {
    entries: Array<{ tag: string }>;
  };
  const journalOfTheOlderServer = {
    ...committedJournal,
    entries: committedJournal.entries.filter(
      (entry) => entry.tag === migrationOfTheServerBeforeBajaovrlay40,
    ),
  };
  writeFileSync(
    join(migrationsFolder, 'meta', '_journal.json'),
    JSON.stringify(journalOfTheOlderServer),
  );
  const migrationFileName = `${migrationOfTheServerBeforeBajaovrlay40}.sql`;
  copyFileSync(
    join(committedMigrationsFolder, migrationFileName),
    join(migrationsFolder, migrationFileName),
  );

  const database = openDatabase({ databasePath, migrationsFolder });
  onTestFinished(() => {
    if (database.$client.open) {
      database.$client.close();
    }
  });
  return database;
}

/**
 * Writes a migrations folder with one migration whose SQL is cut off, as a bad merge
 * might leave it. The folder has drizzle-kit's layout: meta/_journal.json plus the SQL.
 */
export function writeBrokenMigrationsFolder(): string {
  const migrationsFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-migracoes-quebradas-'));
  onTestFinished(() => rmSync(migrationsFolder, { recursive: true, force: true }));
  mkdirSync(join(migrationsFolder, 'meta'));
  const journal = {
    version: '7',
    dialect: 'sqlite',
    entries: [
      {
        idx: 0,
        version: '6',
        when: 1_760_000_000_000,
        tag: '0000_tabela_cortada',
        breakpoints: true,
      },
    ],
  };
  writeFileSync(join(migrationsFolder, 'meta', '_journal.json'), JSON.stringify(journal));
  writeFileSync(
    join(migrationsFolder, '0000_tabela_cortada.sql'),
    'CREATE TABLE `slices` (`name` text PRIMARY KEY NOT NULL, `json`',
  );
  return migrationsFolder;
}
