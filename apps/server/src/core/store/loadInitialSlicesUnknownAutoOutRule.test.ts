/**
 * The boot warning for a graphic whose auto-out rule the server does not know (apps/server)
 *
 * What this module is for:
 *   A graphic that leaves by itself when its data says so (the plain sponsor roll's one
 *   pass, BAJAOVRLAY-64) names, in `v_baja.autoOutRule`, the server's rule that works out how
 *   long a take stays (core/store/autoOutRules.ts). A name the server does not know (a typo)
 *   means no auto-out at all, so the roll would stay on its last sponsor until someone clears
 *   it, and nobody would know why. The boot, which reads every manifest anyway, says so once
 *   in the log, as it does for a step counter it does not know.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder):
 *   - A built graphic that names an unknown rule is still registered, and the boot logs
 *     exactly one warning naming it and the rule.
 *   - A graphic that names the plain roll's real rule, and one that names none, cause no
 *     such warning.
 *
 * What these tests deliberately do not cover:
 *   - The rule itself; plainSponsorRollAutoOut.test.ts.
 *   - The other boot warnings: loadInitialSlicesUnknownStepCounter.test.ts and the others.
 */
import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltScoreboard } from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

const messageOfTheUnknownAutoOutRuleWarning =
  'graphic names an auto-out rule the server does not know; it will not leave by itself';

/** Boots the slices on a brand-new database with a stand-in graphic of this auto-out rule. */
function bootWithAStandInRoll(autoOutRule: string | undefined) {
  const graphicPackagesFolder = createGraphicsFolderWithBuiltScoreboard({
    id: 'baja-scoreboard',
    name: 'Placar',
    main: 'scoreboard.js',
    v_baja: {
      defaultLayerId: 'fullscreen',
      category: 'sponsor',
      ...(autoOutRule === undefined ? {} : { autoOutRule }),
    },
  });
  const { logger, readRecordedLines } = createRecordingLogger();
  const slices = loadInitialSlices({
    database: openTemporaryDatabase().database,
    graphicPackagesFolder,
    logger,
    readCurrentTime: () => new Date('2026-11-10T08:00:00.000Z'),
  });
  const warnings = readRecordedLines().filter(
    (line) => line.message === messageOfTheUnknownAutoOutRuleWarning,
  );
  return { slices, warnings };
}

describe('a built graphic that names an auto-out rule', () => {
  it('warns once, naming the graphic and the rule the server does not know', () => {
    // Arrange: a stand-in roll whose rule name has a typo.
    const typedRuleName = 'onePlainSponsorRolPass';

    // Act: boot with it.
    const { slices, warnings } = bootWithAStandInRoll(typedRuleName);

    // Assert: registered all the same, and one warning naming both.
    expect(
      slices.graphics.map((graphic) => graphic.id),
      'the graphic is still registered',
    ).toContain('scoreboard');
    expect(warnings, 'one warning naming the graphic and the rule').toEqual([
      expect.objectContaining({ graphic_package: 'scoreboard', auto_out_rule: typedRuleName }),
    ]);
  });

  const namesThatNeedNoWarning = [
    // The plain sponsor roll's own rule.
    { name: 'stays quiet for the plain roll’s rule', autoOutRule: 'onePlainSponsorRollPass' },
    // Most graphics name none: they leave when cleared or by their item's delay.
    { name: 'stays quiet for a graphic that names none', autoOutRule: undefined },
  ];

  it.each(namesThatNeedNoWarning)('$name', ({ autoOutRule }) => {
    // Arrange: nothing beyond the row's rule name.

    // Act: boot with it.
    const { warnings } = bootWithAStandInRoll(autoOutRule);

    // Assert: no warning.
    expect(warnings, 'a known rule, or none, needs no warning').toEqual([]);
  });
});
