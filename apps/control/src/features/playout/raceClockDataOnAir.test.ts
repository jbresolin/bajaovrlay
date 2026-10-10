/**
 * Race clock data on air: reading it, and showing it in the form (apps/control)
 *
 * What this module is for:
 *   The server holds the data of the race clock that is on air. The control page reads
 *   it for two things: to work out which time the clock shows right now, and to fill the
 *   form with what is on air, so the operator starts from the truth and not from the
 *   form's defaults. The server stores that data as "any object", so it is checked first.
 *
 * What these tests prove:
 *   - Data that follows the race clock's manifest is read as it is, with or without the
 *     leader's laps; anything else (no data, missing fields, a field of the wrong kind)
 *     is "not readable".
 *   - The time the clock shows now: a running clock has moved on since its reference
 *     moment (forwards for elapsed time, backwards for remaining time, never below zero)
 *     and a stopped clock has not moved.
 *   - The form built from on-air data repeats the session name, flag, mode, running and
 *     laps, and shows the time the clock shows now as mm:ss, rounded as the graphic
 *     rounds it (elapsed down, remaining up).
 *
 * What these tests deliberately do not cover:
 *   - When the panel puts these values into the form; TakeRaceClockPanel.test.tsx and
 *     TakeRaceClockPanelUpdate.test.tsx do.
 *   - The graphic's own arithmetic (packages/graphics/race-clock); this module repeats
 *     the same sum on purpose and nothing checks that the two stay in step.
 */
import { describe, expect, it } from 'vitest';

import {
  buildRaceClockFormValuesFromDataOnAir,
  findTimeShownOnAir,
  readRaceClockDataOnAir,
} from './raceClockDataOnAir';
import type { RaceClockData } from './raceClockTakeForm';

// The clock went on air at 9:45 in Brasília on the Saturday of the endurance race, and
// "now" is 10:00: 15 minutes (900 000 ms) later.
const momentTheClockWentOnAirInMilliseconds = Date.parse('2026-10-10T12:45:00.000Z');
const nowInMilliseconds = Date.parse('2026-10-10T13:00:00.000Z');

/** The three things about the clock on air that decide which time it shows now. */
type ClockOnAir = {
  clockMode: 'elapsed' | 'remaining';
  referenceTimeMs: number;
  running: boolean;
};

/** The first heat of the endurance race on air under the green flag since 9:45. */
function buildRaceClockDataOnAir(clockOnAir: ClockOnAir): RaceClockData {
  return {
    sessionName: 'Enduro de Resistência — Bateria 1',
    state: 'green',
    clockMode: clockOnAir.clockMode,
    referenceTimeMs: clockOnAir.referenceTimeMs,
    referenceWallClockMs: momentTheClockWentOnAirInMilliseconds,
    running: clockOnAir.running,
  };
}

describe('readRaceClockDataOnAir', () => {
  it('reads data that follows the manifest, with the laps of the leader', () => {
    // Arrange: what the server holds for a race clock taken with 7 laps on it.
    const resolvedDataOfTheInstance: unknown = {
      sessionName: 'Enduro de Resistência — Bateria 1',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: momentTheClockWentOnAirInMilliseconds,
      running: true,
      lapsCompletedByLeader: 7,
    };

    // Act: read it.
    const raceClockDataOnAir = readRaceClockDataOnAir(resolvedDataOfTheInstance);

    // Assert: every field comes back as the server holds it.
    expect(raceClockDataOnAir, 'readable data must come back unchanged').toEqual({
      sessionName: 'Enduro de Resistência — Bateria 1',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: momentTheClockWentOnAirInMilliseconds,
      running: true,
      lapsCompletedByLeader: 7,
    });
  });

  it('reads data without the laps, which are optional', () => {
    // Arrange: a race clock taken with the laps field left blank.
    const resolvedDataOfTheInstance: unknown = buildRaceClockDataOnAir({
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      running: true,
    });

    // Act: read it.
    const raceClockDataOnAir = readRaceClockDataOnAir(resolvedDataOfTheInstance);

    // Assert: it is readable, and it has no laps.
    expect(raceClockDataOnAir?.sessionName, 'data without laps must still be readable').toBe(
      'Enduro de Resistência — Bateria 1',
    );
    expect(
      raceClockDataOnAir?.lapsCompletedByLeader,
      'laps that are not on air must stay absent',
    ).toBeUndefined();
  });

  const dataThatCannotBeRead = [
    // The panel hands over undefined when no race clock is on air.
    { name: 'answers "not readable" when there is no data at all', resolvedData: undefined },
    // Data of another graphic, or of an older race clock: the clock fields are missing.
    {
      name: 'answers "not readable" when the clock fields are missing',
      resolvedData: { sessionName: 'Enduro de Resistência — Bateria 1', state: 'green' },
    },
    // A field of the wrong kind (text where a number belongs) is not trusted.
    {
      name: 'answers "not readable" when the reference time is text',
      resolvedData: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: '12:34',
        referenceWallClockMs: momentTheClockWentOnAirInMilliseconds,
        running: true,
      },
    },
    // A flag the form has no option for could not be shown, so it is not trusted either.
    {
      name: 'answers "not readable" when the flag is not one of the six',
      resolvedData: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'azul',
        clockMode: 'elapsed',
        referenceTimeMs: 754_000,
        referenceWallClockMs: momentTheClockWentOnAirInMilliseconds,
        running: true,
      },
    },
  ];

  it.each(dataThatCannotBeRead)('$name', ({ resolvedData }) => {
    // Arrange: data that is not race clock data (see the scenario).

    // Act: try to read it.
    const raceClockDataOnAir = readRaceClockDataOnAir(resolvedData);

    // Assert: there is no result, which is how callers know not to build on it.
    expect(raceClockDataOnAir, 'data that breaks the manifest must not be read').toBeUndefined();
  });
});

describe('findTimeShownOnAir', () => {
  const clocksAndTheTimeTheyShowNow = [
    // 15 minutes after a take at 12:34 a running clock shows 12:34 + 15:00 = 27:34.
    {
      name: 'a running elapsed clock has moved forwards',
      clockOnAir: { clockMode: 'elapsed', referenceTimeMs: 754_000, running: true },
      expectedTimeShownMs: 1_654_000,
    },
    // A clock stopped under a red flag has shown 12:34 all along.
    {
      name: 'a stopped elapsed clock has not moved',
      clockOnAir: { clockMode: 'elapsed', referenceTimeMs: 754_000, running: false },
      expectedTimeShownMs: 754_000,
    },
    // A countdown runs the other way: four hours less the 15 minutes is 3 h 45 min.
    {
      name: 'a running countdown has moved backwards',
      clockOnAir: { clockMode: 'remaining', referenceTimeMs: 14_400_000, running: true },
      expectedTimeShownMs: 13_500_000,
    },
    // A ten-minute countdown ran out 5 minutes ago. It shows 0:00; the data must not go
    // negative (the graphic refuses a reference time below zero).
    {
      name: 'a countdown that already ran out stays at zero',
      clockOnAir: { clockMode: 'remaining', referenceTimeMs: 600_000, running: true },
      expectedTimeShownMs: 0,
    },
    // A stopped countdown is not moved either.
    {
      name: 'a stopped countdown has not moved',
      clockOnAir: { clockMode: 'remaining', referenceTimeMs: 600_000, running: false },
      expectedTimeShownMs: 600_000,
    },
  ] as const;

  it.each(clocksAndTheTimeTheyShowNow)('$name', ({ clockOnAir, expectedTimeShownMs }) => {
    // Arrange: the clock on air since 9:45 as the scenario says.
    const raceClockDataOnAir = buildRaceClockDataOnAir(clockOnAir);

    // Act: ask which time it shows at 10:00.
    const timeShownOnAir = findTimeShownOnAir(raceClockDataOnAir, nowInMilliseconds);

    // Assert: the time is the one a viewer sees on the clock at that moment.
    expect(timeShownOnAir, 'the time must be the one the clock on air shows now').toBe(
      expectedTimeShownMs,
    );
  });
});

describe('buildRaceClockFormValuesFromDataOnAir', () => {
  it('fills every field from what is on air, with the time the clock shows now', () => {
    // Arrange: a running clock on air since 9:45 at 12:34, with 7 laps for the leader.
    const raceClockDataOnAir: RaceClockData = {
      ...buildRaceClockDataOnAir({ clockMode: 'elapsed', referenceTimeMs: 754_000, running: true }),
      lapsCompletedByLeader: 7,
    };

    // Act: build the form's values at 10:00.
    const formValues = buildRaceClockFormValuesFromDataOnAir(raceClockDataOnAir, nowInMilliseconds);

    // Assert: the form repeats what is on air, and its time is 27:34, not the 12:34 of the take.
    expect(formValues, 'the form must show what is on air right now').toEqual({
      sessionName: 'Enduro de Resistência — Bateria 1',
      state: 'green',
      clockMode: 'elapsed',
      running: true,
      referenceTime: '27:34',
      lapsCompletedByLeader: '7',
    });
  });

  it('leaves the laps field blank when no laps are on air', () => {
    // Arrange: a clock on air without the leader's laps.
    const raceClockDataOnAir = buildRaceClockDataOnAir({
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      running: false,
    });

    // Act: build the form's values.
    const formValues = buildRaceClockFormValuesFromDataOnAir(raceClockDataOnAir, nowInMilliseconds);

    // Assert: the laps field is empty, which is how the form says "do not show laps".
    expect(formValues.lapsCompletedByLeader, 'absent laps must be an empty field').toBe('');
  });

  const partsOfASecondAndHowTheFormShowsThem = [
    // The graphic rounds an elapsed clock down: 27:34.4 is still 27:34 on screen.
    {
      name: 'shows an elapsed clock rounded down, as the graphic does',
      clockMode: 'elapsed',
      referenceTimeMs: 754_400,
      expectedReferenceTime: '27:34',
    },
    // The graphic rounds a countdown up, so it reads 0:00 only at zero: with 3 h 44 min
    // 59.6 s left the screen says 225:00.
    {
      name: 'shows a countdown rounded up, as the graphic does',
      clockMode: 'remaining',
      referenceTimeMs: 14_399_600,
      expectedReferenceTime: '225:00',
    },
  ] as const;

  it.each(partsOfASecondAndHowTheFormShowsThem)(
    '$name',
    ({ clockMode, referenceTimeMs, expectedReferenceTime }) => {
      // Arrange: a running clock whose time is not on a whole second (see the scenario).
      const raceClockDataOnAir = buildRaceClockDataOnAir({
        clockMode,
        referenceTimeMs,
        running: true,
      });

      // Act: build the form's values at 10:00, 15 minutes after the take.
      const formValues = buildRaceClockFormValuesFromDataOnAir(
        raceClockDataOnAir,
        nowInMilliseconds,
      );

      // Assert: the form shows the same digits a viewer sees on the clock.
      expect(formValues.referenceTime, 'the form must show the digits that are on screen').toBe(
        expectedReferenceTime,
      );
    },
  );
});
