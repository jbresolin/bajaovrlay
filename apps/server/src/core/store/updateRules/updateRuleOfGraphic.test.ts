/**
 * Which update rule a graphic's manifest asks for (apps/server)
 *
 * What this module is for:
 *   A graphic's manifest may name, in `v_baja.updateRule`, a server rule that runs on
 *   every update of its data on air (the race clock names `carryClockForward`). The
 *   name is free text in a JSON file, so it can be mistyped, and a rule only makes sense
 *   for a graphic whose data has the fields the rule works on. This module reads the
 *   manifest and answers: no rule, a rule that can be run, or why it cannot.
 *
 * What these tests prove:
 *   - The race clock's manifest gets the carryClockForward rule.
 *   - A manifest that names no rule gets none; that is the usual graphic.
 *   - A name the server does not know is reported as an unknown rule, with the name.
 *   - A manifest that names carryClockForward but whose data schema lacks fields the
 *     rule needs (or has no schema at all) is reported, with the missing fields listed.
 *
 * What these tests deliberately do not cover:
 *   - What carryClockForward does; carryClockForward.test.ts covers it.
 *   - The boot warning and the refused update that follow from a rule that cannot be
 *     run; loadInitialSlicesUnusableUpdateRule.test.ts and
 *     reducers/updateInstanceDataUnusableUpdateRule.test.ts cover them.
 */
import type { Graphic } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { raceClockManifestForTests } from '../builtGraphicsFolder.testSupport.js';
import { chooseUpdateRuleOfGraphic } from './updateRuleOfGraphic.js';

/** Builds a registered graphic on the fullscreen layer holding the given manifest. */
function buildGraphicWithManifest(graphicId: string, manifest: Graphic['manifest']): Graphic {
  return {
    id: graphicId,
    manifest,
    defaultLayerId: 'fullscreen',
    category: 'other',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

describe('chooseUpdateRuleOfGraphic, when the rule can be run or there is none', () => {
  it('gives the race clock the carryClockForward rule', () => {
    // Arrange: the race clock, whose manifest names carryClockForward and declares the
    // four clock fields.
    const raceClock = buildGraphicWithManifest('race-clock', raceClockManifestForTests);

    // Act: ask which rule its updates run through.
    const choice = chooseUpdateRuleOfGraphic(raceClock);

    // Assert: a usable rule, and it is the one the manifest named.
    expect(choice.status, 'the race clock rule must be usable').toBe('usable');
    expect(
      choice.status === 'usable' ? choice.rule.name : undefined,
      'the rule chosen must be the one the manifest names',
    ).toBe('carryClockForward');
  });

  it('gives no rule to a graphic whose manifest names none', () => {
    // Arrange: team 42's lower third, with no v_baja field at all.
    const lowerThird = buildGraphicWithManifest('team-lower-third', {
      id: 'baja-team-lower-third',
      name: 'Tarja de equipe',
      main: 'tarja.js',
    });

    // Act: ask which rule its updates run through.
    const choice = chooseUpdateRuleOfGraphic(lowerThird);

    // Assert: none, so its updates are laid over the data on air as they come.
    expect(choice, 'a graphic that names no rule must get none').toEqual({ status: 'noRule' });
  });
});

const scenariosWhereTheRuleCannotBeRun: Array<{
  name: string;
  manifest: Graphic['manifest'];
  expectedProblem: object;
}> = [
  // A typo in the manifest ("Foward"): running some other rule, or none, would put on
  // air something the graphic's author did not ask for.
  {
    name: 'reports an unknown rule when the name is mistyped',
    manifest: {
      ...raceClockManifestForTests,
      v_baja: { defaultLayerId: 'clock', category: 'clock', updateRule: 'carryClockFoward' },
    },
    expectedProblem: { kind: 'unknownRule', ruleName: 'carryClockFoward' },
  },
  // A scoreboard copied from the race clock: the rule was left in v_baja, but the data
  // has none of the clock's fields.
  {
    name: 'reports all four clock fields missing for a scoreboard that kept the rule',
    manifest: {
      id: 'baja-scoreboard',
      name: 'Placar',
      main: 'scoreboard.js',
      schema: { type: 'object', properties: { leaderName: { type: 'string' } } },
      v_baja: { defaultLayerId: 'fullscreen', updateRule: 'carryClockForward' },
    },
    expectedProblem: {
      kind: 'schemaPropertiesMissing',
      ruleName: 'carryClockForward',
      missingPropertyKeys: ['referenceTimeMs', 'referenceWallClockMs', 'running', 'clockMode'],
    },
  },
  // One field renamed in the schema ("isRunning"): only that one is reported.
  {
    name: 'reports only the field that is missing when the other three are declared',
    manifest: {
      id: 'baja-pit-clock',
      name: 'Relógio de box',
      main: 'pit-clock.js',
      schema: {
        type: 'object',
        properties: {
          clockMode: { type: 'string' },
          referenceTimeMs: { type: 'integer' },
          referenceWallClockMs: { type: 'integer' },
          isRunning: { type: 'boolean' },
        },
      },
      v_baja: { defaultLayerId: 'clock', updateRule: 'carryClockForward' },
    },
    expectedProblem: {
      kind: 'schemaPropertiesMissing',
      ruleName: 'carryClockForward',
      missingPropertyKeys: ['running'],
    },
  },
  // No data schema at all: nothing is declared, so everything the rule needs is missing.
  {
    name: 'reports all four clock fields missing when the manifest has no data schema',
    manifest: {
      id: 'baja-pit-clock',
      name: 'Relógio de box',
      main: 'pit-clock.js',
      v_baja: { defaultLayerId: 'clock', updateRule: 'carryClockForward' },
    },
    expectedProblem: {
      kind: 'schemaPropertiesMissing',
      ruleName: 'carryClockForward',
      missingPropertyKeys: ['referenceTimeMs', 'referenceWallClockMs', 'running', 'clockMode'],
    },
  },
];

describe('chooseUpdateRuleOfGraphic, when the rule the manifest names cannot be run', () => {
  it.each(scenariosWhereTheRuleCannotBeRun)('$name', ({ manifest, expectedProblem }) => {
    // Arrange: a registered graphic with the scenario's manifest.
    const graphic = buildGraphicWithManifest('pit-clock', manifest);

    // Act: ask which rule its updates run through.
    const choice = chooseUpdateRuleOfGraphic(graphic);

    // Assert: the rule cannot be run, and the reason says what to correct in the manifest.
    expect(choice, 'the answer must say why the rule cannot be run').toEqual({
      status: 'unusable',
      problem: expectedProblem,
    });
  });
});
