/**
 * The carryClockForward update rule at a press between two whole seconds (apps/server)
 *
 * What this module is for:
 *   The race clock holds its time in milliseconds and shows whole seconds. A clock that
 *   counts up drops the unfinished second; a countdown counts the started second as a
 *   whole one. An operator almost never presses "Atualizar" exactly on a whole second.
 *   If the rule turned a clock around keeping the time to the millisecond, the same
 *   45:00.5 that read 45:00 counting up would read 45:01 counting down: the number on
 *   screen would move by one second at the press. So when the direction of the clock
 *   changes, the rule writes the whole second the screen was showing.
 *
 * What these tests prove (every press is half a second past 10:00):
 *   - Turning a running clock around, in either direction, leaves on screen the very
 *     number that was there before the press. The same holds for a held clock, and for
 *     a clock stopped and turned around in one update.
 *   - Stopping or starting a clock without turning it keeps the time to the
 *     millisecond: its direction, and so its rounding, did not change.
 *   - A typed time is written as typed, also when the clock is turned around with it.
 *
 * What these tests deliberately do not cover:
 *   - The rule at whole-second moments and its other branches; carryClockForward.test.ts.
 *   - The rounding itself; packages/shared's clockWholeSeconds.test.ts covers it.
 *   - Turning the seconds into the text on air; the race clock's clockFormatting.test.ts.
 */
import {
  type ClockReading,
  computeClockTimeMsAtWallClock,
  countWholeSecondsClockShows,
} from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { carryClockForward } from './carryClockForward.js';

// The clock went on air at 9:45:00 in Brasília on the Saturday of the endurance race,
// and the operator presses "Atualizar" at 10:00:00.5: 15 minutes and half a second later.
const momentTheClockWentOnAirMs = Date.parse('2026-10-10T12:45:00.000Z');
const momentOfThePressMs = Date.parse('2026-10-10T13:00:00.500Z');

/** Builds the reading of a clock counting up from 30:00 since 9:45: 45:00.5 at the press. */
function buildClockCountingUpFromThirtyMinutes(): ClockReading {
  return {
    clockMode: 'elapsed',
    referenceTimeMs: 1_800_000,
    referenceWallClockMs: momentTheClockWentOnAirMs,
    running: true,
  };
}

/** Builds the reading of a 30:00 countdown started at 9:45: 14:59.5 left at the press. */
function buildThirtyMinuteCountdown(): ClockReading {
  return { ...buildClockCountingUpFromThirtyMinutes(), clockMode: 'remaining' };
}

/** Builds the reading of a clock held at 45:00.5, as a stop between two seconds leaves it. */
function buildClockHeldBetweenTwoSeconds(): ClockReading {
  return { ...buildClockCountingUpFromThirtyMinutes(), referenceTimeMs: 2_700_500, running: false };
}

/** Builds the race clock data on air around a reading: the first heat under the green flag. */
function buildFirstHeatDataOnAirWith(readingOnAir: ClockReading): Record<string, unknown> {
  return { sessionName: 'Enduro de Resistência — Bateria 1', state: 'green', ...readingOnAir };
}

/** Counts the whole seconds the screen shows for a reading at the moment of the press. */
function countWholeSecondsOnScreenAtThePress(reading: ClockReading): number {
  const clockTimeMs = computeClockTimeMsAtWallClock(reading, momentOfThePressMs);
  return countWholeSecondsClockShows(clockTimeMs, reading.clockMode);
}

const scenariosOfAPressBetweenTwoWholeSeconds: Array<{
  name: string;
  readingOnAir: ClockReading;
  fieldsSent: Partial<ClockReading>;
  expectedFieldsToWrite: Partial<ClockReading>;
  expectedWholeSecondsOnScreen: number;
}> = [
  // Counting up, 45:00.5 reads 45:00. Kept to the millisecond, the countdown would read
  // 45:01 at the press. The whole 45:00 (2 700 000 ms) is written instead.
  {
    name: 'keeps 45:00 on screen when a clock counting up is turned into a countdown',
    readingOnAir: buildClockCountingUpFromThirtyMinutes(),
    fieldsSent: { clockMode: 'remaining' },
    expectedFieldsToWrite: {
      clockMode: 'remaining',
      referenceTimeMs: 2_700_000,
      referenceWallClockMs: momentOfThePressMs,
    },
    expectedWholeSecondsOnScreen: 2_700,
  },
  // The other way: 14:59.5 left reads 15:00. Kept to the millisecond, counting up would
  // read 14:59. The whole 15:00 (900 000 ms) is written instead.
  {
    name: 'keeps 15:00 on screen when a countdown is turned into a clock counting up',
    readingOnAir: buildThirtyMinuteCountdown(),
    fieldsSent: { clockMode: 'elapsed' },
    expectedFieldsToWrite: {
      clockMode: 'elapsed',
      referenceTimeMs: 900_000,
      referenceWallClockMs: momentOfThePressMs,
    },
    expectedWholeSecondsOnScreen: 900,
  },
  // A held clock keeps the half second it was stopped at, so turning it has the same trap.
  {
    name: 'keeps 45:00 on screen when a held clock is turned around',
    readingOnAir: buildClockHeldBetweenTwoSeconds(),
    fieldsSent: { clockMode: 'remaining' },
    expectedFieldsToWrite: {
      clockMode: 'remaining',
      referenceTimeMs: 2_700_000,
      referenceWallClockMs: momentOfThePressMs,
    },
    expectedWholeSecondsOnScreen: 2_700,
  },
  // Stopped and turned around in one update: the direction changed, so the same rule.
  {
    name: 'keeps 45:00 on screen when a clock is stopped and turned around together',
    readingOnAir: buildClockCountingUpFromThirtyMinutes(),
    fieldsSent: { clockMode: 'remaining', running: false },
    expectedFieldsToWrite: {
      clockMode: 'remaining',
      running: false,
      referenceTimeMs: 2_700_000,
      referenceWallClockMs: momentOfThePressMs,
    },
    expectedWholeSecondsOnScreen: 2_700,
  },
  // A stop alone does not change the direction, so nothing is rounded: the half second
  // stays in the data and the restart goes on from exactly where the clock stopped.
  {
    name: 'keeps the time to the millisecond when a clock is only stopped',
    readingOnAir: buildClockCountingUpFromThirtyMinutes(),
    fieldsSent: { running: false },
    expectedFieldsToWrite: {
      running: false,
      referenceTimeMs: 2_700_500,
      referenceWallClockMs: momentOfThePressMs,
    },
    expectedWholeSecondsOnScreen: 2_700,
  },
  // The same for a countdown: 14:59.5 left stays 14:59.5 left, which reads 15:00.
  {
    name: 'keeps the time left to the millisecond when a countdown is only stopped',
    readingOnAir: buildThirtyMinuteCountdown(),
    fieldsSent: { running: false },
    expectedFieldsToWrite: {
      running: false,
      referenceTimeMs: 899_500,
      referenceWallClockMs: momentOfThePressMs,
    },
    expectedWholeSecondsOnScreen: 900,
  },
  // A restart alone: the held 45:00.5 goes on from the press, half second included.
  {
    name: 'keeps the time to the millisecond when a held clock is only started',
    readingOnAir: buildClockHeldBetweenTwoSeconds(),
    fieldsSent: { running: true },
    expectedFieldsToWrite: {
      running: true,
      referenceTimeMs: 2_700_500,
      referenceWallClockMs: momentOfThePressMs,
    },
    expectedWholeSecondsOnScreen: 2_700,
  },
];

describe('carryClockForward at a press between two whole seconds', () => {
  it.each(scenariosOfAPressBetweenTwoWholeSeconds)(
    '$name',
    ({ readingOnAir, fieldsSent, expectedFieldsToWrite, expectedWholeSecondsOnScreen }) => {
      // Arrange: the first heat on air with the clock of the scenario, and the number of
      // whole seconds the screen shows just before the press.
      const dataOnAir = buildFirstHeatDataOnAirWith(readingOnAir);
      const wholeSecondsOnScreenBefore = countWholeSecondsOnScreenAtThePress(readingOnAir);

      // Act: run the rule for the update that arrives at 10:00:00.5.
      const result = carryClockForward(dataOnAir, fieldsSent, [], [], momentOfThePressMs);

      // Assert: the fields the scenario expects; and the clock they leave on air shows,
      // at the press, the same number of whole seconds the screen showed before it.
      const readingLeftOnAir: ClockReading = { ...readingOnAir, ...expectedFieldsToWrite };
      const wholeSecondsOnScreenAfter = countWholeSecondsOnScreenAtThePress(readingLeftOnAir);
      expect(result.fieldsToWrite, 'the rule must write the fields the scenario names').toEqual(
        expectedFieldsToWrite,
      );
      expect(
        wholeSecondsOnScreenBefore,
        'the scenario must start from the number on screen it describes',
      ).toBe(expectedWholeSecondsOnScreen);
      expect(
        wholeSecondsOnScreenAfter,
        'the number on screen must be the same just after the press as just before it',
      ).toBe(expectedWholeSecondsOnScreen);
    },
  );

  it('writes a typed time as typed when the clock is turned around with it', () => {
    // Arrange: the clock counting up, showing 45:00 at the press.
    const dataOnAir = buildFirstHeatDataOnAirWith(buildClockCountingUpFromThirtyMinutes());

    // Act: the operator types 20:00.5 (1 200 500 ms) and turns the clock into a countdown.
    const result = carryClockForward(
      dataOnAir,
      { clockMode: 'remaining', referenceTimeMs: 1_200_500 },
      [],
      [],
      momentOfThePressMs,
    );

    // Assert: the typed time is not rounded; it is the operator's own number.
    expect(result.fieldsToWrite, 'a typed time must be written exactly as typed').toEqual({
      clockMode: 'remaining',
      referenceTimeMs: 1_200_500,
      referenceWallClockMs: momentOfThePressMs,
    });
  });
});
