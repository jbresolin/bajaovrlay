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
 */
export function openDatabaseForTests(databasePath: string): ServerDatabase {
  const database = openDatabase({ databasePath, migrationsFolder: committedMigrationsFolder });
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
 * first committed migration applied (no data_snapshots table). See
 * openDatabaseWithTheCommittedMigrationsUpTo.
 */
export function openDatabaseAsTheServerBeforeBajaovrlay40LaidItOut(
  databasePath: string,
): ServerDatabase {
  return openDatabaseWithTheCommittedMigrationsUpTo(
    databasePath,
    migrationOfTheServerBeforeBajaovrlay40,
  );
}

/**
 * Opens a database at a path as an older server laid it out: the committed migrations up
 * to and including `lastMigrationTag` applied, with drizzle's own journal of them, so
 * opening the same path later with openDatabaseForTests applies the rest exactly as a
 * server upgrade does. Closed when the test ends unless the test closed it already.
 */
export function openDatabaseWithTheCommittedMigrationsUpTo(
  databasePath: string,
  lastMigrationTag: string,
): ServerDatabase {
  const migrationsFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-migracoes-antigas-'));
  onTestFinished(() => rmSync(migrationsFolder, { recursive: true, force: true }));
  mkdirSync(join(migrationsFolder, 'meta'));
  const committedJournalPath = join(committedMigrationsFolder, 'meta', '_journal.json');
  const committedJournal = JSON.parse(readFileSync(committedJournalPath, 'utf8')) as {
    entries: Array<{ tag: string }>;
  };
  const positionOfTheLast = committedJournal.entries.findIndex(
    (entry) => entry.tag === lastMigrationTag,
  );
  if (positionOfTheLast === -1) {
    throw new Error(`no committed migration is tagged ${lastMigrationTag}`);
  }
  const entriesOfTheOlderServer = committedJournal.entries.slice(0, positionOfTheLast + 1);
  writeFileSync(
    join(migrationsFolder, 'meta', '_journal.json'),
    JSON.stringify({ ...committedJournal, entries: entriesOfTheOlderServer }),
  );
  for (const entry of entriesOfTheOlderServer) {
    const migrationFileName = `${entry.tag}.sql`;
    copyFileSync(
      join(committedMigrationsFolder, migrationFileName),
      join(migrationsFolder, migrationFileName),
    );
  }

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
