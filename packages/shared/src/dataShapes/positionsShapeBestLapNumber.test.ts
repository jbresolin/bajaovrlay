/**
 * The lap of each car's best lap in the positions shape (packages/shared)
 *
 * What this module is for:
 *   The fastest-lap notice says on which lap the time was set ("VOLTA 34", PR #21's
 *   design). `bestLapMs` alone does not say it, so a positions entry gains
 *   `bestLapNumber` (BAJAOVRLAY-44): optional, a lap counted from 1. Optional means "the
 *   source does not know", like every other optional field of the shape.
 *
 * What these tests prove:
 *   - A car with `bestLapNumber` passes, and the value comes through unchanged.
 *   - A car without it passes: the field is optional.
 *   - Lap 0 and a fractional lap are refused with the pt-BR sentence naming the car's
 *     path.
 *
 * What these tests deliberately do not cover:
 *   - Whether the number agrees with `bestLapMs` and `laps`: the shape sets no rule across
 *     the two (a source may count laps its own way), and the simulator's own tests prove
 *     it fills them consistently.
 *   - Where a binding or a flex mapping reads it; bindablePaths.test.ts and
 *     mappableFields.test.ts list it there.
 */
import { describe, expect, it } from 'vitest';

import { buildPositionsAtTheStart, readPositionsSample } from './positionsShape.testSupport.js';
import { validateDataShape } from './validateDataShape.js';

describe('bestLapNumber on a car in the positions', () => {
  it('accepts the leader with its best lap set on lap 29 and keeps the number', () => {
    // Arrange: the 60-car sample with the leader, car 31, whose best lap was its 29th.
    const positions = readPositionsSample();
    positions.entries[0] = { ...positions.entries[0], bestLapNumber: 29 };

    // Act: validate it as positions.
    const validation = validateDataShape('positions', positions);

    // Assert: valid, and the parsed shape is the payload, the lap number included.
    expect(validation, 'a whole lap number from 1 must be accepted and kept').toEqual({
      isValid: true,
      shape: positions,
    });
  });

  it('accepts cars with no bestLapNumber at all, because the field is optional', () => {
    // Arrange: two cars at the start, with no lap yet and so no best lap.
    const positions = buildPositionsAtTheStart();

    // Act: validate it as positions.
    const validation = validateDataShape('positions', positions);

    // Assert: valid; a source that does not say on which lap is not wrong.
    expect(validation, 'a car without bestLapNumber must be accepted as it is').toEqual({
      isValid: true,
      shape: positions,
    });
  });

  const refusedBestLapNumberScenarios = [
    // Laps are counted from 1; a lap 0 is a placeholder for "unknown", which is left out.
    {
      name: 'refuses lap 0',
      bestLapNumber: 0,
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.1.bestLapNumber": valor abaixo do mínimo.',
    },
    // A lap is counted whole; Zod reads a fraction as the wrong type.
    {
      name: 'refuses a fractional lap',
      bestLapNumber: 12.5,
      expectedErrorMessage:
        'Dados inválidos em "positions.entries.1.bestLapNumber": campo ausente ou de tipo errado.',
    },
  ];

  it.each(refusedBestLapNumberScenarios)('$name', ({ bestLapNumber, expectedErrorMessage }) => {
    // Arrange: the sample with the 2nd-placed car, car 38, carrying this row's bad lap.
    const positions = readPositionsSample();
    positions.entries[1] = { ...positions.entries[1], bestLapNumber };

    // Act: validate it as positions.
    const validation = validateDataShape('positions', positions);

    // Assert: refused, naming the 2nd car's bestLapNumber and this row's reason.
    expect(validation, 'the bad lap number must be refused at the path of that car').toEqual({
      isValid: false,
      errorMessage: expectedErrorMessage,
    });
  });
});
