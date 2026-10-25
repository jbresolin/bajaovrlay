/**
 * The boot warning for a graphic whose step counter the server does not know (apps/server)
 *
 * What this module is for:
 *   A graphic whose steps depend on its data (the bracket, BAJAOVRLAY-25) says
 *   `stepCount: -1` in its manifest and names, in `v_baja.stepCounter`, the shared step
 *   counter that counts them (packages/shared/src/steps/stepCounters.ts). A name the
 *   server does not know (a typo) reads as one step, so Camadas would never offer
 *   "Próximo" for it, and nobody would know why until the walk. The boot, which reads
 *   every manifest anyway, says so once in the log.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder, both
 * in temporary folders):
 *   - A built graphic that names an unknown counter is still registered, and the boot
 *     logs exactly one warning naming it and the counter.
 *   - A graphic that names the bracket's real counter, and one that names none, cause no
 *     such warning.
 *
 * What these tests deliberately do not cover:
 *   - Counting the steps: packages/shared/src/steps/graphicSteps.test.ts.
 *   - The other boot warnings: loadInitialSlicesUnusableUpdateRule.test.ts and the others.
 */
import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltScoreboard } from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

const messageOfTheUnknownStepCounterWarning =
  'graphic names a step counter the server does not know; it will have one step';

/** Boots the slices on a brand-new database with a stand-in graphic of this v_baja. */
function bootWithAStandInBracket(stepCounter: string | undefined) {
  const graphicPackagesFolder = createGraphicsFolderWithBuiltScoreboard({
    id: 'baja-scoreboard',
    name: 'Placar',
    main: 'scoreboard.js',
    stepCount: -1,
    v_baja: {
      defaultLayerId: 'fullscreen',
      category: 'standings',
      ...(stepCounter === undefined ? {} : { stepCounter }),
    },
  });
  const { logger, readRecordedLines } = createRecordingLogger();
  const slices = loadInitialSlices({
    database: openTemporaryDatabase().database,
    graphicPackagesFolder,
    logger,
    readCurrentTime: () => new Date('2026-10-31T08:00:00.000Z'),
  });
  const warnings = readRecordedLines().filter(
    (line) => line.message === messageOfTheUnknownStepCounterWarning,
  );
  return { slices, warnings };
}

describe('a built graphic that names a step counter', () => {
  it('warns once, naming the graphic and the counter the server does not know', () => {
    // Arrange: nothing more; the stand-in names "bracketStep", one letter short.

    // Act: boot with it.
    const { slices, warnings } = bootWithAStandInBracket('bracketStep');

    // Assert: still registered, and one warning naming it and the counter.
    expect(
      slices.graphics.map((graphic) => graphic.id),
      'the graphic must still be registered',
    ).toEqual(['scoreboard']);
    expect(warnings, 'the boot must warn exactly once, naming the graphic and the counter').toEqual(
      [
        expect.objectContaining({
          level: 'warn',
          graphic_package: 'scoreboard',
          step_counter: 'bracketStep',
        }),
      ],
    );
  });

  const scenariosWithoutWarning = [
    // The bracket's own counter: the server knows it.
    { name: 'logs no such warning for the bracket’s counter', stepCounter: 'bracketSteps' },
    // Most graphics name no counter at all.
    { name: 'logs no such warning for a graphic that names no counter', stepCounter: undefined },
  ];

  it.each(scenariosWithoutWarning)('$name', ({ stepCounter }) => {
    // Arrange: nothing more; the row says which counter the stand-in names.

    // Act: boot with it.
    const { warnings } = bootWithAStandInBracket(stepCounter);

    // Assert: no warning about a step counter.
    expect(warnings, 'nothing is wrong, so nothing is said').toEqual([]);
  });
});
