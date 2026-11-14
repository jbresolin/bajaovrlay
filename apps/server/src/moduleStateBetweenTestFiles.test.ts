/**
 * Nothing leaks from one server test file to the next (apps/server)
 *
 * What this module is for:
 *   The server's test files share their worker's modules (isolate: false in
 *   vitest.config.ts, BAJAOVRLAY-42): a module imported by one file is not evaluated
 *   again for the next, which cut this project from 103 s to 36 s. That is only safe while
 *   no module keeps state from one call to the next, since that state would carry over
 *   into whichever file runs after. This test reads the code and keeps it that way.
 *
 * What these tests prove:
 *   - The search finds state kept at a module's top level: a `let`, a Map, and any object
 *     made there with `new` (a decoder, a client), whatever its class.
 *   - The server's and the shared package's code keep no such state, except the few
 *     listed below, each with the reason it cannot change an answer.
 *   - No server test file replaces a module with vi.mock, which in a shared module cache
 *     could reach other files.
 *   - testSetup.ts puts the real clock back after a test that faked it and never
 *     restored it (as a failing test would not).
 *
 * What these tests deliberately do not cover:
 *   - State kept inside an object a test made itself (a store, a database): each test
 *     builds its own through a factory (docs/testing-style.md, rule 6), so it is never
 *     shared.
 *   - State hidden in a dependency (Hono, Drizzle, better-sqlite3): none is known, and the
 *     whole suite passing in any order of files is the check for it.
 *   - Live handles a test leaves open (a timer, a socket, a server or database not
 *     closed): they hold no module state, and each test closes what it opened
 *     (onTestFinished, close()); one left open wastes the worker's time, it does not
 *     change another file's answer, and this scan cannot see it.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createTemporaryDataFolder } from './core/boot/temporaryDataFolder.testSupport.js';

const repositoryRoot = join(import.meta.dirname, '../../..');
const serverSourceFolder = join(repositoryRoot, 'apps/server/src');
const sharedSourceFolder = join(repositoryRoot, 'packages/shared/src');

// A line that keeps state at a module's top level: it starts at the first column (inside
// a function it would be indented) with `let` or `var`, makes any object with `new` (a
// Map, a decoder, a client: whatever the class, it may hold state), or makes an array or
// object that could then be changed.
const moduleStatePatterns = [
  /^(export )?(let|var) /,
  /^(export )?const \w+(: [^=]+)? = new \w+/,
  /^(export )?const \w+(: [^=]+)? = (\[\]|\{\});/,
];

// The module-level objects the code makes, and why each cannot carry an answer from one
// test file to the next.
const moduleStateThatCannotLeak = [
  // A cache of compiled JSON Schemas: an entry is reused only for the very schema object
  // it was compiled from, so it changes how fast an answer comes, never the answer.
  'apps/server/src/core/store/graphicDataValidation.ts: compiledDataSchemasByGraphicId',
  // Each shape's bindable paths, built the first time they are asked for (BAJAOVRLAY-45):
  // the list is written in code and frozen, so every call gets the same answer it would
  // have built, only sooner.
  'packages/shared/src/dataShapes/bindablePaths.ts: pathsListedForEachShape',
  // The six below are fixed lookup lists: filled where they are made, never changed.
  'apps/server/src/modules/media/rasterImageSizes.ts: jpegFrameHeaderMarkers',
  'apps/server/src/modules/media/rasterImageSizes.ts: jpegMarkersWithoutLength',
  'apps/server/src/modules/events/reducers/recordDetectedEvents.ts: kindsSupersededByANewerEvent',
  'packages/shared/src/dataShapes/positionsShape.ts: statusesOutOfLapOrder',
  'packages/shared/src/dataSources/httpJsonConfig.ts: headerNamesFetchSetsItself',
  'packages/shared/src/flexMapping/gapsFromLaps.ts: statusesStillInTheRace',
  // Fixed addresses of files: a URL object is never changed after it is made.
  'apps/server/src/readServerVersion.ts: serverPackageJsonUrl',
  'apps/server/src/readBuildId.ts: buildIdFileUrl',
  // A UTF-8 decoder used without `stream: true`: each decode stands alone and keeps
  // nothing for the next.
  'apps/server/src/modules/dataSources/adapters/httpJson/responseBodyWithinCap.ts: utf8Decoder',
  // Number and date formatters of the backup (BAJAOVRLAY-33): their options are fixed
  // where they are made, and each format() call stands alone.
  'apps/server/src/modules/backup/backupFileName.ts: partsOfTheLocalMoment',
  'apps/server/src/modules/backup/backupReadMe.ts: momentAsTheOperatorWritesIt',
  'packages/shared/src/backup/backupSizeText.ts: withNoDecimal',
  'packages/shared/src/backup/backupSizeText.ts: withOneDecimal',
  // The DNS resolver of the NTP and HTTPS time servers (BAJAOVRLAY-62, -76): its options
  // (timeout, tries) are fixed where it is made, and Node's resolver keeps no cache, so
  // each look-up stands alone. Tests hand in their own look-up and never reach it.
  'apps/server/src/core/time/ipv4LookUpThroughCAres.ts: resolverOfTheTimeServers',
  // The São Paulo wall-clock formatter of the schedule triggers (BAJAOVRLAY-64): its options
  // are fixed where it is made, and each formatToParts() call stands alone.
  'apps/server/src/modules/triggers/scheduleMoments.ts: saoPauloWallClockFormatter',
];

/** Every TypeScript file under `folder`, subfolders included, as full paths. */
function listEveryTypeScriptFileUnder(folder: string): string[] {
  const filePaths: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const entryPath = join(folder, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...listEveryTypeScriptFileUnder(entryPath));
    } else if (entry.name.endsWith('.ts')) {
      filePaths.push(entryPath);
    }
  }
  return filePaths;
}

/**
 * Every top-level line of the code (tests left out) under `folder` that keeps state, as
 * "<path from the repository root>: <name>".
 */
function findModuleStateUnder(folder: string): string[] {
  const found: string[] = [];
  const codeFiles = listEveryTypeScriptFileUnder(folder).filter(
    (filePath) => !filePath.endsWith('.test.ts'),
  );
  for (const filePath of codeFiles) {
    const lines = readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const keepsState = moduleStatePatterns.some((pattern) => pattern.test(line));
      if (keepsState) {
        const name = line.replace(/^(export )?(let|var|const) /, '').split(/[:= ]/)[0];
        found.push(`${relative(repositoryRoot, filePath)}: ${name}`);
      }
    }
  }
  return found;
}

describe('the search for module-level state', () => {
  it('finds a top-level let, Map and object of any class, and not the same inside a function', () => {
    // Arrange: a stand-in folder with a counter kept in a `let`, a cache kept in a Map, a
    // timing client made with `new` at the top, and a file whose `let` and Map live inside
    // a function, made fresh at every call.
    const standInFolder = createTemporaryDataFolder();
    mkdirSync(join(standInFolder, 'lapCounting'));
    writeFileSync(
      join(standInFolder, 'lapCounting', 'lapCounter.ts'),
      'let lapsCountedSoFar = 0;\nexport function countLap() { lapsCountedSoFar += 1; }\n',
    );
    writeFileSync(
      join(standInFolder, 'teamNames.ts'),
      'const teamNamesByCar = new Map<number, string>();\n',
    );
    writeFileSync(
      join(standInFolder, 'timingClient.ts'),
      'export const timingSystemClient = new TimingSystemClient("http://cronometragem.local");\n',
    );
    writeFileSync(
      join(standInFolder, 'freshEachCall.ts'),
      'export function readLaps() {\n  let laps = 0;\n  const seen = new Map();\n  return { laps, seen };\n}\n',
    );

    // Act: search it.
    const found = findModuleStateUnder(standInFolder).map((entry) => entry.split(': ')[1]);

    // Assert: the three top-level ones, and nothing from inside the function.
    expect(found.sort(), 'every top-level state must be found, and only those').toEqual([
      'lapsCountedSoFar',
      'teamNamesByCar',
      'timingSystemClient',
    ]);
  });
});

describe('the server and shared code', () => {
  it('keep no state at module level but the listed ones, which cannot leak', () => {
    // Arrange: the code of apps/server/src and packages/shared/src, which the server's
    // tests import.

    // Act: find every module-level state in it.
    const found = [
      ...findModuleStateUnder(serverSourceFolder),
      ...findModuleStateUnder(sharedSourceFolder),
    ];

    // Assert: exactly the listed ones. A new one must be added to the list with the
    // reason it cannot carry an answer from one test file to the next, or be removed.
    expect(
      found.sort(),
      'module-level state would leak between server test files that share their modules',
    ).toEqual([...moduleStateThatCannotLeak].sort());
  });
});

describe('the server test files', () => {
  it('never replace a module with vi.mock', () => {
    // Arrange: every server test file but this one, which names the call.
    const testFiles = listEveryTypeScriptFileUnder(serverSourceFolder)
      .filter((filePath) => filePath.endsWith('.test.ts'))
      .filter((filePath) => !filePath.endsWith('moduleStateBetweenTestFiles.test.ts'));

    // Act: find the ones that call vi.mock or vi.doMock.
    const filesReplacingAModule = testFiles
      .filter((filePath) => /vi\.(do)?[mM]ock\(/.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(repositoryRoot, filePath));

    // Assert: none.
    expect(
      filesReplacingAModule,
      'a module replaced by vi.mock could stay replaced for the next file of the worker',
    ).toEqual([]);
  });
});

// The two tests below run in the order written, on purpose: the second checks what the
// first left behind. This is the one place where a test depends on the one before it.
// { shuffle: false } keeps that order under --sequence.shuffle, where the second could
// otherwise run first and pass without proving anything.
describe(
  'testSetup.ts, after a test that faked the clock and never restored it',
  { shuffle: false },
  () => {
    it('lets a test fake the clock and end without restoring it', () => {
      // Arrange: nothing; the clock is real.

      // Act: fake the clock and end here, as a test that failed halfway would.
      vi.useFakeTimers();

      // Assert: the clock is fake for the rest of this test.
      expect(vi.isFakeTimers(), 'the clock must be fake inside the test that faked it').toBe(true);
    });

    it('gives the next test the real clock again', () => {
      // Arrange: the test above faked the clock and did not restore it.

      // Act: nothing; testSetup.ts ran between the two tests.

      // Assert: the clock is real.
      expect(vi.isFakeTimers(), 'the next test must start on the real clock').toBe(false);
    });
  },
);
