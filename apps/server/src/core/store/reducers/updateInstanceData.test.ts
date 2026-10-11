/**
 * The updateInstanceData reducer (apps/server)
 *
 * What this module is for:
 *   Changing what a graphic already on screen shows (the flag of the race clock, say)
 *   must not make it leave and come back. `updateInstanceData` carries only the fields
 *   that change; the reducer lays them over the instance's current data and keeps the
 *   instance's id, which is what tells the renderer to update the graphic in place.
 *   The result is checked against the data schema in the graphic's manifest first, so
 *   a graphic never receives data it would refuse.
 *
 * What these tests prove:
 *   - The fields sent replace the same top-level fields, every other field is kept,
 *     and the instance keeps its id, layer, output, status and place in the list.
 *   - An update whose result breaks the manifest's schema is refused with a pt-BR
 *     message naming the field, and so is an update for an instance that is not there.
 *   - An update for an instance whose graphic is no longer registered (its package was
 *     removed across a restart) is refused with GRAPHIC_NOT_FOUND and changes nothing.
 *   - An update that carries no field changes nothing and hands back the same array.
 *   - A graphic whose manifest has no data schema accepts any update.
 *   - The reducer never changes the slices it was given.
 *
 * What these tests deliberately do not cover:
 *   - Every kind of schema violation and its wording; graphicDataValidation.test.ts
 *     covers them.
 *   - The command's shape (packages/shared) and who may send it
 *     (authorizeCommand.test.ts).
 *   - A field sent as null (taken off air) and a field the server stamps with the
 *     moment of the command; updateInstanceDataClearedAndStampedFields.test.ts covers
 *     both. Every update here names no field to stamp (`takeTimeFieldKeys: []`).
 */
import type { Command, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildGreenFlagEnduroData,
  buildRaceClockInstanceWithStatus,
  buildRaceDaySlicesWithInstances,
  buildTeam42LowerThirdOnAir,
  contextOfTheCommand,
  raceClockInstanceId,
} from './raceDaySlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';

const appliedUpdateScenarios: Array<{
  name: string;
  command: Command;
  expectedInstancesAfter: Instance[];
}> = [
  // The reason the command exists: the yellow flag comes out and only `state` is sent.
  {
    name: 'changes the flag to yellow and keeps every other field and the instance id',
    command: {
      type: 'updateInstanceData',
      instanceId: raceClockInstanceId,
      data: { state: 'yellow' },
      takeTimeFieldKeys: [],
    },
    expectedInstancesAfter: [
      {
        ...buildRaceClockInstanceWithStatus('on-air'),
        resolvedData: { ...buildGreenFlagEnduroData(), state: 'yellow' },
      },
      buildTeam42LowerThirdOnAir(),
    ],
  },
  // Several fields at once, one of them new: the clock stops and the lap count appears.
  {
    name: 'replaces two fields and adds an optional one that was not there before',
    command: {
      type: 'updateInstanceData',
      instanceId: raceClockInstanceId,
      data: { state: 'red', running: false, lapsCompletedByLeader: 12 },
      takeTimeFieldKeys: [],
    },
    expectedInstancesAfter: [
      {
        ...buildRaceClockInstanceWithStatus('on-air'),
        resolvedData: {
          ...buildGreenFlagEnduroData(),
          state: 'red',
          running: false,
          lapsCompletedByLeader: 12,
        },
      },
      buildTeam42LowerThirdOnAir(),
    ],
  },
  // The team lower third's manifest has no data schema, so there is nothing to check
  // its data against: the update is accepted as sent.
  {
    name: 'accepts any field for a graphic whose manifest has no data schema',
    command: {
      type: 'updateInstanceData',
      instanceId: buildTeam42LowerThirdOnAir().id,
      data: { teamName: 'Baja UFPR Trovão' },
      takeTimeFieldKeys: [],
    },
    expectedInstancesAfter: [
      buildRaceClockInstanceWithStatus('on-air'),
      {
        ...buildTeam42LowerThirdOnAir(),
        resolvedData: { teamNumber: 42, teamName: 'Baja UFPR Trovão' },
      },
    ],
  },
];

describe('updateInstanceData, when the update can be applied', () => {
  it.each(appliedUpdateScenarios)('$name', ({ command, expectedInstancesAfter }) => {
    // Arrange: the race clock and team 42's lower third on air, in that order.
    const slicesBefore = buildRaceDaySlicesWithInstances([
      buildRaceClockInstanceWithStatus('on-air'),
      buildTeam42LowerThirdOnAir(),
    ]);

    // Act: reduce the update.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheCommand);

    // Assert: applied; only the data of the named instance changed, nothing moved.
    expect(outcome.status, 'the update must be applied').toBe('applied');
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      slicesAfter?.instances,
      'the sent fields must be laid over the old data, with the same id and order',
    ).toEqual(expectedInstancesAfter);
    expect(
      slicesAfter?.instances === slicesBefore.instances,
      'a changed instances slice must be a new array, so the store saves and broadcasts it',
    ).toBe(false);
    expect(slicesAfter?.layers, 'an update must never change the layers').toBe(slicesBefore.layers);
    expect(slicesAfter?.graphics, 'an update must never change the graphics').toBe(
      slicesBefore.graphics,
    );
  });

  it('changes nothing and hands back the same array when the update carries no field', () => {
    // Arrange: the race clock on air.
    const slicesBefore = buildRaceDaySlicesWithInstances([
      buildRaceClockInstanceWithStatus('on-air'),
    ]);

    // Act: send an update with an empty data object, as a form with nothing changed would.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'updateInstanceData',
        instanceId: raceClockInstanceId,
        data: {},
        takeTimeFieldKeys: [],
      },
      contextOfTheCommand,
    );

    // Assert: applied, and the very same slices come back, so nothing is saved or broadcast.
    expect(outcome, 'an empty update must be accepted and change nothing').toEqual({
      status: 'applied',
      slices: slicesBefore,
    });
    expect(
      outcome.status === 'applied' ? outcome.slices.instances : undefined,
      'the instances must be the very same array, not a copy',
    ).toBe(slicesBefore.instances);
  });
});

const refusedUpdateScenarios: Array<{
  name: string;
  command: Command;
  expectedError: { code: string; message: string };
}> = [
  // A flag the race clock does not have: the graphic would refuse it, so the server does.
  {
    name: 'refuses a flag the race clock does not have, naming the field',
    command: {
      type: 'updateInstanceData',
      instanceId: raceClockInstanceId,
      data: { state: 'azul' },
      takeTimeFieldKeys: [],
    },
    expectedError: {
      code: 'INVALID_GRAPHIC_DATA',
      message:
        'Dados inválidos para o gráfico "race-clock": o campo "state" tem um valor que o gráfico não aceita.',
    },
  },
  // A misspelt field name must not be stored silently next to the real fields.
  {
    name: 'refuses a field the race clock does not have, naming the field',
    command: {
      type: 'updateInstanceData',
      instanceId: raceClockInstanceId,
      data: { bandeira: 'yellow' },
      takeTimeFieldKeys: [],
    },
    expectedError: {
      code: 'INVALID_GRAPHIC_DATA',
      message:
        'Dados inválidos para o gráfico "race-clock": o campo "bandeira" não existe neste gráfico.',
    },
  },
  // The instance was cleared (or never existed): there is nothing to update.
  {
    name: 'refuses an update for an instance that is not there',
    command: {
      type: 'updateInstanceData',
      instanceId: 'e5a9d3b1-6c2f-4d8a-b7e4-3f1c0a9e8d27',
      data: { state: 'yellow' },
      takeTimeFieldKeys: [],
    },
    expectedError: {
      code: 'INSTANCE_NOT_FOUND',
      message:
        'A instância "e5a9d3b1-6c2f-4d8a-b7e4-3f1c0a9e8d27" não existe; o gráfico pode já ter saído do ar.',
    },
  },
];

describe('updateInstanceData, when the update must be refused', () => {
  it.each(refusedUpdateScenarios)('$name', ({ command, expectedError }) => {
    // Arrange: the race clock on air, with a deep copy kept for comparison.
    const slicesBefore = buildRaceDaySlicesWithInstances([
      buildRaceClockInstanceWithStatus('on-air'),
    ]);
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: reduce the update.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheCommand);

    // Assert: refused with a stable code and the pt-BR reason, and nothing was changed.
    expect(outcome, 'the update must be refused with the pt-BR reason').toEqual({
      status: 'refused',
      error: expectedError,
    });
    expect(slicesBefore, 'a refused update must leave the slices exactly as they were').toEqual(
      copyOfSlicesBefore,
    );
  });
});

describe('updateInstanceData, when the graphic of the instance is no longer registered', () => {
  it('refuses the update with GRAPHIC_NOT_FOUND and changes nothing', () => {
    // Arrange: the race clock on air, but no race clock among the registered graphics,
    // as after a restart with the race-clock package removed from the graphics folder.
    const raceDaySlices = buildRaceDaySlicesWithInstances([
      buildRaceClockInstanceWithStatus('on-air'),
    ]);
    const slicesBefore = {
      ...raceDaySlices,
      graphics: raceDaySlices.graphics.filter((graphic) => graphic.id !== 'race-clock'),
    };
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: change the flag to yellow.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'updateInstanceData',
        instanceId: raceClockInstanceId,
        data: { state: 'yellow' },
        takeTimeFieldKeys: [],
      },
      contextOfTheCommand,
    );

    // Assert: refused, because without the manifest's schema the data cannot be checked.
    expect(outcome, 'an update for an unregistered graphic must be refused in pt-BR').toEqual({
      status: 'refused',
      error: {
        code: 'GRAPHIC_NOT_FOUND',
        message: 'O gráfico "race-clock" não está registrado.',
      },
    });
    expect(slicesBefore, 'a refused update must change nothing').toEqual(copyOfSlicesBefore);
  });
});

describe('updateInstanceData purity', () => {
  it('never changes the slices it was given', () => {
    // Arrange: the race clock on air, with a deep copy kept for comparison.
    const slicesBefore = buildRaceDaySlicesWithInstances([
      buildRaceClockInstanceWithStatus('on-air'),
    ]);
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: change the flag to yellow.
    reduceCommand(
      slicesBefore,
      {
        type: 'updateInstanceData',
        instanceId: raceClockInstanceId,
        data: { state: 'yellow' },
        takeTimeFieldKeys: [],
      },
      contextOfTheCommand,
    );

    // Assert: the slices handed in still show the green flag.
    expect(slicesBefore, 'a reducer must return new slices, never edit the old ones').toEqual(
      copyOfSlicesBefore,
    );
  });
});
