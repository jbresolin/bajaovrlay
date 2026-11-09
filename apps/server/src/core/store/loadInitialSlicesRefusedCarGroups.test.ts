/**
 * The boot warning for a graphic whose car groups are refused (apps/server)
 *
 * What this module is for:
 *   A graphic whose fields describe one car declares them as a car group in
 *   `v_baja.carGroups` (BAJAOVRLAY-66), so the item editor fills them by choosing the car
 *   once. A group the shared check refuses (a misspelt field, an unknown meaning) is
 *   ignored by the control page, which then shows the fields one by one, and nobody would
 *   know why. The boot, which reads every manifest anyway, says so once in the log.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder, both
 * in temporary folders):
 *   - A built graphic whose group names a field its schema lacks is still registered, and
 *     the boot logs exactly one warning naming it and the problem.
 *   - A graphic whose group is right, and one with no group, cause no such warning.
 *
 * What these tests deliberately do not cover:
 *   - Each refusal of the check; carGroupsOfManifest.test.ts in packages/shared.
 *   - The other boot warnings: loadInitialSlicesUnknownStepCounter.test.ts and the others.
 */
import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltScoreboard } from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

const messageOfTheRefusedCarGroupsWarning =
  'graphic declares car groups the check refuses; its fields are shown one by one';

/** Boots the slices on a brand-new database with a stand-in team card of these groups. */
function bootWithAStandInTeamCard(carGroups: unknown) {
  const graphicPackagesFolder = createGraphicsFolderWithBuiltScoreboard({
    id: 'baja-scoreboard',
    name: 'Placar',
    main: 'scoreboard.js',
    schema: {
      type: 'object',
      properties: {
        carNumber: { type: 'integer', title: 'Carro' },
        teamName: { type: 'string', title: 'Equipe' },
      },
    },
    v_baja: {
      defaultLayerId: 'lower-third',
      category: 'team',
      ...(carGroups === undefined ? {} : { carGroups }),
    },
  });
  const { logger, readRecordedLines } = createRecordingLogger();
  const slices = loadInitialSlices({
    database: openTemporaryDatabase().database,
    graphicPackagesFolder,
    logger,
    readCurrentTime: () => new Date('2026-11-08T08:00:00.000Z'),
  });
  const warnings = readRecordedLines().filter(
    (line) => line.message === messageOfTheRefusedCarGroupsWarning,
  );
  return { slices, warnings };
}

describe('a built graphic that declares car groups', () => {
  it('warns once, naming the graphic and what the check refused', () => {
    // Arrange: a group whose second field is misspelt ("teamNam").
    const carGroups = [
      { id: 'car', label: 'Carro', fields: { carNumber: 'carNumber', teamNam: 'teamName' } },
    ];

    // Act: boot with it.
    const { slices, warnings } = bootWithAStandInTeamCard(carGroups);

    // Assert: still registered, and one warning naming it and the problem.
    expect(
      slices.graphics.map((graphic) => graphic.id),
      'the graphic must still be registered',
    ).toEqual(['scoreboard']);
    expect(warnings, 'the boot must warn exactly once, naming the graphic and the problem').toEqual(
      [
        expect.objectContaining({
          level: 'warn',
          graphic_package: 'scoreboard',
          car_group_problems: [
            'the car group "car" names the field "teamNam", which the data schema does not have',
          ],
        }),
      ],
    );
  });

  const scenariosWithoutWarning = [
    // A group the check passes: the card's car and team.
    {
      name: 'logs no such warning for a group the check passes',
      carGroups: [
        { id: 'car', label: 'Carro', fields: { carNumber: 'carNumber', teamName: 'teamName' } },
      ],
    },
    // Most graphics declare no group at all.
    { name: 'logs no such warning for a graphic with no group', carGroups: undefined },
  ];

  it.each(scenariosWithoutWarning)('$name', ({ carGroups }) => {
    // Arrange: nothing more; the row says which groups the stand-in declares.

    // Act: boot with it.
    const { warnings } = bootWithAStandInTeamCard(carGroups);

    // Assert: no warning about car groups.
    expect(warnings, 'nothing is wrong, so nothing is said').toEqual([]);
  });
});
