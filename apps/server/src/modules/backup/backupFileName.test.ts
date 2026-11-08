/**
 * The name of a backup zip (apps/server)
 *
 * What this module is for:
 *   The browser saves a backup under the name the server gives it,
 *   bajaovrlay-AAAA-MM-DD-HHMM.zip, onto the operator's USB stick. The time is the
 *   circuit's local time (America/Sao_Paulo), as on the operator's watch, so "the copy of
 *   the 14:30 break" is the file ending in 1432, whatever clock the server's machine or
 *   container runs on (Docker's is UTC).
 *
 * What these tests prove:
 *   - Each moment of the table gets the name below, read in São Paulo's time: the date
 *     follows São Paulo's, not UTC's, around midnight.
 *   - The name has no colon, which Windows refuses in a file name.
 *
 * What these tests deliberately do not cover:
 *   - The zip itself: backupDownloadRoute.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { nameBackupZipFile } from './backupFileName.js';

const nameScenarios = [
  // The session break of the brief: 14:32 in São Paulo is 17:32 UTC.
  {
    name: 'an afternoon break',
    moment: '2026-11-14T17:32:40.000Z',
    expectedName: 'bajaovrlay-2026-11-14-1432.zip',
  },
  // 23:50 in São Paulo is already the next day in UTC: the name keeps São Paulo's date.
  {
    name: 'late at night, after midnight in UTC',
    moment: '2026-11-15T02:50:00.000Z',
    expectedName: 'bajaovrlay-2026-11-14-2350.zip',
  },
  // A single-digit hour and minute are written with their zero.
  {
    name: 'early in the morning',
    moment: '2026-11-15T10:05:00.000Z',
    expectedName: 'bajaovrlay-2026-11-15-0705.zip',
  },
];

describe('nameBackupZipFile', () => {
  it.each(nameScenarios)('names $name as $expectedName', ({ moment, expectedName }) => {
    // Arrange: the moment the backup starts (from the table row).
    const backupMoment = new Date(moment);

    // Act: name its zip.
    const fileName = nameBackupZipFile(backupMoment);

    // Assert: the name in São Paulo's time, with no colon.
    expect(fileName, `the zip made at ${moment} (UTC)`).toBe(expectedName);
    expect(fileName, 'Windows refuses a colon in a file name').not.toContain(':');
  });
});
