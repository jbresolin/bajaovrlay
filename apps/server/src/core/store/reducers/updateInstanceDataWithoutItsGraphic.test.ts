/**
 * updateInstanceData for an instance whose graphic is no longer registered (apps/server)
 *
 * What this module is for:
 *   A graphic's package can be removed from the graphics folder while its instance stays
 *   on air across a restart. The reducer checks an update against the data schema in the
 *   graphic's manifest, and without the graphic there is no schema to check against.
 *
 * What these tests prove:
 *   - An update that would change the data on air is refused with GRAPHIC_NOT_FOUND and
 *     changes nothing.
 *   - An update that re-sends exactly what is on air is answered ok and hands back the
 *     very same slices. This is the deliberate trade-off written next to the reducer:
 *     "nothing changes" is decided before the graphic is looked up, and an update that
 *     changes nothing needs no schema.
 *
 * What these tests deliberately do not cover:
 *   - The same two rules for a registered graphic; updateInstanceData.test.ts.
 *   - Whether the renderer can still draw such an instance; that is the renderer's
 *     business, not the reducer's.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildRaceClockInstanceWithStatus,
  buildRaceDaySlicesWithInstances,
  contextOfTheCommand,
  raceClockInstanceId,
} from './raceDaySlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';

/**
 * Builds the race clock on air under green flag, with no race clock among the
 * registered graphics, as after a restart with the race-clock package removed.
 */
function buildSlicesWithTheRaceClockOnAirButNotRegistered(): SlicesChangedByCommands {
  const raceDaySlices = buildRaceDaySlicesWithInstances([
    buildRaceClockInstanceWithStatus('on-air'),
  ]);
  const graphicsWithoutTheRaceClock = raceDaySlices.graphics.filter(
    (graphic) => graphic.id !== 'race-clock',
  );
  return { ...raceDaySlices, graphics: graphicsWithoutTheRaceClock };
}

/** Builds an update of the flag of the race clock on air, with no field to stamp. */
function buildUpdateOfTheFlag(flag: string): Command {
  return {
    type: 'updateInstanceData',
    instanceId: raceClockInstanceId,
    data: { state: flag },
    takeTimeFieldKeys: [],
  };
}

describe('updateInstanceData, when the graphic of the instance is no longer registered', () => {
  it('refuses the update with GRAPHIC_NOT_FOUND and changes nothing', () => {
    // Arrange: the race clock on air under green flag, its graphic not registered, and
    // a deep copy kept for comparison.
    const slicesBefore = buildSlicesWithTheRaceClockOnAirButNotRegistered();
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: change the flag to yellow.
    const outcome = reduceCommand(
      slicesBefore,
      buildUpdateOfTheFlag('yellow'),
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

  it('answers ok and hands back the very same slices when the update re-sends what is on air', () => {
    // Arrange: the race clock on air under green flag, its graphic not registered.
    const slicesBefore = buildSlicesWithTheRaceClockOnAirButNotRegistered();

    // Act: send the green flag, which is the flag already on air.
    const outcome = reduceCommand(slicesBefore, buildUpdateOfTheFlag('green'), contextOfTheCommand);

    // Assert: accepted without a schema, because nothing would change; the very same
    // slices come back, so the store saves, logs and broadcasts nothing.
    expect(outcome.status, 're-sending what is on air must be answered ok').toBe('applied');
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'the slices must be the very same object, not a copy',
    ).toBe(slicesBefore);
  });
});
