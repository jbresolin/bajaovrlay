/**
 * Opening the database and applying migrations (apps/server)
 *
 * What this module is for:
 *   The server keeps its state in one SQLite file. At boot, `openDatabase` opens it and
 *   applies the committed drizzle-kit migrations (apps/server/drizzle/). If a migration
 *   fails, the server must not run on a half-migrated database, so opening throws and
 *   the boot stops ("fail closed").
 *
 * What these tests prove (with real SQLite files in a temporary folder):
 *   - A brand-new file gets the `slices` and `event_log` tables.
 *   - A migration that fails makes openDatabase throw, naming the migrations folder.
 *   - A migrations folder that does not exist makes openDatabase throw too.
 *
 * What these tests deliberately do not cover:
 *   - That the whole server boot stops; boot/startServer.test.ts covers it.
 *   - Drizzle's migration bookkeeping itself (which migrations already ran).
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { openDatabase } from './openDatabase.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
  writeBrokenMigrationsFolder,
} from './temporaryDatabase.testSupport.js';

describe('openDatabase', () => {
  it('creates the slices and event_log tables on a brand-new file', () => {
    // Arrange: a path where no database exists yet.
    const databasePath = createTemporaryDatabasePath();

    // Act: open it with the committed migrations.
    const database = openDatabaseForTests(databasePath);
    const tableNames = database.$client
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .pluck()
      .all();

    // Assert: both tables exist.
    expect(tableNames, 'the migrations must create the slices table').toContain('slices');
    expect(tableNames, 'the migrations must create the event_log table').toContain('event_log');
  });

  it('throws, naming the migrations folder, when a migration fails', () => {
    // Arrange: a fresh database path and a migrations folder with broken SQL.
    const databasePath = createTemporaryDatabasePath();
    const brokenMigrationsFolder = writeBrokenMigrationsFolder();

    // Act: try to open the database with those migrations.
    const openWithBrokenMigrations = () =>
      openDatabase({ databasePath, migrationsFolder: brokenMigrationsFolder });

    // Assert: it throws, and the message says which folder failed.
    expect(openWithBrokenMigrations, 'a failed migration must stop the boot').toThrow(
      `database migration failed (migrations folder: ${brokenMigrationsFolder})`,
    );
  });

  it('throws when the migrations folder does not exist', () => {
    // Arrange: a fresh database path and a migrations folder that was never committed.
    const databasePath = createTemporaryDatabasePath();
    const missingMigrationsFolder = join(tmpdir(), 'bajaovrlay-migracoes-inexistentes');

    // Act: try to open the database with it.
    const openWithoutMigrations = () =>
      openDatabase({ databasePath, migrationsFolder: missingMigrationsFolder });

    // Assert: it throws instead of running with no tables.
    expect(openWithoutMigrations, 'missing migrations must stop the boot').toThrow(
      'database migration failed',
    );
  });
});
