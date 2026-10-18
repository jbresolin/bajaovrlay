/**
 * updateInstanceData for a graphic whose update rule cannot be run (apps/server)
 *
 * What this module is for:
 *   A graphic's manifest may name a server rule that every update of it runs through
 *   (`v_baja.updateRule`). When the server knows no rule by that name, or the graphic's
 *   data schema lacks the fields the rule works on, the server cannot tell what an
 *   update should put on air. Applying the update without the rule would do what the
 *   graphic's author asked not to happen (a clock that jumps), so every update of that
 *   graphic is refused, with a pt-BR message saying what to correct in the manifest.
 *
 * What these tests prove:
 *   - An update of a graphic whose manifest names an unknown rule is refused, naming
 *     the graphic and the rule, and nothing changes.
 *   - An update of a graphic whose schema lacks fields the rule needs is refused,
 *     naming the missing fields.
 *   - Even an update that re-sends the values already on air is refused: the rule
 *     runs before "nothing changed" is decided, and it cannot be run.
 *   - A take of an item of the same graphic is accepted: a take runs no update rule.
 *
 * What these tests deliberately do not cover:
 *   - The boot warning for such a manifest; ../loadInitialSlicesUnusableUpdateRule.test.ts.
 *   - How a manifest's rule is read; ../updateRules/updateRuleOfGraphic.test.ts.
 */
import type { Command, Graphic, Instance, Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { raceClockManifestForTests } from '../builtGraphicsFolder.testSupport.js';
import {
  buildRaceDaySlicesWithInstances,
  contextOfTheCommand,
} from './raceDaySlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';

const pitClockInstanceId = '3f9d2b7a-1c4e-4f6a-9b8d-7e6f5a4b3c2d';

/**
 * Builds a pit-lane clock graphic copied from the race clock, with the same data schema
 * but a mistyped rule name in its manifest ("Foward").
 */
function buildPitClockWithMistypedRule(): Graphic {
  return {
    id: 'pit-clock',
    manifest: {
      ...raceClockManifestForTests,
      id: 'baja-pit-clock',
      name: 'Relógio de box',
      v_baja: { defaultLayerId: 'clock', category: 'clock', updateRule: 'carryClockFoward' },
    },
    defaultLayerId: 'clock',
    category: 'clock',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/**
 * Builds a pit-lane countdown that names carryClockForward but whose data has only a
 * label and a number of seconds: none of the four fields the rule works on.
 */
function buildPitCountdownWithoutClockFields(): Graphic {
  return {
    id: 'pit-clock',
    manifest: {
      id: 'baja-pit-clock',
      name: 'Relógio de box',
      main: 'pit-clock.js',
      schema: {
        type: 'object',
        properties: { label: { type: 'string' }, secondsLeft: { type: 'integer' } },
      },
      v_baja: { defaultLayerId: 'clock', category: 'clock', updateRule: 'carryClockForward' },
    },
    defaultLayerId: 'clock',
    category: 'clock',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** Builds the pit clock on the clock layer of program, holding the given data. */
function buildPitClockOnAirHolding(resolvedData: Record<string, unknown>): Instance {
  return {
    id: pitClockInstanceId,
    layerId: 'clock',
    graphicId: 'pit-clock',
    target: 'program',
    resolvedData,
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T14:00:00.000Z',
  };
}

/** Builds the data of team 42's pit stop on the copied race clock schema. */
function buildPitStopClockData(): Record<string, unknown> {
  return {
    sessionName: 'Box — equipe 42, Baja UFPR',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 0,
    referenceWallClockMs: Date.parse('2026-10-09T14:00:00.000Z'),
    running: true,
  };
}

/** Builds race day slices in which the pit clock is registered and on air. */
function buildSlicesWithPitClockOnAir(
  pitClockGraphic: Graphic,
  dataOnAir: Record<string, unknown>,
): SlicesChangedByCommands {
  const raceDaySlices = buildRaceDaySlicesWithInstances([buildPitClockOnAirHolding(dataOnAir)]);
  return { ...raceDaySlices, graphics: [...raceDaySlices.graphics, pitClockGraphic] };
}

/** Builds an update of the pit clock on air with the given data and nothing to stamp. */
function buildUpdateOfThePitClock(data: Record<string, unknown>): Command {
  return {
    type: 'updateInstanceData',
    instanceId: pitClockInstanceId,
    data,
    takeTimeFieldKeys: [],
  };
}

const refusedUpdateScenarios: Array<{
  name: string;
  slicesBefore: SlicesChangedByCommands;
  command: Command;
  expectedMessage: string;
}> = [
  // The typo in the manifest: stopping the pit clock would need the rule, and there is
  // no rule by that name.
  {
    name: 'refuses an update when the manifest names a rule the server does not know',
    slicesBefore: buildSlicesWithPitClockOnAir(
      buildPitClockWithMistypedRule(),
      buildPitStopClockData(),
    ),
    command: buildUpdateOfThePitClock({ running: false }),
    expectedMessage:
      'O gráfico "pit-clock" não pode ser atualizado no ar: o manifesto dele pede a regra de atualização "carryClockFoward", que o servidor não conhece. Corrija o manifesto do gráfico e reinicie o servidor.',
  },
  // "Refuse updates for that graphic" means every update: this one would change only
  // the name, which no clock rule touches, and is refused all the same, so the operator
  // meets the problem at the first update and not only when stopping the clock.
  {
    name: 'refuses an update that touches no clock field, too',
    slicesBefore: buildSlicesWithPitClockOnAir(
      buildPitClockWithMistypedRule(),
      buildPitStopClockData(),
    ),
    command: buildUpdateOfThePitClock({ sessionName: 'Box — equipe 7, Baja Poli' }),
    expectedMessage:
      'O gráfico "pit-clock" não pode ser atualizado no ar: o manifesto dele pede a regra de atualização "carryClockFoward", que o servidor não conhece. Corrija o manifesto do gráfico e reinicie o servidor.',
  },
  // The rule runs before "nothing changed" is decided, and it cannot be run: a re-send
  // of the values on air is refused rather than answered ok on a guess.
  {
    name: 'refuses an update that re-sends the values already on air',
    slicesBefore: buildSlicesWithPitClockOnAir(
      buildPitClockWithMistypedRule(),
      buildPitStopClockData(),
    ),
    command: buildUpdateOfThePitClock({ state: 'green', running: true }),
    expectedMessage:
      'O gráfico "pit-clock" não pode ser atualizado no ar: o manifesto dele pede a regra de atualização "carryClockFoward", que o servidor não conhece. Corrija o manifesto do gráfico e reinicie o servidor.',
  },
  // The right rule on the wrong graphic: the message lists what the schema lacks.
  {
    name: 'refuses an update when the data schema lacks the fields the rule needs',
    slicesBefore: buildSlicesWithPitClockOnAir(buildPitCountdownWithoutClockFields(), {
      label: 'Box — equipe 42',
      secondsLeft: 90,
    }),
    command: buildUpdateOfThePitClock({ secondsLeft: 60 }),
    expectedMessage:
      'O gráfico "pit-clock" não pode ser atualizado no ar: o manifesto dele pede a regra de atualização "carryClockForward", mas o esquema de dados não declara os campos de que ela precisa (referenceTimeMs, referenceWallClockMs, running, clockMode). Corrija o manifesto do gráfico e reinicie o servidor.',
  },
];

describe('updateInstanceData, when the update rule of the graphic cannot be run', () => {
  it.each(refusedUpdateScenarios)('$name', ({ slicesBefore, command, expectedMessage }) => {
    // Arrange: the pit clock registered with the scenario's manifest and on air, and a
    // deep copy of the slices for comparison.
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: reduce the update.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheCommand);

    // Assert: refused in pt-BR, saying what to correct in the manifest; nothing changed.
    expect(outcome, 'the update must be refused, naming the graphic and the rule').toEqual({
      status: 'refused',
      error: { code: 'INVALID_GRAPHIC_DATA', message: expectedMessage },
    });
    expect(slicesBefore, 'a refused update must leave the slices as they were').toEqual(
      copyOfSlicesBefore,
    );
  });
});

/** Builds the "Atalhos" button "Box — equipe 42": the pit clock, every field typed in. */
function buildPitStopItem(): Item {
  const pitStopData = buildPitStopClockData();
  return {
    id: 'item-box-equipe-42',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    order: 0,
    graphicId: 'pit-clock',
    layerId: 'clock',
    fields: {
      sessionName: { kind: 'literal', value: pitStopData.sessionName },
      state: { kind: 'literal', value: pitStopData.state },
      clockMode: { kind: 'literal', value: pitStopData.clockMode },
      referenceTimeMs: { kind: 'literal', value: pitStopData.referenceTimeMs },
      referenceWallClockMs: { kind: 'literal', value: pitStopData.referenceWallClockMs },
      running: { kind: 'literal', value: pitStopData.running },
    },
    label: 'Box — equipe 42',
    color: 'warning',
    notes: '',
  };
}

describe('takeItem, when the update rule of the graphic cannot be run', () => {
  it('puts the graphic on air all the same, because a take runs no update rule', () => {
    // Arrange: the pit clock registered with the mistyped rule, its item prepared, and
    // nothing on air.
    const raceDaySlices = buildRaceDaySlicesWithInstances([]);
    const slicesBefore = {
      ...raceDaySlices,
      graphics: [...raceDaySlices.graphics, buildPitClockWithMistypedRule()],
      items: [buildPitStopItem()],
    };

    // Act: take the pit clock item for team 42's stop.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-box-equipe-42' },
      contextOfTheCommand,
    );

    // Assert: applied, with the data the item gives. Refusing takes too would take a graphic
    // off the list for a mistake that only matters once it is updated.
    expect(outcome.status, 'the take must be applied').toBe('applied');
    expect(
      outcome.status === 'applied' ? outcome.slices.instances[0]?.resolvedData : undefined,
      'the pit clock must go on air with the data the item gives',
    ).toEqual(buildPitStopClockData());
  });
});
