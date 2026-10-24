/**
 * Fuel stops in the positions shape (packages/shared)
 *
 * What this module is for:
 *   The positions tower's detailed layout has an "ABAST." column: how many times a car
 *   refuelled. The positions shape carries it as `fuelStops`, an optional whole number
 *   from zero, next to `pitStops` (BAJAOVRLAY-22). Optional means "the source does not
 *   know", like every other optional field of the shape: a source that counts pit stops
 *   but not refuels leaves it out, and the tower shows the column's empty mark.
 *
 * What these tests prove:
 *   - A car with `fuelStops` passes, and the value comes through unchanged.
 *   - A car without it passes: the field is optional.
 *   - A negative or a fractional `fuelStops` is refused with the pt-BR sentence naming
 *     the car's path, so the operator reads which car's count is wrong.
 *
 * What these tests deliberately do not cover:
 *   - The rules across cars (order, gaps, intervals); positionsShape.test.ts covers them.
 *   - Where a binding or a flex mapping reads `fuelStops`; bindablePaths.test.ts and
 *     mappableFields.test.ts list it there.
 */
import { describe, expect, it } from 'vitest';

import { buildPositionsAtTheStart, readPositionsSample } from './positionsShape.testSupport.js';
import { validateDataShape } from './validateDataShape.js';

describe('fuelStops on a car in the positions', () => {
  it('accepts a car that refuelled twice and keeps the count', () => {
    // Arrange: the 60-car sample with the leader, car 31, marked as refuelled twice.
    const positions = readPositionsSample();
    positions.entries[0] = { ...positions.entries[0], fuelStops: 2 };

    // Act: validate it as positions.
    const validation = validateDataShape('positions', positions);

    // Assert: valid, and nothing was lost on the way: the parsed shape is the payload,
    // the leader's two refuels included.
    expect(validation, 'a whole number of refuels must be accepted and kept').toEqual({
      isValid: true,
      shape: positions,
    });
  });

  it('accepts a car with no fuelStops at all, because the field is optional', () => {
    // Arrange: two cars at the start of the race, neither saying anything about refuels.
    const positions = buildPositionsAtTheStart();

    // Act: validate it as positions.
    const validation = validateDataShape('positions', positions);

    // Assert: valid; a source that does not count refuels is not wrong.
    expect(validation, 'a car without fuelStops must be accepted as it is').toEqual({
      isValid: true,
      shape: positions,
    });
  });

  const refusedFuelStopsScenarios = [
    // A car cannot have refuelled a negative number of times; a source sending it is broken.
    {
      name: 'refuses a negative number of refuels',
      fuelStops: -1,
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.1.fuelStops": valor abaixo do mínimo.',
    },
    // Refuels are counted, so one and a half is not a count; Zod reads it as the wrong type.
    {
      name: 'refuses a fractional number of refuels',
      fuelStops: 1.5,
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.1.fuelStops": campo ausente ou de tipo errado.',
    },
  ];

  it.each(refusedFuelStopsScenarios)('$name', ({ fuelStops, expectedErrorMessage }) => {
    // Arrange: the sample with the 2nd-placed car, car 38, carrying this row's bad count.
    const positions = readPositionsSample();
    positions.entries[1] = { ...positions.entries[1], fuelStops };

    // Act: validate it as positions.
    const validation = validateDataShape('positions', positions);

    // Assert: refused, naming the 2nd car's fuelStops and this row's reason.
    expect(validation, 'the bad count must be refused at the path of that car').toEqual({
      isValid: false,
      errorMessage: expectedErrorMessage,
    });
  });
});
