// Test support: real SQLite files in temporary folders, removed after each test.
// Files named *.testSupport.ts are left out of the build (tsconfig.build.json).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
