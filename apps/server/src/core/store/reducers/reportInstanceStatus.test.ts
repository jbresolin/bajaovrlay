/**
 * The reportInstanceStatus reducer (apps/server)
 *
 * What this module is for:
 *   A take only says what the operator asked for; the instance starts as `loading`.
 *   The renderer then reports what really happened on screen: `on-air` once the
 *   graphic's play finished, or `failed` (with a detail) when its import, load or play
 *   did not work. This reducer records that report on the instance, so the layer panel
 *   can show "No ar" or the failure.
 *
 * What these tests prove:
 *   - A `loading` instance becomes `on-air`, or `failed` with the renderer's detail
 *     (and without a detail when the renderer gave none).
 *   - An `on-air` instance becomes `failed`, with the detail, when a renderer reports a
 *     failure after another one already showed it: a failure is never kept from the
 *     operator.
 *   - Every other report changes nothing and hands back the very same array, so the
 *     store saves, logs and broadcasts nothing: a second `on-air` (two renderers show
 *     the same instance: OBS and the control page's monitor), and any report about an
 *     instance that is already `failed`, which stays failed, with its first detail,
 *     until it is cleared or replaced.
 *   - A report about an instance that is not there is refused with a pt-BR reason.
 *   - The reducer never changes the slices it was given.
 *
 * What these tests deliberately do not cover:
 *   - That only a renderer may send this command; authorizeCommand.test.ts covers it.
 *   - How the renderer's `instanceStatus` message becomes this command;
 *     clientMessageAnswers.test.ts and webSocketHub.test.ts cover it.
 */
import type { Command, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildRaceClockInstanceWithStatus,
  buildRaceDaySlicesWithInstances,
  buildTeam42LowerThirdOnAir,
  contextOfTheCommand,
  raceClockInstanceId,
} from './raceDaySlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';

const moduleImportFailure =
  'Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js';

const reportOnAir: Command = {
  type: 'reportInstanceStatus',
  instanceId: raceClockInstanceId,
  status: 'on-air',
};
const reportFailedWithDetail: Command = {
  type: 'reportInstanceStatus',
  instanceId: raceClockInstanceId,
  status: 'failed',
  detail: moduleImportFailure,
};

const statusReportScenarios: Array<{
  name: string;
  raceClockBefore: Instance;
  command: Command;
  expectedRaceClockAfter: Instance;
  /** True when nothing changes, so the reducer must hand back the very same array. */
  isInstancesSliceUnchanged: boolean;
}> = [
  // The normal case: the play animation finished, the clock is really on screen.
  {
    name: 'loading → on-air when the renderer reports the play finished',
    raceClockBefore: buildRaceClockInstanceWithStatus('loading'),
    command: reportOnAir,
    expectedRaceClockAfter: buildRaceClockInstanceWithStatus('on-air'),
    isInstancesSliceUnchanged: false,
  },
  // The graphic's module could not be imported: the operator must see why.
  {
    name: 'loading → failed, keeping the detail the renderer gave',
    raceClockBefore: buildRaceClockInstanceWithStatus('loading'),
    command: reportFailedWithDetail,
    expectedRaceClockAfter: buildRaceClockInstanceWithStatus('failed', moduleImportFailure),
    isInstancesSliceUnchanged: false,
  },
  // A renderer that has no detail to give leaves it out; the instance then has none.
  {
    name: 'loading → failed with no detail when the renderer gave none',
    raceClockBefore: buildRaceClockInstanceWithStatus('loading'),
    command: { type: 'reportInstanceStatus', instanceId: raceClockInstanceId, status: 'failed' },
    expectedRaceClockAfter: buildRaceClockInstanceWithStatus('failed'),
    isInstancesSliceUnchanged: false,
  },
  // OBS and the control page's monitor both play the same instance and both report it.
  {
    name: 'on-air → on-air is a no-op that returns the same array',
    raceClockBefore: buildRaceClockInstanceWithStatus('on-air'),
    command: reportOnAir,
    expectedRaceClockAfter: buildRaceClockInstanceWithStatus('on-air'),
    isInstancesSliceUnchanged: true,
  },
  // The control page's monitor showed the clock, then OBS could not: the operator must
  // see the failure and its reason, because the badge would otherwise keep saying "No ar".
  {
    name: 'on-air → failed, with the detail, when another renderer reports a failure',
    raceClockBefore: buildRaceClockInstanceWithStatus('on-air'),
    command: reportFailedWithDetail,
    expectedRaceClockAfter: buildRaceClockInstanceWithStatus('failed', moduleImportFailure),
    isInstancesSliceUnchanged: false,
  },
  // A failure is never hidden by a later success: it stays until cleared or replaced.
  {
    name: 'failed → on-air is a no-op that returns the same array and keeps the detail',
    raceClockBefore: buildRaceClockInstanceWithStatus('failed', moduleImportFailure),
    command: reportOnAir,
    expectedRaceClockAfter: buildRaceClockInstanceWithStatus('failed', moduleImportFailure),
    isInstancesSliceUnchanged: true,
  },
  // A second failure report must not overwrite the reason the operator is already reading.
  {
    name: 'failed → failed is a no-op that returns the same array and keeps the first detail',
    raceClockBefore: buildRaceClockInstanceWithStatus('failed', moduleImportFailure),
    command: {
      type: 'reportInstanceStatus',
      instanceId: raceClockInstanceId,
      status: 'failed',
      detail: 'load() answered status 500',
    },
    expectedRaceClockAfter: buildRaceClockInstanceWithStatus('failed', moduleImportFailure),
    isInstancesSliceUnchanged: true,
  },
];

describe('reportInstanceStatus, for an instance that is there', () => {
  it.each(statusReportScenarios)(
    '$name',
    ({ raceClockBefore, command, expectedRaceClockAfter, isInstancesSliceUnchanged }) => {
      // Arrange: the race clock in the scenario's status, and team 42's lower third on air.
      const slicesBefore = buildRaceDaySlicesWithInstances([
        raceClockBefore,
        buildTeam42LowerThirdOnAir(),
      ]);

      // Act: reduce the renderer's report.
      const outcome = reduceCommand(slicesBefore, command, contextOfTheCommand);

      // Assert: applied; the clock is in the expected status and the lower third untouched.
      expect(outcome.status, 'a report about an existing instance must be applied').toBe('applied');
      const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
      expect(slicesAfter?.instances, 'only the reported instance may change').toEqual([
        expectedRaceClockAfter,
        buildTeam42LowerThirdOnAir(),
      ]);
      // The store saves and broadcasts a slice only when it is a different array.
      expect(
        slicesAfter?.instances === slicesBefore.instances,
        'an unchanged instances slice must be the very same array; a changed one a new one',
      ).toBe(isInstancesSliceUnchanged);
    },
  );
});

describe('reportInstanceStatus, for an instance that is not there', () => {
  it('is refused with INSTANCE_NOT_FOUND and a pt-BR reason', () => {
    // Arrange: only team 42's lower third is on air; the clock was cleared a moment ago.
    const slicesBefore = buildRaceDaySlicesWithInstances([buildTeam42LowerThirdOnAir()]);

    // Act: the renderer's late report about the cleared clock arrives.
    const outcome = reduceCommand(slicesBefore, reportOnAir, contextOfTheCommand);

    // Assert: refused, naming the instance.
    expect(outcome, 'a report about a missing instance must be refused').toEqual({
      status: 'refused',
      error: {
        code: 'INSTANCE_NOT_FOUND',
        message: `A instância "${raceClockInstanceId}" não existe; o gráfico pode já ter saído do ar.`,
      },
    });
  });
});

describe('reportInstanceStatus purity', () => {
  it('never changes the slices it was given', () => {
    // Arrange: the race clock still loading, with a deep copy kept for comparison.
    const slicesBefore = buildRaceDaySlicesWithInstances([
      buildRaceClockInstanceWithStatus('loading'),
    ]);
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: report it on air.
    reduceCommand(slicesBefore, reportOnAir, contextOfTheCommand);

    // Assert: the slices handed in still say `loading`.
    expect(slicesBefore, 'a reducer must return new slices, never edit the old ones').toEqual(
      copyOfSlicesBefore,
    );
  });
});
