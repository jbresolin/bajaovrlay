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
 *   - When the cars running 2nd and 3rd swap, the same bindings of the 2nd place read the
 *     other car, with no change to the item: that is what picking by place is for.
 *
 * What these tests deliberately do not cover:
 *   - A car chosen by number in every other way; bindingResolution.test.ts.
 *   - What the picker writes; ItemEditorPanelCarGroups.test.tsx in apps/control.
 */
import { describe, expect, it } from 'vitest';

import type { BindingFieldValue } from './bindingFieldValue.js';
import { resolveBindingAgainstSources, type SourcesForBindings } from './bindingResolution.js';
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

/**
 * The simulator at lap 34 after car 25 (Bem-te-vi Off-Road), 3rd, passed car 38 (Coruja
 * Racing), 2nd: the two entries trade places in the list and take each other's position.
 */
function buildSourcesAfterCar25PassedCar38(): SourcesForBindings {
  const sources = buildSourcesWithTheSimulatorAtLap34([]);
  const positions = sources.dataSnapshots[0]?.shapes.positions as {
    entries: Array<{ position: number; carNumber: number }>;
  };
  const carRunningSecond = positions.entries[1];
  const carRunningThird = positions.entries[2];
  if (carRunningSecond === undefined || carRunningThird === undefined) {
    throw new Error('the lap-34 sample must list a 2nd and a 3rd car');
  }
  carRunningThird.position = 2;
  carRunningSecond.position = 3;
  positions.entries[1] = carRunningThird;
  positions.entries[2] = carRunningSecond;
  return sources;
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

  it('reads the other car with the same bindings once the 3rd passes the 2nd', () => {
    // Arrange: car 25 has just passed car 38, so car 25 now runs 2nd.
    const sources = buildSourcesAfterCar25PassedCar38();

    // Act: read the 2nd place's position, number and team with the bindings an item holds.
    const [position, carNumber, teamName] = ['position', 'carNumber', 'teamName'].map(
      (fieldName) =>
        resolveBindingAgainstSources(
          buildBindingOfCarPickedByPlace(fieldName, 2),
          sources,
          contextWithNoTeams,
        ),
    );

    // Assert: the 2nd place is now car 25, Bem-te-vi Off-Road, still at position 2.
    expect(
      [position, carNumber, teamName].map((resolution) =>
        resolution?.status === 'resolved' ? resolution.value : resolution?.status,
      ),
      'the bindings of the 2nd place must follow the pass to car 25',
    ).toEqual([2, 25, 'Bem-te-vi Off-Road']);
  });
});
