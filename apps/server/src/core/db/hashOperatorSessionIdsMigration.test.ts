/**
 * Migration 0004: sessions kept by the hash of their id (apps/server)
 *
 * What this module is for:
 *   Migration 0003 (BAJAOVRLAY-29) stored each operator session under its plain id, the
 *   one its cookie carries. Gate 2 of PR #51 keeps the SHA-256 of the id instead, so a copy
 *   of the database holds no working cookie. Migration 0004 renames the column and drops
 *   the sessions stored before it, whose plain ids are exactly what must not be kept: each
 *   operator logs in once more after the upgrade.
 *
 * What these tests prove (with a real SQLite file, opened as the older server left it):
 *   - A database at 0003 holding a session, opened by this server, has no session left,
 *     and the table's key column is now `sessionIdHash`.
 *
 * What these tests deliberately do not cover:
 *   - Hashing at login and at every lookup; core/operatorLogin's
 *     operatorSessionsInTheDatabase.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
  openDatabaseWithTheCommittedMigrationsUpTo,
} from './temporaryDatabase.testSupport.js';

describe('migration 0004_hash_operator_session_ids', () => {
  it('drops the sessions stored with a plain id and keys the table by the hash', () => {
    // Arrange: a database as the server with migration 0003 left it, with Dados logged in.
    const databasePath = createTemporaryDatabasePath();
    const olderDatabase = openDatabaseWithTheCommittedMigrationsUpTo(
      databasePath,
      '0003_add_operator_sessions',
    );
    olderDatabase.$client
      .prepare(
        'INSERT INTO operator_sessions (sessionId, role, station, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        'sessao-de-dados-na-mesa-2',
        'dados',
        'Mesa 2',
        '2026-11-08T08:00:00.000Z',
        '2026-11-09T02:00:00.000Z',
      );
    olderDatabase.$client.close();

    // Act: open it with this server's migrations, as the upgrade does.
    const upgradedDatabase = openDatabaseForTests(databasePath);
    const storedSessionCount = upgradedDatabase.$client
      .prepare('SELECT COUNT(*) FROM operator_sessions')
      .pluck()
      .get();
    const columnNames = upgradedDatabase.$client
      .prepare("SELECT name FROM pragma_table_info('operator_sessions') ORDER BY cid")
      .pluck()
      .all();

    // Assert: the plain id is gone with its row, and the table keys sessions by the hash.
    expect(storedSessionCount, 'a session stored under its plain id must not survive').toBe(0);
    expect(columnNames, 'the key column now holds the hash').toEqual([
      'sessionIdHash',
      'role',
      'station',
      'createdAt',
      'expiresAt',
    ]);
  });
});
