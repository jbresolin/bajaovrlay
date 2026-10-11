/**
 * Preparing a command's data before the schema check (apps/server)
 *
 * What this module is for:
 *   The control page's generated forms send two things a graphic's schema knows nothing
 *   about. A field the operator cleared arrives as `null`, meaning "take this field
 *   out". And a field such as the race clock's reference moment is not sent at all:
 *   the command names it in `takeTimeFieldKeys` and the server writes the moment of the
 *   command into it, so no browser clock decides when a race clock started. The two
 *   functions here do those two jobs for the takeGraphic and updateInstanceData reducers.
 *
 * What these tests prove:
 *   - Fields sent as null are listed as cleared and every other field is kept as sent;
 *     `false`, `0` and an empty text are values, not cleared fields; a null deeper than
 *     the top level is left where it is.
 *   - Each named field gets the command's moment in milliseconds, replacing a value the
 *     data carried for it, and a field not named is left alone.
 *   - Neither function changes the data it was given.
 *
 * What these tests deliberately do not cover:
 *   - What the reducers do with the result (delete from what is on air, check against
 *     the manifest schema); takeGraphicClearedAndStampedFields.test.ts and
 *     updateInstanceDataClearedAndStampedFields.test.ts cover that.
 */
import { describe, expect, it } from 'vitest';

import {
  separateClearedFieldsFromData,
  stampFieldsWithMomentOfTheCommand,
} from './graphicDataPreparation.js';

// 14:32:05 UTC on 9 October 2026, as the store writes it and in wall-clock milliseconds.
const momentOfTheCommand = '2026-10-09T14:32:05.000Z';
const momentOfTheCommandInMilliseconds = 1_791_556_325_000;

describe('separateClearedFieldsFromData', () => {
  it('lists the fields sent as null and keeps every other field as sent', () => {
    // Arrange: race clock data in which the operator cleared the leader's laps.
    const dataWithClearedLaps = {
      sessionName: 'Enduro de Resistência',
      state: 'yellow',
      lapsCompletedByLeader: null,
    };

    // Act: split the data.
    const separated = separateClearedFieldsFromData(dataWithClearedLaps);

    // Assert: the laps are named as cleared and are no longer among the valued fields.
    expect(separated, 'a null field must be listed as cleared, not kept as a value').toEqual({
      keysOfClearedFields: ['lapsCompletedByLeader'],
      fieldsWithAValue: { sessionName: 'Enduro de Resistência', state: 'yellow' },
    });
  });

  it('treats false, zero and an empty text as values, and leaves a nested null alone', () => {
    // Arrange: a stopped clock at zero with an empty session name, and a leader object
    // whose team name is null (no graphic has such a field yet; M2 graphics may).
    const dataWithEmptyLookingValues = {
      sessionName: '',
      referenceTimeMs: 0,
      running: false,
      leader: { teamNumber: 42, teamName: null },
    };
    const copyOfTheData = structuredClone(dataWithEmptyLookingValues);

    // Act: split the data.
    const separated = separateClearedFieldsFromData(dataWithEmptyLookingValues);

    // Assert: nothing counts as cleared, every field is kept, and the input is untouched.
    expect(separated, 'only a top-level null means "cleared"').toEqual({
      keysOfClearedFields: [],
      fieldsWithAValue: copyOfTheData,
    });
    expect(dataWithEmptyLookingValues, 'the data handed in must not be changed').toEqual(
      copyOfTheData,
    );
  });
});

describe('stampFieldsWithMomentOfTheCommand', () => {
  const stampScenarios = [
    // The usual case: the page left the reference moment out and named it for stamping.
    {
      name: 'adds a named field that the data did not carry',
      data: { referenceTimeMs: 0, running: true },
      takeTimeFieldKeys: ['referenceWallClockMs'],
      expectedData: {
        referenceTimeMs: 0,
        running: true,
        referenceWallClockMs: momentOfTheCommandInMilliseconds,
      },
    },
    // A client that sent a moment of its own and also asked for the stamp gets the
    // server's moment: the server's clock is the one the race is timed by.
    {
      name: 'replaces a value the data carried for a named field',
      data: { referenceWallClockMs: 1_791_550_800_000, running: true },
      takeTimeFieldKeys: ['referenceWallClockMs'],
      expectedData: { referenceWallClockMs: momentOfTheCommandInMilliseconds, running: true },
    },
    // No field named: the commands sent before BAJAOVRLAY-14 must behave as they did.
    {
      name: 'leaves the data as it is when no field is named',
      data: { state: 'yellow' },
      takeTimeFieldKeys: [],
      expectedData: { state: 'yellow' },
    },
  ];

  it.each(stampScenarios)('$name', ({ data, takeTimeFieldKeys, expectedData }) => {
    // Arrange: the data of the command (from the table above), with a copy for comparison.
    const copyOfTheData = structuredClone(data);

    // Act: stamp the named fields with 14:32:05.
    const stampedData = stampFieldsWithMomentOfTheCommand(
      data,
      takeTimeFieldKeys,
      momentOfTheCommand,
    );

    // Assert: the named fields hold the moment in milliseconds; the input is untouched.
    expect(stampedData, 'each named field must hold the moment of the command').toEqual(
      expectedData,
    );
    expect(data, 'the data handed in must not be changed').toEqual(copyOfTheData);
  });
});
