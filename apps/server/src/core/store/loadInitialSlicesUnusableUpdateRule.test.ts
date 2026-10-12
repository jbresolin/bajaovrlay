/**
 * The boot warning for a graphic whose update rule cannot be run (apps/server)
 *
 * What this module is for:
 *   A graphic's manifest may name, in `v_baja.updateRule`, a server rule that every
 *   update of the graphic runs through (the race clock's keeps the clock from jumping).
 *   When the server knows no rule by that name, or the graphic's data schema lacks the
 *   fields the rule works on, the server refuses every update of that graphic. Without
 *   a word in the log, the operator would only find out on air, at the first
 *   "Atualizar". So the boot, which reads every manifest anyway, says it once in the
 *   log, naming the graphic and the reason.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder, both
 * in temporary folders):
 *   - A built graphic whose manifest names an unknown rule is still registered, and the
 *     boot logs exactly one warning naming it, the rule and the reason.
 *   - The same holds for a graphic that names a real rule without declaring the fields
 *     the rule needs; the warning lists the missing fields.
 *   - The race clock (a rule that can be run) and a graphic that names no rule cause no
 *     such warning.
 *
 * What these tests deliberately do not cover:
 *   - That an update of such a graphic is refused, and its pt-BR message;
 *     reducers/updateInstanceDataUnusableUpdateRule.test.ts and
 *     storeCarriesTheClockForward.test.ts cover them.
 *   - The other boot warnings; loadInitialSlicesUnusableSchema.test.ts,
 *     loadInitialSlices.test.ts and loadInitialSlicesGraphicPlacement.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import {
  createGraphicsFolderWithBuiltRaceClock,
  createGraphicsFolderWithBuiltScoreboard,
} from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

const messageOfTheUnusableUpdateRuleWarning =
  'graphic names an update rule that cannot be run; every update of it will be refused';

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

const unusableUpdateRuleScenarios = [
  // A typo in the manifest ("Foward"): the server knows no rule by that name.
  {
    name: 'warns once, naming the scoreboard and the rule the server does not know',
    scoreboardManifest: {
      id: 'baja-scoreboard',
      name: 'Placar',
      main: 'scoreboard.js',
      schema: { type: 'object', properties: { leaderName: { type: 'string' } } },
      v_baja: {
        defaultLayerId: 'fullscreen',
        category: 'scoreboard',
        updateRule: 'carryClockFoward',
      },
    },
    expectedProblem: { kind: 'unknownRule', ruleName: 'carryClockFoward' },
  },
  // A scoreboard copied from the race clock: the rule stayed in v_baja, but a
  // scoreboard's data has none of the four clock fields the rule works on.
  {
    name: 'warns once, listing the fields the scoreboard lacks for the rule it names',
    scoreboardManifest: {
      id: 'baja-scoreboard',
      name: 'Placar',
      main: 'scoreboard.js',
      schema: { type: 'object', properties: { leaderName: { type: 'string' } } },
      v_baja: {
        defaultLayerId: 'fullscreen',
        category: 'scoreboard',
        updateRule: 'carryClockForward',
      },
    },
    expectedProblem: {
      kind: 'schemaPropertiesMissing',
      ruleName: 'carryClockForward',
      missingPropertyKeys: ['referenceTimeMs', 'referenceWallClockMs', 'running', 'clockMode'],
    },
  },
];

describe('a built graphic whose update rule cannot be run', () => {
  it.each(unusableUpdateRuleScenarios)('$name', ({ scoreboardManifest, expectedProblem }) => {
    // Arrange: a built scoreboard, placed on the fullscreen layer, with the scenario's
    // manifest.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltScoreboard(scoreboardManifest);

    // Act: load the slices, as the first boot does.
    const { slices, readRecordedLines } = loadSlicesOnFirstBoot(graphicPackagesFolder);

    // Assert: the scoreboard is in the graphics slice (it can still be taken, and the
    // refusal of its updates can name it), and one warning says what is wrong with it.
    expect(
      slices.graphics.map((graphic) => graphic.id),
      'a graphic with a rule that cannot be run must still be registered',
    ).toEqual(['scoreboard']);
    const unusableUpdateRuleWarnings = readRecordedLines().filter(
      (line) => line.message === messageOfTheUnusableUpdateRuleWarning,
    );
    expect(
      unusableUpdateRuleWarnings,
      'the boot must warn exactly once, naming the graphic and why its rule cannot be run',
    ).toEqual([
      expect.objectContaining({
        level: 'warn',
        graphic_package: 'scoreboard',
        update_rule_problem: expectedProblem,
      }),
    ]);
  });
});

const usableGraphicScenarios = [
  // The race clock names carryClockForward and declares all four clock fields.
  {
    name: 'logs no such warning for the race clock, whose rule can be run',
    createGraphicsFolder: createGraphicsFolderWithBuiltRaceClock,
    expectedGraphicIds: ['race-clock'],
  },
  // Most graphics name no rule at all; there is nothing that could be wrong.
  {
    name: 'logs no such warning for a scoreboard whose manifest names no rule',
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

describe('a built graphic whose updates can be run', () => {
  it.each(usableGraphicScenarios)('$name', ({ createGraphicsFolder, expectedGraphicIds }) => {
    // Arrange: the scenario's graphics folder.
    const graphicPackagesFolder = createGraphicsFolder();

    // Act: load the slices, as the first boot does.
    const { slices, readRecordedLines } = loadSlicesOnFirstBoot(graphicPackagesFolder);

    // Assert: the graphic is registered and the log has no such warning.
    expect(
      slices.graphics.map((graphic) => graphic.id),
      'the graphic must be registered',
    ).toEqual(expectedGraphicIds);
    expect(
      readRecordedLines().filter((line) => line.message === messageOfTheUnusableUpdateRuleWarning),
      'a graphic whose updates can be run must not be warned about',
    ).toEqual([]);
  });
});
