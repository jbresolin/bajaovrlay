/**
 * The latest backup, read from the event log (packages/shared)
 *
 * What this module is for:
 *   Each finished backup writes one event-log row, a recordBackup signed `sistema:backup`
 *   carrying its size. "Última cópia: 14:32, 48 MB" is read from those rows: the server
 *   reads the newest one from the database (GET /api/v1/backup/summary), and the control
 *   page also looks at the live eventLog slice, so a copy made a moment ago shows at once.
 *
 * What these tests prove:
 *   - A recordBackup row gives its moment and size; any other row gives nothing.
 *   - Of the backup the server answered and the ones in the live slice, the newest wins,
 *     whichever side it came from, and no backup at all gives nothing.
 *
 * What these tests deliberately do not cover:
 *   - Writing the row: the server's backupDownloadRoute.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { EventLogEntry } from '../slices/eventLogEntry.js';
import { chooseTheLatestBackup, readBackupOfEventLogEntry } from './latestBackup.js';

/** The row a finished backup of 48 MB at 14:32 (São Paulo) writes. */
function buildBackupRowAt(ts: string, sizeInBytes: number, id: number): EventLogEntry {
  return {
    id,
    ts,
    actor: 'sistema:backup',
    command: 'recordBackup',
    payload: {
      type: 'recordBackup',
      fileName: 'bajaovrlay-2026-11-14-1432.zip',
      sizeInBytes,
      includesRecordings: true,
    },
    result: { status: 'ok' },
  };
}

/** An operator's take of item "Volta mais rápida", which is not a backup. */
function buildTakeRow(id: number): EventLogEntry {
  return {
    id,
    ts: '2026-11-14T17:40:00.000Z',
    actor: 'operador:conexao-7',
    command: 'takeItem',
    payload: { type: 'takeItem', itemId: 'volta-mais-rapida' },
    result: { status: 'ok' },
  };
}

describe('readBackupOfEventLogEntry', () => {
  it('reads the moment and size of a backup row, and nothing of any other row', () => {
    // Arrange: a backup row of 48 MB at 14:32 in São Paulo, and a take.
    const backupRow = buildBackupRowAt('2026-11-14T17:32:00.000Z', 50_331_648, 11);
    const takeRow = buildTakeRow(12);

    // Act: read both.
    const backupOfTheBackupRow = readBackupOfEventLogEntry(backupRow);
    const backupOfTheTakeRow = readBackupOfEventLogEntry(takeRow);

    // Assert: the backup row gives its moment and size, the take nothing.
    expect(backupOfTheBackupRow, 'the backup row names its moment and size').toEqual({
      madeAt: '2026-11-14T17:32:00.000Z',
      sizeInBytes: 50_331_648,
    });
    expect(backupOfTheTakeRow, 'a take is not a backup').toBeUndefined();
  });
});

describe('chooseTheLatestBackup', () => {
  const backupAt1432 = { madeAt: '2026-11-14T17:32:00.000Z', sizeInBytes: 50_331_648 };

  it('takes a backup in the live slice when it is newer than the one the server answered', () => {
    // Arrange: the server answered the 14:32 copy; a 16:05 copy has just arrived live.
    const liveEventLog = [
      buildTakeRow(20),
      buildBackupRowAt('2026-11-14T19:05:00.000Z', 52_428_800, 21),
    ];

    // Act: choose the latest.
    const latestBackup = chooseTheLatestBackup(backupAt1432, liveEventLog);

    // Assert: the 16:05 copy.
    expect(latestBackup, 'the copy just made must win').toEqual({
      madeAt: '2026-11-14T19:05:00.000Z',
      sizeInBytes: 52_428_800,
    });
  });

  it('keeps the backup the server answered when the live slice holds none', () => {
    // Arrange: the 14:32 copy from the server; the live slice only has takes since.
    const liveEventLog = [buildTakeRow(30), buildTakeRow(31)];

    // Act: choose the latest.
    const latestBackup = chooseTheLatestBackup(backupAt1432, liveEventLog);

    // Assert: still the 14:32 copy.
    expect(latestBackup, 'the copy the server read from the database stays').toEqual(backupAt1432);
  });

  it('gives nothing when no backup was ever made', () => {
    // Arrange: a new server: no backup answered, only takes live.
    const liveEventLog = [buildTakeRow(1)];

    // Act: choose the latest.
    const latestBackup = chooseTheLatestBackup(undefined, liveEventLog);

    // Assert: nothing to show.
    expect(latestBackup, 'no backup was ever made').toBeUndefined();
  });
});
