/**
 * The positions paths a car pick writes (packages/shared)
 *
 * What this module is for:
 *   A car group's picker (BAJAOVRLAY-66) fills each field of the group with an ordinary
 *   binding to the positions: `entryOfCar.<meaning>` with the car's number when the car is
 *   picked by number, `entries.<index>.<meaning>` when it is picked by place. These
 *   functions write those paths, and read a stored path back into "which car, which
 *   field", so the editor can tell whether a group's fields all follow one car.
 *
 * What these tests prove:
 *   - The path of a field of a car picked by number, and of one picked by place (the 2nd
 *     place is index 1).
 *   - A stored path is read back into its pick, by number or by place, and a path that is
 *     no field of one car (the whole list, a place past the 10th, an unknown field) is not.
 *   - Every meaning a group may give has both of its paths listed, so a pick never writes
 *     a binding the save would refuse.
 *
 * What these tests deliberately do not cover:
 *   - Reading those paths in a snapshot; bindingResolutionCarPickedByPlace.test.ts.
 *   - Whether a group's fields agree; carGroupChoice.test.ts in apps/control.
 */
import { describe, expect, it } from 'vitest';

import { findBindablePath } from '../dataShapes/bindablePaths.js';
import { carFieldMeanings } from './carGroup.js';
import {
  buildPathOfCarFieldAtPlace,
  buildPathOfCarFieldChosenByNumber,
  highestPlaceACarCanBePickedAt,
  readCarPickOfPositionsPath,
} from './carGroupPaths.js';

describe('the paths a car pick writes', () => {
  it('writes the team of a car picked by number as the car-by-number path', () => {
    // Arrange: the team name meaning, as the battle card's "Equipe do carro da frente" has.
    const meaning = 'teamName';

    // Act: write its path for a car picked by number.
    const path = buildPathOfCarFieldChosenByNumber(meaning);

    // Assert: the path that finds the car wherever it runs.
    expect(path, 'a car picked by number reads entryOfCar').toBe('entryOfCar.teamName');
  });

  it('writes the laps of the 2nd place as the path of the second entry', () => {
    // Arrange: the laps meaning, for the car running 2nd.
    const meaning = 'laps';

    // Act: write its path for the 2nd place.
    const path = buildPathOfCarFieldAtPlace(meaning, 2);

    // Assert: the list counts from 0, so the 2nd place is entry 1.
    expect(path, 'the 2nd place is the entry at index 1').toBe('entries.1.laps');
  });
});

describe('readCarPickOfPositionsPath', () => {
  // Each row is one stored path; the reading says which car and which field it follows.
  const pathReadingScenarios = [
    {
      // The battle card's fields as BAJAOVRLAY-47 stored them: car chosen by number.
      name: 'reads a car-by-number path as a pick by number',
      path: 'entryOfCar.schoolName',
      expected: { pickedBy: 'number', meaning: 'schoolName' },
    },
    {
      // A field of the car in 3rd, as "Disputa pela 2ª posição" writes for the car behind.
      name: 'reads a place path as a pick by place, counted from 1',
      path: 'entries.2.intervalMs',
      expected: { pickedBy: 'place', placeNumber: 3, meaning: 'intervalMs' },
    },
    {
      // The position of a place, listed so a place fills its position field too.
      name: 'reads the position of a place',
      path: 'entries.0.position',
      expected: { pickedBy: 'place', placeNumber: 1, meaning: 'position' },
    },
    {
      // The whole list is the tower's, never one car's.
      name: 'reads nothing for the whole list',
      path: 'entries',
      expected: undefined,
    },
    {
      // Only the first ten places have paths of their own.
      name: 'reads nothing for the 11th place',
      path: 'entries.10.teamName',
      expected: undefined,
    },
    {
      // A field that is no field of a car cannot be part of a pick.
      name: 'reads nothing for an unknown field of a car',
      path: 'entryOfCar.sponsorName',
      expected: undefined,
    },
  ];

  it.each(pathReadingScenarios)('$name', ({ path, expected }) => {
    // Arrange: the stored path of the row.

    // Act: read which car and field it follows.
    const reading = readCarPickOfPositionsPath(path);

    // Assert: the pick, or nothing for a path that is no field of one car.
    expect(reading, `the path ${path} must be read as the row says`).toEqual(expected);
  });
});

describe('the meanings and the listed paths', () => {
  it('lists both paths of every meaning a car group may give, up to the 10th place', () => {
    // Arrange: every meaning, and the highest place a car can be picked at.
    const meanings = carFieldMeanings;

    // Act: look up the car-by-number path and the last place's path of each.
    const meaningsMissingAPath = meanings.filter(
      (meaning) =>
        findBindablePath('positions', buildPathOfCarFieldChosenByNumber(meaning)) === undefined ||
        findBindablePath(
          'positions',
          buildPathOfCarFieldAtPlace(meaning, highestPlaceACarCanBePickedAt),
        ) === undefined,
    );

    // Assert: none is missing, so a pick never writes a path the save refuses.
    expect(highestPlaceACarCanBePickedAt, 'places go up to the 10th').toBe(10);
    expect(meaningsMissingAPath, 'every meaning must have both of its paths').toEqual([]);
  });
});
