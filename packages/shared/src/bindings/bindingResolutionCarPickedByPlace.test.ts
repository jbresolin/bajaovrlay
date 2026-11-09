/**
 * Reading a car picked by its place (packages/shared)
 *
 * What this module is for:
 *   A car group's picker (BAJAOVRLAY-66) writes ordinary bindings, so the resolver is the
 *   one every field already goes through: a car picked by number reads `entryOfCar.…`
 *   with its number, a car picked by place reads `entries.<index>.…`. A battle for 2nd
 *   place then follows whichever cars run 2nd and 3rd.
 *
 * What these tests prove:
 *   - The five fields of the 2nd place and the gap read exactly what the same fields read
 *     for car 38 chosen by number, car 38 running 2nd at lap 34.
 *   - The position of a place reads the place itself (2 for the 2nd place).
 *
 * What these tests deliberately do not cover:
 *   - A car chosen by number in every other way; bindingResolution.test.ts.
 *   - What the picker writes; ItemEditorPanelCarGroups.test.tsx in apps/control.
 */
import { describe, expect, it } from 'vitest';

import type { BindingFieldValue } from './bindingFieldValue.js';
import { resolveBindingAgainstSources } from './bindingResolution.js';
import {
  buildSourcesWithTheSimulatorAtLap34,
  simulatorSourceId,
} from './sourcesForBindingTests.testSupport.js';

// The teams handed to the transforms; these bindings have none.
const contextWithNoTeams = { teams: [] };

/** The car running 2nd in the simulator's lap-34 data. */
const carRunningSecondAtLap34 = 38;

/** The fields of a car the battle card's "Carro de trás" reads, with the gap. */
const fieldsOfOneCar = ['position', 'carNumber', 'teamName', 'schoolName', 'laps', 'intervalMs'];

/** A live binding of one field of the car picked by number. */
function buildBindingOfCarPickedByNumber(fieldName: string, carNumber: number): BindingFieldValue {
  return {
    kind: 'binding',
    sourceId: simulatorSourceId,
    shapeKey: 'positions',
    path: `entryOfCar.${fieldName}`,
    carNumber,
    isLive: true,
  };
}

/** A live binding of one field of the car running at a place (1 for the leader). */
function buildBindingOfCarPickedByPlace(fieldName: string, placeNumber: number): BindingFieldValue {
  return {
    kind: 'binding',
    sourceId: simulatorSourceId,
    shapeKey: 'positions',
    path: `entries.${placeNumber - 1}.${fieldName}`,
    isLive: true,
  };
}

describe('a car picked by its place', () => {
  it('reads the same values for the 2nd place as for car 38 chosen by number', () => {
    // Arrange: the simulator at lap 34, where car 38 runs 2nd.
    const sources = buildSourcesWithTheSimulatorAtLap34([]);

    // Act: read the six fields both ways.
    const readByPlace = fieldsOfOneCar.map((fieldName) =>
      resolveBindingAgainstSources(
        buildBindingOfCarPickedByPlace(fieldName, 2),
        sources,
        contextWithNoTeams,
      ),
    );
    const readByNumber = fieldsOfOneCar.map((fieldName) =>
      resolveBindingAgainstSources(
        buildBindingOfCarPickedByNumber(fieldName, carRunningSecondAtLap34),
        sources,
        contextWithNoTeams,
      ),
    );

    // Assert: the same answers, field by field, and every one of them read.
    expect(readByPlace, 'the 2nd place must read what car 38 reads').toEqual(readByNumber);
    expect(
      readByPlace.map((resolution) => resolution.status),
      'every field of the 2nd place must be found',
    ).toEqual(fieldsOfOneCar.map(() => 'resolved'));
  });

  it('reads 2 for the position of the 2nd place', () => {
    // Arrange: the simulator at lap 34.
    const sources = buildSourcesWithTheSimulatorAtLap34([]);

    // Act: read the position of the 2nd place.
    const positionOfTheSecondPlace = resolveBindingAgainstSources(
      buildBindingOfCarPickedByPlace('position', 2),
      sources,
      contextWithNoTeams,
    );

    // Assert: the place itself.
    expect(positionOfTheSecondPlace, 'the 2nd place runs 2nd').toEqual({
      status: 'resolved',
      value: 2,
      isOverridden: false,
    });
  });
});
