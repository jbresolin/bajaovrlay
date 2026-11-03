/**
 * Command reducers (apps/server)
 *
 * What this module is for:
 *   A reducer is the pure heart of a command: given the current slices, one valid
 *   command and a context (the ids for a new instance and a new item and the current
 *   time, all made by the store), it returns the new slices or a refusal with a pt-BR
 *   reason. It does no I/O, so the same input always gives the same output.
 *
 * What these tests prove:
 *   - takeItem puts an item's instance on an empty layer, replaces what was on the same
 *     layer and output, and leaves every other layer and output alone; previewItem
 *     does the same on the preview output and leaves program alone.
 *   - takeItem is refused for an item that does not exist.
 *   - clearLayer empties one layer on both outputs, program and preview; clearAll
 *     empties every layer, persistent ones such as the clock included.
 *   - clearLayer is refused for a layer that does not exist.
 *   - saveOnAirChangesIntoItem is routed to its reducer: the field changed on air is
 *     written into the item.
 *   - A reducer never changes the slices it was given, and a command that changes
 *     nothing (clearing an empty layer, clearAll with nothing on air) hands back the
 *     very same instances array, so the store saves and broadcasts nothing.
 *
 * What these tests deliberately do not cover:
 *   - Checking the command's shape, authorising it, saving or broadcasting the result;
 *     the store (createStateStore.test.ts) does those around the reducer.
 *   - updateInstanceData and reportInstanceStatus, which have a test file each next to
 *     their reducer, and the take step's check of the data against the graphic's
 *     manifest schema (putGraphicOnOutputData.test.ts). The two graphics here declare
 *     no data schema, so any data is accepted.
 *   - The rules of the take step itself for an unknown layer or graphic;
 *     putGraphicOnOutputPreview.test.ts covers them.
 *   - The other item and rundown commands (createItem, updateItemFields, deleteItem,
 *     reorderItems, moveCursor, takeNext), the rundown cursor and every refusal of
 *     saveOnAirChangesIntoItem, which have a test file each too.
 *   - The other preview commands (stopPreview, takePreview, takeAllPreviews), which have
 *     a test file each, and what the clears do to a preview made by them
 *     (previewAndOlderCommands.test.ts).
 *   - Graphics put up with no item: since BAJAOVRLAY-37 no command does that (the old
 *     takeGraphic and previewGraphic are gone), so everything here starts from an item.
 */
import type { Command, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { noSourceHostAllowlist } from '../../../modules/dataSources/index.js';
import { reduceCommand } from './reduceCommand.js';
import type { ReducerContext, SlicesChangedByCommands } from './reducerTypes.js';
import {
  buildEnduroClockData,
  buildRaceDaySlicesWithRundown,
  buildTeam42ShortcutItem,
  buildYellowFlagItem,
} from './rundownSlices.testSupport.js';

const contextOfTheTake: ReducerContext = {
  newInstanceId: '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f',
  now: '2026-10-09T14:32:05.000Z',
  newItemId: '5e8a2c1d-9f3b-4a7e-b6d4-2c1f0e9a8b7c',
  newQuickFirePanelId: 'd4b2e8f1-6a3c-4d7e-9b05-1c8f2a6e3d90',
  newMacroId: '8f3a1c6e-2d4b-4e9a-b7c5-0a1d3e5f7b92',
  newDataSourceId: 'c7e1a3f5-9b2d-4c6e-8a0f-3d5b7c9e1a24',
  newEventId: 'evento-digitado-1',
  newTriggerId: 'gatilho-novo-1',
  newTriggerFiringId: 'disparo-novo-1',
  sourceHostAllowlist: noSourceHostAllowlist,
  actor: 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81',
};

const teamLowerThirdData = { teamNumber: 42, teamName: 'Baja UFPR' };

/** Builds the race clock instance already on the program output, under green flag. */
function buildRaceClockOnAir(): Instance {
  return {
    id: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: buildEnduroClockData('green'),
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T13:00:00.000Z',
  };
}

/** Builds the race clock being rehearsed on the preview output, on the clock layer. */
function buildRaceClockOnPreview(): Instance {
  return {
    ...buildRaceClockOnAir(),
    id: 'e5a9d3b1-6c2f-4d8a-b7e4-3f1c0a9e8d27',
    target: 'preview',
  };
}

/** Builds a lower third for team 42 already on the program output. */
function buildTeam42LowerThirdOnAir(): Instance {
  return {
    id: 'c41f0e9a-2b7d-4e3c-8a65-1d2e3f4a5b6c',
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'program',
    resolvedData: teamLowerThirdData,
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T14:00:00.000Z',
  };
}

/**
 * Builds the slices of a race day with the given instances and two prepared items: the
 * rundown row "Bandeira amarela" (race clock) and the "Atalhos" button "Tarja — Baja
 * UFPR" (team lower third). Neither graphic declares a data schema.
 */
function buildRaceDaySlicesWithInstances(instances: Instance[]): SlicesChangedByCommands {
  return buildRaceDaySlicesWithRundown({
    items: [buildYellowFlagItem(0), buildTeam42ShortcutItem(0)],
    instances,
  });
}

/** Builds the instance a take of one of those items is expected to create with contextOfTheTake. */
function buildExpectedNewInstance(fields: {
  layerId: string;
  graphicId: string;
  target: 'program' | 'preview';
  resolvedData: Record<string, unknown>;
  itemId: string;
}): Instance {
  return {
    id: contextOfTheTake.newInstanceId,
    layerId: fields.layerId,
    graphicId: fields.graphicId,
    target: fields.target,
    resolvedData: fields.resolvedData,
    currentStep: 0,
    status: 'loading',
    takenAt: contextOfTheTake.now,
    itemId: fields.itemId,
  };
}

const appliedCommandScenarios: Array<{
  name: string;
  instancesBefore: Instance[];
  command: Command;
  expectedInstancesAfter: Instance[];
  /** True when nothing changes, so the reducer must hand back the very same array. */
  isInstancesSliceUnchanged?: boolean;
}> = [
  // The basic take: nothing on the clock layer, the yellow flag clock goes on.
  {
    name: 'takeItem puts the race clock on an empty clock layer',
    instancesBefore: [],
    command: { type: 'takeItem', itemId: 'item-bandeira-amarela' },
    expectedInstancesAfter: [
      buildExpectedNewInstance({
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: buildEnduroClockData('yellow'),
        itemId: 'item-bandeira-amarela',
      }),
    ],
  },
  // One layer shows one graphic per output: a new take replaces the old instance.
  {
    name: 'takeItem replaces the instance already on the same layer',
    instancesBefore: [buildRaceClockOnAir()],
    command: { type: 'takeItem', itemId: 'item-bandeira-amarela' },
    expectedInstancesAfter: [
      buildExpectedNewInstance({
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: buildEnduroClockData('yellow'),
        itemId: 'item-bandeira-amarela',
      }),
    ],
  },
  // Layers are independent: a lower third must not knock the clock off air.
  {
    name: 'takeItem on the lower third leaves the clock layer alone',
    instancesBefore: [buildRaceClockOnAir()],
    command: { type: 'takeItem', itemId: 'item-atalho-tarja-baja-ufpr' },
    expectedInstancesAfter: [
      buildRaceClockOnAir(),
      buildExpectedNewInstance({
        layerId: 'lower-third',
        graphicId: 'team-lower-third',
        target: 'program',
        resolvedData: teamLowerThirdData,
        itemId: 'item-atalho-tarja-baja-ufpr',
      }),
    ],
  },
  // Preview is a separate output: rehearsing a take must not touch what is on air.
  {
    name: 'previewItem leaves the program instance on the same layer alone',
    instancesBefore: [buildRaceClockOnAir()],
    command: { type: 'previewItem', itemId: 'item-bandeira-amarela', origin: 'manual' },
    // Every preview says who asked for it; this one was asked for by hand.
    expectedInstancesAfter: [
      buildRaceClockOnAir(),
      {
        ...buildExpectedNewInstance({
          layerId: 'clock',
          graphicId: 'race-clock',
          target: 'preview',
          resolvedData: buildEnduroClockData('yellow'),
          itemId: 'item-bandeira-amarela',
        }),
        previewOrigin: 'manual',
      },
    ],
  },
  // Taking one graphic off air: only that layer empties.
  {
    name: 'clearLayer removes the lower third and keeps the clock',
    instancesBefore: [buildRaceClockOnAir(), buildTeam42LowerThirdOnAir()],
    command: { type: 'clearLayer', layerId: 'lower-third' },
    expectedInstancesAfter: [buildRaceClockOnAir()],
  },
  // clearLayer names only a layer, not an output, so it clears program and preview both.
  {
    name: 'clearLayer removes the clock from program and preview alike',
    instancesBefore: [
      buildRaceClockOnAir(),
      buildRaceClockOnPreview(),
      buildTeam42LowerThirdOnAir(),
    ],
    command: { type: 'clearLayer', layerId: 'clock' },
    expectedInstancesAfter: [buildTeam42LowerThirdOnAir()],
  },
  // Clearing a layer that shows nothing is harmless, not an error.
  {
    name: 'clearLayer on an empty layer changes nothing',
    instancesBefore: [buildRaceClockOnAir()],
    command: { type: 'clearLayer', layerId: 'fullscreen' },
    expectedInstancesAfter: [buildRaceClockOnAir()],
    isInstancesSliceUnchanged: true,
  },
  // The panic button: everything off air, whatever the layer. The clock layer is
  // persistent, and clearAll clears it anyway: persistent has no effect until M1.
  {
    name: 'clearAll removes every instance on every layer, persistent ones included',
    instancesBefore: [buildRaceClockOnAir(), buildTeam42LowerThirdOnAir()],
    command: { type: 'clearAll' },
    expectedInstancesAfter: [],
  },
  // The panic button pressed with nothing on air: nothing to save or broadcast.
  {
    name: 'clearAll with nothing on air changes nothing',
    instancesBefore: [],
    command: { type: 'clearAll' },
    expectedInstancesAfter: [],
    isInstancesSliceUnchanged: true,
  },
];

describe('reduceCommand, when the command can be applied', () => {
  it.each(appliedCommandScenarios)(
    '$name',
    ({ instancesBefore, command, expectedInstancesAfter, isInstancesSliceUnchanged = false }) => {
      // Arrange: race day slices with the instances this scenario starts from.
      const slicesBefore = buildRaceDaySlicesWithInstances(instancesBefore);

      // Act: reduce the command.
      const outcome = reduceCommand(slicesBefore, command, contextOfTheTake);

      // Assert: the command is applied, instances are as expected, the rest is untouched.
      expect(outcome.status, 'the command must be applied').toBe('applied');
      const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
      expect(slicesAfter?.instances, 'the instances must be exactly as expected').toEqual(
        expectedInstancesAfter,
      );
      // The store saves and broadcasts a slice only when it is a different array.
      expect(
        slicesAfter?.instances === slicesBefore.instances,
        'an unchanged instances slice must be the very same array; a changed one a new one',
      ).toBe(isInstancesSliceUnchanged);
      expect(slicesAfter?.layers, 'a command must never change the layers').toBe(
        slicesBefore.layers,
      );
      expect(slicesAfter?.graphics, 'a command must never change the graphics').toBe(
        slicesBefore.graphics,
      );
    },
  );
});

const refusedCommandScenarios: Array<{
  name: string;
  command: Command;
  expectedError: { code: string; message: string };
}> = [
  // A row deleted on another control page while this one still showed it.
  {
    name: 'refuses takeItem of an item that does not exist',
    command: { type: 'takeItem', itemId: 'item-chegada-do-enduro' },
    expectedError: {
      code: 'ITEM_NOT_FOUND',
      message: 'O item "item-chegada-do-enduro" não existe; ele pode ter sido excluído.',
    },
  },
  // Clearing a layer that does not exist is a mistake worth telling the operator about.
  {
    name: 'refuses clearLayer on a layer that does not exist',
    command: { type: 'clearLayer', layerId: 'placar' },
    expectedError: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar" não existe.' },
  },
];

describe('reduceCommand, when the command must be refused', () => {
  it.each(refusedCommandScenarios)('$name', ({ command, expectedError }) => {
    // Arrange: race day slices with the clock on air.
    const slicesBefore = buildRaceDaySlicesWithInstances([buildRaceClockOnAir()]);

    // Act: reduce the command.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheTake);

    // Assert: it is refused with a stable code and the pt-BR reason.
    expect(outcome, 'the command must be refused with the pt-BR reason').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});

describe('reduceCommand and saveOnAirChangesIntoItem', () => {
  it('routes the command to its reducer, which writes the field changed on air into the item', () => {
    // Arrange: the yellow flag item on air, its flag changed to red on air ("Atualizar").
    const yellowFlagChangedToRedOnAir: Instance = {
      ...buildExpectedNewInstance({
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: buildEnduroClockData('red'),
        itemId: 'item-bandeira-amarela',
      }),
      fieldsChangedOnAir: ['state'],
    };
    const slicesBefore = buildRaceDaySlicesWithInstances([yellowFlagChangedToRedOnAir]);

    // Act: press "Salvar no item" on the clock row.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'saveOnAirChangesIntoItem',
        instanceId: yellowFlagChangedToRedOnAir.id,
        wallClockFields: 'keepMoment',
      },
      contextOfTheTake,
    );

    // Assert: the item now gives the red flag, as the air shows.
    const itemAfter =
      outcome.status === 'applied'
        ? outcome.slices.items.find((item) => item.id === 'item-bandeira-amarela')
        : undefined;
    expect(
      itemAfter?.fields.state,
      'the flag changed on air must be saved into the item as a typed value',
    ).toEqual({ kind: 'literal', value: 'red' });
  });
});

describe('reduceCommand purity', () => {
  it('never changes the slices it was given', () => {
    // Arrange: slices with two instances, frozen so any change in place would throw.
    const slicesBefore = buildRaceDaySlicesWithInstances([
      buildRaceClockOnAir(),
      buildTeam42LowerThirdOnAir(),
    ]);
    const snapshotBefore = structuredClone(slicesBefore);
    Object.freeze(slicesBefore.instances);

    // Act: take the yellow flag item, which replaces one instance and keeps the other.
    reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-bandeira-amarela' },
      contextOfTheTake,
    );

    // Assert: the slices given to the reducer are exactly as they were.
    expect(slicesBefore, 'a reducer must return new slices, never edit the old ones').toEqual(
      snapshotBefore,
    );
  });
});
