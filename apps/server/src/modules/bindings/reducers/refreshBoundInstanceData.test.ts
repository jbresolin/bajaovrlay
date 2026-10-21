/**
 * refreshBoundInstanceData: a source's new values written on air (apps/server)
 *
 * What this module is for:
 *   When a source's data changes, the refresher sends the new values of an instance's
 *   live bound fields as refreshBoundInstanceData, signed `sistema:vinculos`. The reducer
 *   runs updateInstanceData's steps (nulls, the graphic's update rule, the no-change
 *   check, the manifest schema) so the instance keeps its id and the renderer updates it
 *   in place. Unlike an operator's update it never marks a field "alterado no ar", never
 *   touches what only a preview carries, and an applied refresh writes no event-log row
 *   (the reducer says so; the routine-poll exception of PR #16).
 *
 * What these tests prove:
 *   - The yellow flag replaces the green one on the clock on air: same id, status and
 *     take moment, and the outcome asks to be left out of the event log.
 *   - A whole clock reading sent (time, moment, running, mode) goes on air as it came:
 *     the race clock's update rule does not rewrite it.
 *   - A null takes an optional field off air.
 *   - Values equal to those on air change nothing: the very same slices come back.
 *   - The instance's list of fields changed on air stays as it was.
 *   - A preview keeps its origin and the fields it stamps at the take.
 *   - A value the graphic's schema refuses is refused with INVALID_GRAPHIC_DATA.
 *   - A refresh of an instance that has just left is answered ok and changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - Who sends it, and when; authorizeBindingCommands.test.ts and the live refresh
 *     tests through the store.
 *   - The event-log rule as the store applies it; liveRefreshThroughTheStore.test.ts.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildRaceDaySlicesWithTheSimulator } from '../../../core/store/reducers/boundItemSlices.testSupport.js';
import { reduceCommand } from '../../../core/store/reducers/reduceCommand.js';
import { contextOfTheRundownCommand } from '../../../core/store/reducers/rundownSlices.testSupport.js';

const clockOnAirId = 'relogio-no-ar';

/** The bound clock on air: green flag, the simulator's clock, running, 34 laps shown. */
function buildBoundClockOnAir(): Instance {
  return {
    id: clockOnAirId,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'remaining',
      referenceTimeMs: 4_559_052,
      referenceWallClockMs: 1_791_556_323_000,
      running: true,
      lapsCompletedByLeader: 34,
    },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T14:30:00.000Z',
    itemId: 'c3d9f1a7-2b4e-4f60-8a1c-5e7d9b3f0a26',
  };
}

/** Sends one refresh of the instance with the data given, on a race day holding it. */
function refreshInstance(instance: Instance, data: Record<string, unknown>) {
  const slicesBefore = buildRaceDaySlicesWithTheSimulator({ items: [], instances: [instance] });
  const outcome = reduceCommand(
    slicesBefore,
    { type: 'refreshBoundInstanceData', instanceId: instance.id, data },
    contextOfTheRundownCommand,
  );
  return { slicesBefore, outcome };
}

/** The instance after an applied refresh. */
function readInstanceAfter(
  outcome: ReturnType<typeof refreshInstance>['outcome'],
  instanceId: string,
) {
  return outcome.status === 'applied'
    ? outcome.slices.instances.find((instance) => instance.id === instanceId)
    : undefined;
}

describe('refreshBoundInstanceData', () => {
  it('writes the yellow flag over the clock on air, in place and out of the event log', () => {
    // Arrange: the bound clock on air under green.
    const clockOnAir = buildBoundClockOnAir();

    // Act: the simulator raised the yellow flag.
    const { outcome } = refreshInstance(clockOnAir, { state: 'yellow' });

    // Assert: same instance, yellow now; a routine refresh asks for no event-log row.
    expect(outcome.status === 'applied' && outcome.isLeftOutOfTheEventLog, 'no row').toBe(true);
    expect(readInstanceAfter(outcome, clockOnAirId), 'only the flag must change').toEqual({
      ...clockOnAir,
      resolvedData: { ...clockOnAir.resolvedData, state: 'yellow' },
    });
  });

  it('puts a whole clock reading on air as it came', () => {
    // Arrange: the clock on air, running.
    const clockOnAir = buildBoundClockOnAir();
    // A red flag: the source stopped its clock at 1:15:58 left, read a poll later.
    const stoppedClock = {
      clockMode: 'remaining',
      referenceTimeMs: 4_558_000,
      referenceWallClockMs: 1_791_556_325_000,
      running: false,
    };

    // Act: refresh the four clock fields together.
    const { outcome } = refreshInstance(clockOnAir, { state: 'red', ...stoppedClock });

    // Assert: the source's reading, untouched by the clock's update rule.
    expect(readInstanceAfter(outcome, clockOnAirId)?.resolvedData, 'the reading as sent').toEqual({
      ...clockOnAir.resolvedData,
      state: 'red',
      ...stoppedClock,
    });
  });

  it('takes an optional field off air with a null', () => {
    // Arrange: the clock on air showing 34 laps.
    const clockOnAir = buildBoundClockOnAir();

    // Act: the source no longer knows the leader's laps.
    const { outcome } = refreshInstance(clockOnAir, { lapsCompletedByLeader: null });

    // Assert: the laps are gone from the data on air.
    expect(
      readInstanceAfter(outcome, clockOnAirId)?.resolvedData,
      'the laps must leave the air',
    ).not.toHaveProperty('lapsCompletedByLeader');
  });

  it('changes nothing when the values are those on air', () => {
    // Arrange: the clock on air under green.
    const clockOnAir = buildBoundClockOnAir();

    // Act: a refresh with the same flag.
    const { slicesBefore, outcome } = refreshInstance(clockOnAir, { state: 'green' });

    // Assert: the very same slices, so nothing is saved or broadcast.
    expect(outcome, 'an unchanged refresh must leave no trace').toEqual({
      status: 'applied',
      slices: slicesBefore,
    });
  });

  it('leaves the list of fields changed on air as it was', () => {
    // Arrange: the clock on air whose title the operator changed with "Edição rápida".
    const clockOnAir = { ...buildBoundClockOnAir(), fieldsChangedOnAir: ['sessionName'] };

    // Act: the simulator raised the yellow flag.
    const { outcome } = refreshInstance(clockOnAir, { state: 'yellow' });

    // Assert: the title alone is listed; a source's change is not the operator's.
    expect(
      readInstanceAfter(outcome, clockOnAirId)?.fieldsChangedOnAir,
      'a refresh must never mark a field changed on air',
    ).toEqual(['sessionName']);
  });

  it('keeps what only a preview carries', () => {
    // Arrange: the bound clock previewed automatically, its moment to be stamped at the take.
    const clockInPreview: Instance = {
      ...buildBoundClockOnAir(),
      id: 'relogio-em-previa',
      target: 'preview',
      previewOrigin: 'auto',
      takeTimeFieldKeys: ['referenceWallClockMs'],
    };

    // Act: the simulator raised the yellow flag.
    const { outcome } = refreshInstance(clockInPreview, { state: 'yellow' });

    // Assert: still automatic, still stamped at the take; only the flag moved.
    const previewAfter = readInstanceAfter(outcome, 'relogio-em-previa');
    expect(previewAfter?.previewOrigin, 'a refresh is not an edit by the operator').toBe('auto');
    expect(previewAfter?.takeTimeFieldKeys, 'the moment is still stamped at the take').toEqual([
      'referenceWallClockMs',
    ]);
  });

  it('refuses a flag the graphic does not know', () => {
    // Arrange: the clock on air.
    const clockOnAir = buildBoundClockOnAir();

    // Act: a value outside the race clock's flags.
    const { outcome } = refreshInstance(clockOnAir, { state: 'azul' });

    // Assert: refused by the manifest schema, like any update.
    expect(outcome.status === 'refused' && outcome.error.code, 'the schema must refuse it').toBe(
      'INVALID_GRAPHIC_DATA',
    );
  });

  it('answers ok and changes nothing for an instance that has just left', () => {
    // Arrange: a race day with nothing on air.
    const slicesBefore = buildRaceDaySlicesWithTheSimulator({ items: [] });

    // Act: a refresh computed for a clock that was cleared a moment ago.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'refreshBoundInstanceData', instanceId: clockOnAirId, data: { state: 'yellow' } },
      contextOfTheRundownCommand,
    );

    // Assert: nothing to do, nothing to complain about.
    expect(outcome, 'a late refresh must leave no trace').toEqual({
      status: 'applied',
      slices: slicesBefore,
    });
  });
});
