/**
 * Every read of the wall clock left in the server, on a list (apps/server)
 *
 * What this module is for:
 *   A moment used for clock math must come from the server clock (serverClock.ts),
 *   which never follows a step of the wall clock. A `Date.now()` or a `new Date()` added
 *   anywhere else in the server would quietly bring the step back. The few reads of the
 *   wall clock that remain are times a person reads (the name of a backup file), plus
 *   the server clock's own anchor; each is listed below with its reason.
 *
 * What these tests prove (reading the server's source files as text):
 *   - Every `Date.now()` and every `new Date()` with nothing between the brackets in
 *     apps/server/src, outside tests and test support, is in a file on the list, as
 *     many times as the list says.
 *   - Every file on the list still reads the wall clock, so the list never keeps a
 *     reason that no longer applies.
 *
 * What these tests deliberately do not cover:
 *   - `new Date(someMoment)`, which reads no clock: it turns a moment already known into
 *     a Date.
 *   - The pages and the graphics; they read the server's time through
 *     @bajaovrlay/shared/clock (serverAlignedTime.test.ts).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** apps/server/src, the folder whose files are read. */
const serverSourceFolder = fileURLToPath(new URL('../../', import.meta.url));

/** The reads of the wall clock the server may keep, with how many and why. */
const wallClockReadsAllowed = [
  // The server clock's anchor: it reads the wall clock once when created, and again
  // each minute to measure the drift the re-anchoring logs and covers.
  { file: 'core/time/serverClock.ts', count: 1, reason: 'the anchor and the drift measure' },
  // A backup's file name and its "Cópia feita às": a person reads them, on the disk and
  // in the control page; a step makes them a second off, which nobody sees.
  { file: 'modules/backup/backupDownloads.ts', count: 1, reason: 'a time a person reads' },
  // The automatic copy of the database made before a migration: its file name.
  { file: 'core/db/databaseBackup.ts', count: 1, reason: 'a file name a person reads' },
  // The 60 s window that keeps a refused D200 poll to one warning a minute in the log a
  // person reads; a step makes one warning come a second early or late.
  { file: 'core/http/pollsByButtonsLogging.ts', count: 1, reason: 'a log window a person reads' },
];

/** Lists every .ts file under a folder, tests and test support left out. */
function listServerSourceFiles(folder: string): string[] {
  const filePaths: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const entryPath = join(folder, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...listServerSourceFiles(entryPath));
      continue;
    }
    const isTypeScript = entry.name.endsWith('.ts');
    const isTestOrTestSupport =
      entry.name.endsWith('.test.ts') || entry.name.endsWith('.testSupport.ts');
    if (isTypeScript && !isTestOrTestSupport) {
      filePaths.push(entryPath);
    }
  }
  return filePaths;
}

/** Counts `Date.now()` and `new Date()` in one file's text. */
function countWallClockReads(fileText: string): number {
  const dateNowCalls = fileText.split('Date.now()').length - 1;
  const emptyNewDates = fileText.split('new Date()').length - 1;
  return dateNowCalls + emptyNewDates;
}

/** Every server file that reads the wall clock, with how many times, by path from src. */
function findWallClockReadsInTheServer(): { file: string; count: number }[] {
  const reads: { file: string; count: number }[] = [];
  for (const filePath of listServerSourceFiles(serverSourceFolder)) {
    const count = countWallClockReads(readFileSync(filePath, 'utf8'));
    if (count > 0) {
      const file = relative(serverSourceFolder, filePath).split('\\').join('/');
      reads.push({ file, count });
    }
  }
  return reads;
}

describe('reads of the wall clock in the server', () => {
  it('are all on the list of person-facing times, as many as it says', () => {
    // Arrange: the list, without its reasons.
    const readsOnTheList = wallClockReadsAllowed.map(({ file, count }) => ({ file, count }));

    // Act: find every read in the server's source.
    const readsFound = findWallClockReadsInTheServer();

    // Assert: the same files, the same counts. A new read must use the server clock
    // (readServerTime) or be added to the list with its reason.
    expect(
      readsFound.sort((first, second) => first.file.localeCompare(second.file)),
      'a moment used for clock math must come from the server clock, not Date.now()',
    ).toEqual(readsOnTheList.sort((first, second) => first.file.localeCompare(second.file)));
  });
});
