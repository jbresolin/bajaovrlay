/**
 * Which correction a bound field can take (packages/shared)
 *
 * What this module is for:
 *   "Corrigir valor da fonte…" on a bound field of "Edição rápida" corrects the source's
 *   value where the field reads it. findOverrideKeyOfBinding says which override that is:
 *   a session field for a session path, or a car's field for a path into the positions or
 *   the standings, the car read from the binding (a car chosen by number) or from the
 *   snapshot (the car at that place now). A correction always belongs to the car, so it
 *   follows the car when the places change. A path no correction reaches (the clock, the
 *   laps, a whole list) has none.
 *
 * What these tests prove:
 *   - The session name and the flag are session corrections.
 *   - The team of the 1st place is a correction of car 31, the car there now.
 *   - The team of car 42 chosen by number is a correction of car 42.
 *   - The team of the 1st standings row is a correction of car 45, the team there; its
 *     points have no correction (gate 2 of PR #18).
 *   - The clock, the laps and the whole positions list have no correction.
 *
 * What these tests deliberately do not cover:
 *   - Applying a correction; applyOverrides.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { BindingFieldValue } from '../bindings/bindingFieldValue.js';
import { readSimulatorSnapshotAtLap34 } from '../bindings/sourcesForBindingTests.testSupport.js';
import { findOverrideKeyOfBinding } from './overrideKeyOfBinding.js';

/** A live binding to the simulator, in the shape and at the path given. */
function buildBinding(
  shapeKey: BindingFieldValue['shapeKey'],
  path: string,
  carNumber?: number,
): BindingFieldValue {
  const binding: BindingFieldValue = {
    kind: 'binding',
    sourceId: 'simulador-enduro',
    shapeKey,
    path,
    isLive: true,
  };
  if (carNumber !== undefined) {
    binding.carNumber = carNumber;
  }
  return binding;
}

describe('findOverrideKeyOfBinding', () => {
  const keyScenarios = [
    // The walk's correction: the session name on the race clock's title.
    {
      name: 'corrects the session name as a session field',
      binding: buildBinding('session', 'sessionName'),
      expected: { sourceId: 'simulador-enduro', scope: 'session', field: 'sessionName' },
    },
    // A flag the source sends wrong can be corrected too.
    {
      name: 'corrects the flag as a session field',
      binding: buildBinding('session', 'state'),
      expected: { sourceId: 'simulador-enduro', scope: 'session', field: 'state' },
    },
    // The 1st place is car 31 at lap 34: the correction is car 31's.
    {
      name: 'corrects the team of the 1st place as car 31, the car there now',
      binding: buildBinding('positions', 'entries.0.teamName'),
      expected: { sourceId: 'simulador-enduro', scope: 'car', carNumber: 31, field: 'teamName' },
    },
    // The card follows car 42.
    {
      name: 'corrects the team of car 42 chosen by number as car 42',
      binding: buildBinding('positions', 'entryOfCar.teamName', 42),
      expected: { sourceId: 'simulador-enduro', scope: 'car', carNumber: 42, field: 'teamName' },
    },
    // The 1st standings row is car 45 (Jandaia Racing).
    {
      name: 'corrects the team of the 1st standings row as car 45',
      binding: buildBinding('standings', 'entries.0.teamName'),
      expected: { sourceId: 'simulador-enduro', scope: 'car', carNumber: 45, field: 'teamName' },
    },
    // Points decide the standings order, so they are not correctable.
    {
      name: 'has no correction for the points of the 1st standings row',
      binding: buildBinding('standings', 'entries.0.points'),
      expected: undefined,
    },
    // Four values that only mean something together: corrected on air, not here.
    {
      name: 'has no correction for the whole clock',
      binding: buildBinding('session', 'clock'),
      expected: undefined,
    },
    // Laps would break the order of the list.
    {
      name: 'has no correction for the laps of the 1st place',
      binding: buildBinding('positions', 'entries.0.laps'),
      expected: undefined,
    },
    // A whole list is many cars.
    {
      name: 'has no correction for the whole positions list',
      binding: buildBinding('positions', 'entries'),
      expected: undefined,
    },
  ];

  it.each(keyScenarios)('$name', ({ binding, expected }) => {
    // Arrange: the simulator's snapshot at lap 34.
    const shapes = readSimulatorSnapshotAtLap34().shapes;

    // Act: find the correction of this row's binding.
    const overrideKey = findOverrideKeyOfBinding(binding, shapes);

    // Assert: the key this row says, or none.
    expect(overrideKey, 'the correction must be this one').toEqual(expected);
  });
});
