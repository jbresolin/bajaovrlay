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
 *   - takeGraphic puts an instance on an empty layer, replaces what was on the same
 *     layer and output, and leaves every other layer and output alone.
 *   - takeGraphic is refused for a layer or a graphic that does not exist.
 *   - clearLayer empties one layer on both outputs, program and preview; clearAll
 *     empties every layer, persistent ones such as the clock included.
 *   - clearLayer is refused for a layer that does not exist.
 *   - A reducer never changes the slices it was given, and a command that changes
 *     nothing (clearing an empty layer, clearAll with nothing on air) hands back the
 *     very same instances array, so the store saves and broadcasts nothing.
 *
 * What these tests deliberately do not cover:
 *   - Checking the command's shape, authorising it, saving or broadcasting the result;
 *     the store (createStateStore.test.ts) does those around the reducer.
 *   - updateInstanceData and reportInstanceStatus, which have a test file each next to
 *     their reducer, and takeGraphic's check of the data against the graphic's manifest
 *     schema (takeGraphicData.test.ts). The two graphics here declare no data schema,
 *     so any data is accepted.
 *   - The seven item and rundown commands (createItem, updateItemFields, deleteItem,
 *     reorderItems, moveCursor, takeItem, takeNext), which have a test file each too.
 *   - The four preview commands (previewItem, previewGraphic, stopPreview, takePreview),
 *     which have a test file each, and what the clears do to a preview made by them
 *     (previewAndOlderCommands.test.ts).
 */
import type { Command, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { seededLayers } from '../seedLayers.js';
import { reduceCommand } from './reduceCommand.js';
import type { ReducerContext, SlicesChangedByCommands } from './reducerTypes.js';

const contextOfTheTake: ReducerContext = {
  newInstanceId: '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f',
  now: '2026-10-09T14:32:05.000Z',
  newItemId: '5e8a2c1d-9f3b-4a7e-b6d4-2c1f0e9a8b7c',
  newQuickFirePanelId: 'd4b2e8f1-6a3c-4d7e-9b05-1c8f2a6e3d90',
  newMacroId: '8f3a1c6e-2d4b-4e9a-b7c5-0a1d3e5f7b92',
};

const raceClockData = { sessionName: 'Enduro de Resistência', state: 'green' };
const teamLowerThirdData = { teamNumber: 42, teamName: 'Baja UFPR' };

/** Builds the race clock instance already on the program output, on the clock layer. */
function buildRaceClockOnAir(): Instance {
  return {
    id: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: raceClockData,
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

/** Builds the slices of a race day: the five seeded layers, two graphics, given instances. */
function buildRaceDaySlicesWithInstances(instances: Instance[]): SlicesChangedByCommands {
  return {
    layers: seededLayers,
    graphics: [
      {
        id: 'race-clock',
        manifest: { id: 'baja-race-clock', name: 'Relógio de prova', main: 'race-clock.js' },
        defaultLayerId: 'clock',
        category: 'clock',
        thumbnailUrl: null,
        defaultFields: {},
      },
      {
        id: 'team-lower-third',
        manifest: { id: 'baja-team-lower-third', name: 'Tarja de equipe', main: 'tarja.js' },
        defaultLayerId: 'lower-third',
        category: 'lower-third',
        thumbnailUrl: null,
        defaultFields: {},
      },
    ],
    instances,
    // No marker, rundown, item, panel or macro: the commands tested here never need one.
    previewClearedLayerIds: [],
    rundowns: [],
    items: [],
    quickFirePanels: [],
    macros: [],
    macroRuns: [],
  };
}

/** Builds the instance a takeGraphic is expected to create with contextOfTheTake. */
function buildExpectedNewInstance(fields: {
  layerId: string;
  graphicId: string;
  target: 'program' | 'preview';
  resolvedData: Record<string, unknown>;
}): Instance {
  return {
    id: contextOfTheTake.newInstanceId,
    ...fields,
    currentStep: 0,
    status: 'loading',
    takenAt: contextOfTheTake.now,
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
  // The basic take: nothing on the clock layer, the race clock goes on.
  {
    name: 'takeGraphic puts the race clock on an empty clock layer',
    instancesBefore: [],
    command: {
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: raceClockData,
      target: 'program',
      takeTimeFieldKeys: [],
    },
    expectedInstancesAfter: [
      buildExpectedNewInstance({
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: raceClockData,
      }),
    ],
  },
  // One layer shows one graphic per output: a new take replaces the old instance.
  {
    name: 'takeGraphic replaces the instance already on the same layer',
    instancesBefore: [buildRaceClockOnAir()],
    command: {
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: { ...raceClockData, state: 'yellow' },
      target: 'program',
      takeTimeFieldKeys: [],
    },
    expectedInstancesAfter: [
      buildExpectedNewInstance({
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: { ...raceClockData, state: 'yellow' },
      }),
    ],
  },
  // Layers are independent: a lower third must not knock the clock off air.
  {
    name: 'takeGraphic on the lower third leaves the clock layer alone',
    instancesBefore: [buildRaceClockOnAir()],
    command: {
      type: 'takeGraphic',
      graphicId: 'team-lower-third',
      layerId: 'lower-third',
      data: teamLowerThirdData,
      target: 'program',
      takeTimeFieldKeys: [],
    },
    expectedInstancesAfter: [
      buildRaceClockOnAir(),
      buildExpectedNewInstance({
        layerId: 'lower-third',
        graphicId: 'team-lower-third',
        target: 'program',
        resolvedData: teamLowerThirdData,
      }),
    ],
  },
  // Preview is a separate output: rehearsing a take must not touch what is on air.
  {
    name: 'takeGraphic on preview leaves the program instance on the same layer alone',
    instancesBefore: [buildRaceClockOnAir()],
    command: {
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: raceClockData,
      target: 'preview',
      takeTimeFieldKeys: [],
    },
    // Every preview says who asked for it; one made by a takeGraphic was asked for by hand.
    expectedInstancesAfter: [
      buildRaceClockOnAir(),
      {
        ...buildExpectedNewInstance({
          layerId: 'clock',
          graphicId: 'race-clock',
          target: 'preview',
          resolvedData: raceClockData,
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
  // A typo in the layer id must not create an instance nobody can see.
  {
    name: 'refuses takeGraphic on a layer that does not exist',
    command: {
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'placar',
      data: raceClockData,
      target: 'program',
      takeTimeFieldKeys: [],
    },
    expectedError: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar" não existe.' },
  },
  // A graphic that is not registered has no package the renderer could load.
  {
    name: 'refuses takeGraphic of a graphic that is not registered',
    command: {
      type: 'takeGraphic',
      graphicId: 'classificacao-geral',
      layerId: 'fullscreen',
      data: {},
      target: 'program',
      takeTimeFieldKeys: [],
    },
    expectedError: {
      code: 'GRAPHIC_NOT_FOUND',
      message: 'O gráfico "classificacao-geral" não está registrado.',
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

describe('reduceCommand purity', () => {
  it('never changes the slices it was given', () => {
    // Arrange: slices with two instances, frozen so any change in place would throw.
    const slicesBefore = buildRaceDaySlicesWithInstances([
      buildRaceClockOnAir(),
      buildTeam42LowerThirdOnAir(),
    ]);
    const snapshotBefore = structuredClone(slicesBefore);
    Object.freeze(slicesBefore.instances);

    // Act: take a new clock, which replaces one instance and keeps the other.
    reduceCommand(
      slicesBefore,
      {
        type: 'takeGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: raceClockData,
        target: 'program',
        takeTimeFieldKeys: [],
      },
      contextOfTheTake,
    );

    // Assert: the slices given to the reducer are exactly as they were.
    expect(slicesBefore, 'a reducer must return new slices, never edit the old ones').toEqual(
      snapshotBefore,
    );
  });
});
