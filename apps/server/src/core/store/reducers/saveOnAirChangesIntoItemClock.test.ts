/**
 * "Salvar no item" of a race clock: the clock is saved whole (apps/server)
 *
 * What this module is for:
 *   A clock on air is four fields that only mean something together: the time it read
 *   (`clockTime`), the moment that time was read (`wallClock`), whether it runs
 *   (`clockRunning`) and which way it counts (`clockMode`), each marked by its
 *   `v_baja.role` in the manifest. When the operator stops a clock on air, only the
 *   switch is sent; the update rule (carryClockForward) writes the time it had reached and
 *   the moment, which the list of changed fields leaves out on purpose (the chip says
 *   what the operator sent). So "Salvar no item" must not save the switch alone: gate 2 of
 *   PR #15 found a clock stopped at 27:34, saved and taken again, showing 12:34. When any
 *   listed field has a clock role, all four clock fields are saved together from what is
 *   on air: the moment follows the operator's choice, the other three are typed values.
 *
 * What these tests prove, each by the whole sequence an operator goes through (change on
 *   air, "Salvar no item", "Limpar", a new take of the item):
 *   - A clock stopped on air, saved and taken again shows the time it was stopped at,
 *     with "Continuar este relógio" (keepMoment) and with "Começar na entrada no ar"
 *     (atTake) alike.
 *   - A time typed on a running clock, saved with keepMoment, continues: the new take
 *     counts on from the moment the time was typed.
 *   - The same saved with atTake restarts from the typed time at the new take.
 *
 * What these tests deliberately do not cover:
 *   - Which fields the chip lists; updateInstanceDataFieldsChangedOnAir.test.ts.
 *   - A graphic without clock roles, saved field by field; saveOnAirChangesIntoItem.test.ts.
 */
import type { Command, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import type { ReducerContext, SlicesChangedByCommands } from './reducerTypes.js';
import {
  buildEnduroClockData,
  buildEnduroStartItem,
  buildRaceDaySlicesWithTheRaceClockSchema,
} from './rundownSlices.testSupport.js';

const clockOnAirInstanceId = '1c9e5a73-8b2d-4f06-a4e8-3d7b9f1c5e20';
const clockTakenAgainInstanceId = '6f2a8c40-9d1e-4b37-a5c2-8e0f3b7d1a64';

// The enduro clock was taken at 13:00 UTC reading 1:05:00 (3 900 000 ms) and running;
// the operator changes it on air at 14:00 and takes the item again at 15:00.
const momentOfTheChangeOnAir = '2026-10-09T14:00:00.000Z';
const momentOfTheNewTake = '2026-10-09T15:00:00.000Z';
const oneHourInMilliseconds = 3_600_000;

/** The ids and time the store would hand a reducer at this moment. */
function buildContextAt(momentAsIsoText: string, newInstanceId: string): ReducerContext {
  return {
    newInstanceId,
    now: momentAsIsoText,
    newItemId: '5e8a2c1d-9f3b-4a7e-b6d4-2c1f0e9a8b7c',
    newQuickFirePanelId: 'd4b2e8f1-6a3c-4d7e-9b05-1c8f2a6e3d90',
    newMacroId: '8f3a1c6e-2d4b-4e9a-b7c5-0a1d3e5f7b92',
  };
}

/** "Largada do enduro" on air on program since 13:00, as its take left it. */
function buildEnduroStartClockOnAirSinceOneOClock(): Instance {
  return {
    id: clockOnAirInstanceId,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: buildEnduroClockData('green'),
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T13:00:00.000Z',
    itemId: 'item-largada-do-enduro',
  };
}

/** Runs one command on the slices; fails the test if it is refused. */
function apply(
  slices: SlicesChangedByCommands,
  command: Command,
  context: ReducerContext,
): SlicesChangedByCommands {
  const outcome = reduceCommand(slices, command, context);
  if (outcome.status === 'refused') {
    throw new Error(`"${command.type}" was refused: ${outcome.error.message}`);
  }
  return outcome.slices;
}

/**
 * The sequence of every test here: at 14:00 the change on air, then "Salvar no item" with
 * this choice and "Limpar"; at 15:00 a new take of the item. Hands back the data of the
 * instance that new take put on air.
 */
function changeOnAirSaveClearAndTakeAgain(
  changeOnAir: Record<string, unknown>,
  wallClockFields: 'keepMoment' | 'atTake',
): Record<string, unknown> {
  const contextOfTheChange = buildContextAt(momentOfTheChangeOnAir, clockOnAirInstanceId);
  let slices = buildRaceDaySlicesWithTheRaceClockSchema({
    items: [buildEnduroStartItem(0)],
    instances: [buildEnduroStartClockOnAirSinceOneOClock()],
  });
  slices = apply(
    slices,
    {
      type: 'updateInstanceData',
      instanceId: clockOnAirInstanceId,
      data: changeOnAir,
      takeTimeFieldKeys: [],
    },
    contextOfTheChange,
  );
  slices = apply(
    slices,
    { type: 'saveOnAirChangesIntoItem', instanceId: clockOnAirInstanceId, wallClockFields },
    contextOfTheChange,
  );
  slices = apply(slices, { type: 'clearLayer', layerId: 'clock' }, contextOfTheChange);
  slices = apply(
    slices,
    { type: 'takeItem', itemId: 'item-largada-do-enduro' },
    buildContextAt(momentOfTheNewTake, clockTakenAgainInstanceId),
  );
  const instanceTakenAgain = slices.instances.find(
    (instance) => instance.id === clockTakenAgainInstanceId,
  );
  if (instanceTakenAgain === undefined) {
    throw new Error('the new take put nothing on air');
  }
  return instanceTakenAgain.resolvedData;
}

describe('"Salvar no item" of a clock stopped on air', () => {
  const choiceScenarios = [
    // "Continuar este relógio": the moment of the stop is kept as a typed number.
    {
      name: 'shows the time it was stopped at when taken again, with keepMoment',
      wallClockFields: 'keepMoment' as const,
      expectedMoment: Date.parse(momentOfTheChangeOnAir),
    },
    // "Começar na entrada no ar": the moment is the new take's; a stopped clock does not move.
    {
      name: 'shows the time it was stopped at when taken again, with atTake',
      wallClockFields: 'atTake' as const,
      expectedMoment: Date.parse(momentOfTheNewTake),
    },
  ];

  it.each(choiceScenarios)('$name', ({ wallClockFields, expectedMoment }) => {
    // Arrange: the enduro clock on air since 13:00, reading 1:05:00 then and running.

    // Act: at 14:00 the operator stops it (the switch alone is sent), saves into the
    // item with this row's choice, clears, and at 15:00 takes the item again.
    const dataTakenAgain = changeOnAirSaveClearAndTakeAgain({ running: false }, wallClockFields);

    // Assert: the new take holds the clock stopped at 2:05:00, the time it had reached
    // at 14:00, and not the 1:05:00 the item had before.
    expect(
      {
        running: dataTakenAgain.running,
        referenceTimeMs: dataTakenAgain.referenceTimeMs,
        referenceWallClockMs: dataTakenAgain.referenceWallClockMs,
        clockMode: dataTakenAgain.clockMode,
      },
      'a clock stopped and saved must come back stopped at the time it was stopped at',
    ).toEqual({
      running: false,
      referenceTimeMs: 3_900_000 + oneHourInMilliseconds,
      referenceWallClockMs: expectedMoment,
      clockMode: 'elapsed',
    });
  });
});

describe('"Salvar no item" of a time typed on a running clock', () => {
  it('continues the clock from the moment the time was typed, with keepMoment', () => {
    // Arrange: the enduro clock on air since 13:00, running.

    // Act: at 14:00 the operator types 0:30:00, saves with "Continuar este relógio",
    // clears, and at 15:00 takes the item again.
    const dataTakenAgain = changeOnAirSaveClearAndTakeAgain(
      { referenceTimeMs: 1_800_000 },
      'keepMoment',
    );

    // Assert: 0:30:00 read at 14:00, running: at 15:00 the screen shows 1:30:00.
    expect(
      {
        running: dataTakenAgain.running,
        referenceTimeMs: dataTakenAgain.referenceTimeMs,
        referenceWallClockMs: dataTakenAgain.referenceWallClockMs,
      },
      'with keepMoment the new take must continue the clock that was on air',
    ).toEqual({
      running: true,
      referenceTimeMs: 1_800_000,
      referenceWallClockMs: Date.parse(momentOfTheChangeOnAir),
    });
  });

  it('restarts from the typed time at the new take, with atTake', () => {
    // Arrange: the enduro clock on air since 13:00, running.

    // Act: at 14:00 the operator types 0:30:00, saves with "Começar na entrada no ar",
    // clears, and at 15:00 takes the item again.
    const dataTakenAgain = changeOnAirSaveClearAndTakeAgain(
      { referenceTimeMs: 1_800_000 },
      'atTake',
    );

    // Assert: 0:30:00 read at the moment of the new take, running: it starts from 0:30:00.
    expect(
      {
        running: dataTakenAgain.running,
        referenceTimeMs: dataTakenAgain.referenceTimeMs,
        referenceWallClockMs: dataTakenAgain.referenceWallClockMs,
      },
      'with atTake the new take must start the clock from the typed time',
    ).toEqual({
      running: true,
      referenceTimeMs: 1_800_000,
      referenceWallClockMs: Date.parse(momentOfTheNewTake),
    });
  });
});
