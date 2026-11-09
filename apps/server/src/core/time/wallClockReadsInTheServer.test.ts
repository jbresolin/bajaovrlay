/**
 * Every read of the wall clock left in the server, on a list (apps/server)
 *
 * What this module is for:
 *   A moment used for clock math must come from the server clock (serverClock.ts), which
 *   counts on monotonic time kept on real time by NTP and never follows a step of the
 *   wall clock. A read of the wall clock added anywhere else in the server would quietly
 *   bring the step back (BAJAOVRLAY-62). The few reads that remain are times a person
 *   reads (the name of a backup file), the server clock's own start, and one page-only
 *   fallback in the shared code; each is listed below with its reason.
 *
 * What these tests prove (reading source files as text, comments taken out):
 *   - The count finds every form of a read: `Date.now()`, `Date.now` passed as a
 *     function, spaced forms, `new Date()`, `new Date` without brackets and `Date()`;
 *     and none in a comment, nor in `new Date(someMoment)`.
 *   - Every read in apps/server/src and in packages/shared/src (whose code the server
 *     runs), outside tests and test support, is in a file on the list, as many times as
 *     the list says; and every file on the list still reads the wall clock, so the list
 *     never keeps a reason that no longer applies.
 *
 * What these tests deliberately do not cover:
 *   - Which shared file the server really imports: all of packages/shared is read, and a
 *     page-only read there goes on the list with its reason.
 *   - The pages and the graphics; they read the server's time through
 *     @bajaovrlay/shared/clock (serverAlignedTime.test.ts).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** The two folders whose files are read, each with the name it goes by on the list. */
const foldersRead = [
  { name: 'apps/server/src', folder: fileURLToPath(new URL('../../', import.meta.url)) },
  {
    name: 'packages/shared/src',
    folder: fileURLToPath(new URL('../../../../../packages/shared/src/', import.meta.url)),
  },
];

/** The reads of the wall clock the server may keep, with how many and why. */
const wallClockReadsAllowed = [
  // The server clock starts on the wall clock, read once when it is created; NTP steps
  // it to real time at boot, and nothing reads the wall clock after that.
  { file: 'apps/server/src/core/time/serverClock.ts', count: 1, reason: 'the start, before NTP' },
  // A backup's file name and its "Cópia feita às": a person reads them, on the disk and
  // in the control page; a step makes them a second off, which nobody sees.
  {
    file: 'apps/server/src/modules/backup/backupDownloads.ts',
    count: 1,
    reason: 'a time a person reads',
  },
  // The automatic copy of the database made before a migration: its file name.
  {
    file: 'apps/server/src/core/db/databaseBackup.ts',
    count: 1,
    reason: 'a file name a person reads',
  },
  // The 60 s window that keeps a refused D200 poll to one warning a minute in the log a
  // person reads; a step makes one warning come a second early or late.
  {
    file: 'apps/server/src/core/http/pollsByButtonsLogging.ts',
    count: 1,
    reason: 'a log window a person reads',
  },
  // A page with no alignment yet (a graphic's preview page) reads its own clock. Pages
  // only: the server never calls readServerAlignedTimeMs.
  {
    file: 'packages/shared/src/clock/serverAlignedTime.ts',
    count: 1,
    reason: 'a page before its first alignment',
  },
];

/** Lists every .ts file under a folder, tests and test support left out. */
function listSourceFiles(folder: string): string[] {
  const filePaths: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const entryPath = join(folder, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...listSourceFiles(entryPath));
      continue;
    }
    const isTypeScript = entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts');
    const isTestOrTestSupport =
      entry.name.endsWith('.test.ts') || entry.name.endsWith('.testSupport.ts');
    if (isTypeScript && !isTestOrTestSupport) {
      filePaths.push(entryPath);
    }
  }
  return filePaths;
}

/**
 * The text without its comments: block comments, and line comments that start a line or
 * follow a space (so the `//` of an address such as `http://` in a string is kept).
 */
function removeComments(fileText: string): string {
  const withoutBlockComments = fileText.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(^|\s)\/\/.*$/gm, '$1');
}

// Each form a read of the wall clock can take; spaces are allowed wherever TypeScript
// allows them.
const wallClockReadPatterns = [
  // Date.now, called or passed as a function: `Date.now()`, `Date . now`, `readNow = Date.now`.
  /\bDate\s*\.\s*now\b/g,
  // A Date of now: `new Date()`, `new Date( )`, or `new Date` with no brackets at all.
  /\bnew\s+Date\b(?!\s*\(\s*[^\s)])/g,
  // `Date()` without `new`, which gives now as text.
  /(?<![\w.]|new\s+)\bDate\s*\(\s*\)/g,
];

/** Counts the reads of the wall clock in one file's text, comments left out. */
function countWallClockReads(fileText: string): number {
  const code = removeComments(fileText);
  let readsFound = 0;
  for (const pattern of wallClockReadPatterns) {
    readsFound += code.match(pattern)?.length ?? 0;
  }
  return readsFound;
}

/** Every file that reads the wall clock, with how many times, by its path from the repo. */
function findWallClockReads(): { file: string; count: number }[] {
  const reads: { file: string; count: number }[] = [];
  for (const { name, folder } of foldersRead) {
    for (const filePath of listSourceFiles(folder)) {
      const count = countWallClockReads(readFileSync(filePath, 'utf8'));
      if (count > 0) {
        const pathInTheFolder = relative(folder, filePath).split('\\').join('/');
        reads.push({ file: `${name}/${pathInTheFolder}`, count });
      }
    }
  }
  return reads;
}

const codeScenarios = [
  // The plain call.
  { name: '`Date.now()`', code: 'const takenAtMs = Date.now();', reads: 1 },
  // Passed as a function: it reads the wall clock every time it is called.
  { name: '`Date.now` passed as a function', code: 'const readNowMs = Date.now;', reads: 1 },
  // Spaced and split over lines, as a formatter could leave it.
  { name: 'a spaced `Date . now ()`', code: 'const takenAtMs = Date\n  . now ();', reads: 1 },
  // The Date of now, with brackets, spaced brackets, or none.
  { name: '`new Date()`', code: 'const takenAt = new Date();', reads: 1 },
  { name: '`new Date( )`', code: 'const takenAt = new Date( );', reads: 1 },
  { name: '`new Date` without brackets', code: 'const takenAt = new Date;', reads: 1 },
  // `Date()` without `new` gives now as text.
  { name: '`Date()` without new', code: 'const takenAtText = Date();', reads: 1 },
  // A moment already known turned into a Date reads no clock.
  {
    name: 'no read in `new Date(takenAtMs)`',
    code: 'const takenAt = new Date(takenAtMs);',
    reads: 0,
  },
  // Comments say what not to do; they do nothing.
  {
    name: 'no read in comments',
    code: '// never Date.now() here\n/* nor new Date() */\nconst address = "http://a//b";',
    reads: 0,
  },
];

describe('reads of the wall clock in the server', () => {
  it.each(codeScenarios)('counts $name', ({ code, reads }) => {
    // Arrange: one line of code, as the row writes it.

    // Act: count the reads in it.
    const readsFound = countWallClockReads(code);

    // Assert: as the row says.
    expect(readsFound, 'every form of a read must count, and nothing else').toBe(reads);
  });

  it('are all on the list, as many as it says', () => {
    // Arrange: the list, without its reasons.
    const readsOnTheList = wallClockReadsAllowed.map(({ file, count }) => ({ file, count }));

    // Act: find every read in the server's source and in the shared code it runs.
    const readsFound = findWallClockReads();

    // Assert: the same files, the same counts. A new read must use the server clock
    // (readServerTime) or be added to the list with its reason.
    expect(
      readsFound.sort((first, second) => first.file.localeCompare(second.file)),
      'a moment used for clock math must come from the server clock, not the wall clock',
    ).toEqual(readsOnTheList.sort((first, second) => first.file.localeCompare(second.file)));
  });
});
