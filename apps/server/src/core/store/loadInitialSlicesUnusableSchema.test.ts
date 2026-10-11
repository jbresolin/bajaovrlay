/**
 * The boot warning for a graphic whose data schema cannot be used (apps/server)
 *
 * What this module is for:
 *   A graphic's manifest may carry `schema`, a JSON Schema of the data the graphic
 *   shows, and the server checks every take and update against it. When that schema is
 *   itself broken (not a usable JSON Schema), the server cannot check anything, so it
 *   refuses every take of that graphic. Without a word in the log, the operator would
 *   only find out on air, at the first take. So the boot, which reads every manifest
 *   anyway, says it once in the log, naming the graphic.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder, both
 * in temporary folders):
 *   - A built graphic whose schema says `type: "texto"` is still registered, and the
 *     boot logs exactly one warning naming it.
 *   - A graphic with a good schema (the race clock) and a graphic with no schema at all
 *     cause no such warning.
 *
 * What these tests deliberately do not cover:
 *   - That a take or an update of such a graphic is refused; graphicDataValidation.test.ts
 *     covers the answer and the reducer tests cover the refusal.
 *   - The other boot warnings (unbuilt package, no default layer);
 *     loadInitialSlices.test.ts and loadInitialSlicesGraphicPlacement.test.ts cover them.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import {
  createGraphicsFolderWithBuiltRaceClock,
  createGraphicsFolderWithUnbuiltRaceClock,
} from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

const messageOfTheUnusableSchemaWarning =
  'graphic has a data schema that cannot be used; every take of it will be refused';

/**
 * Creates a graphics folder holding one built package, `scoreboard`, with the given
 * manifest (and the race clock's source without a build). Returns the folder's path.
 */
function createGraphicsFolderWithBuiltScoreboard(scoreboardManifest: object): string {
  const graphicPackagesFolder = createGraphicsFolderWithUnbuiltRaceClock();
  const scoreboardDistFolder = join(graphicPackagesFolder, 'scoreboard', 'dist');
  mkdirSync(scoreboardDistFolder, { recursive: true });
  writeFileSync(
    join(scoreboardDistFolder, 'scoreboard.ograf.json'),
    JSON.stringify(scoreboardManifest),
  );
  return graphicPackagesFolder;
}

/** Boots the slices on a brand-new database, with a logger whose lines can be read. */
function loadSlicesOnFirstBoot(graphicPackagesFolder: string) {
  const { logger, readRecordedLines } = createRecordingLogger();
  const slices = loadInitialSlices({
    database: openTemporaryDatabase().database,
    graphicPackagesFolder,
    logger,
    readCurrentTime: () => new Date('2026-10-09T08:00:00.000Z'),
  });
  return { slices, readRecordedLines };
}

describe('a built graphic whose data schema cannot be used', () => {
  it('is still registered, and the boot logs one warning naming it', () => {
    // Arrange: a built scoreboard, placed on the fullscreen layer, whose schema says the
    // leader's name is of type "texto", which is not a JSON Schema type.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltScoreboard({
      id: 'baja-scoreboard',
      name: 'Placar',
      main: 'scoreboard.js',
      schema: { type: 'object', properties: { leaderName: { type: 'texto' } } },
      v_baja: { defaultLayerId: 'fullscreen', category: 'scoreboard' },
    });

    // Act: load the slices, as the first boot does.
    const { slices, readRecordedLines } = loadSlicesOnFirstBoot(graphicPackagesFolder);

    // Assert: the scoreboard is in the graphics slice (so the control page can show it
    // and the refusal can name it), and one warning in the log names the package.
    expect(
      slices.graphics.map((graphic) => graphic.id),
      'a graphic with a broken schema must still be registered, not silently dropped',
    ).toEqual(['scoreboard']);
    const unusableSchemaWarnings = readRecordedLines().filter(
      (line) => line.message === messageOfTheUnusableSchemaWarning,
    );
    expect(
      unusableSchemaWarnings,
      'the boot must warn exactly once, naming the graphic whose takes will be refused',
    ).toEqual([expect.objectContaining({ level: 'warn', graphic_package: 'scoreboard' })]);
  });
});

const usableGraphicScenarios = [
  // The race clock's real schema, form hints (`gddType`) included: it compiles.
  {
    name: 'logs no such warning for the race clock, whose schema is good',
    createGraphicsFolder: createGraphicsFolderWithBuiltRaceClock,
    expectedGraphicIds: ['race-clock'],
  },
  // A graphic with no schema accepts any data; there is nothing that could be broken.
  {
    name: 'logs no such warning for a scoreboard whose manifest has no schema',
    createGraphicsFolder: () =>
      createGraphicsFolderWithBuiltScoreboard({
        id: 'baja-scoreboard',
        name: 'Placar',
        main: 'scoreboard.js',
        v_baja: { defaultLayerId: 'fullscreen', category: 'scoreboard' },
      }),
    expectedGraphicIds: ['scoreboard'],
  },
];

describe('a built graphic whose data can be checked', () => {
  it.each(usableGraphicScenarios)('$name', ({ createGraphicsFolder, expectedGraphicIds }) => {
    // Arrange: the scenario's graphics folder.
    const graphicPackagesFolder = createGraphicsFolder();

    // Act: load the slices, as the first boot does.
    const { slices, readRecordedLines } = loadSlicesOnFirstBoot(graphicPackagesFolder);

    // Assert: the graphic is registered and the log has no unusable-schema warning.
    expect(
      slices.graphics.map((graphic) => graphic.id),
      'the graphic must be registered',
    ).toEqual(expectedGraphicIds);
    expect(
      readRecordedLines().filter((line) => line.message === messageOfTheUnusableSchemaWarning),
      'a graphic whose data can be checked must not be warned about',
    ).toEqual([]);
  });
});
