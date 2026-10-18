/**
 * The cars' statuses once a simulated session is finished (apps/server)
 *
 * What this module is for:
 *   buildShapesFromRaceState reports each car's status in the positions shape. That
 *   shape has no "finished" status: a car that took the checkered flag reads 'running'.
 *   So once the session is finished, a car the race state still has in the pits or
 *   stopped is reported 'running' too, like every other finisher.
 *
 * What these tests prove:
 *   - Once finished, a car left in the pits or stopped reads 'running'; a retired car
 *     stays retired.
 *   - While the checkered flag is still out, a car in the pits still reads in the pits.
 *   - In three seeded races (the default, 100 cars, a day-long session), no car is
 *     left in the pits or stopped once the session is finished.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the shapes (shapesFromRaceState.test.ts).
 *   - When the checkered flag and the finish come (simulateEnduro.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { buildShapesFromRaceState } from './shapesFromRaceState.js';
import { type EnduroRaceState, simulateEnduroAt } from './simulateEnduro.js';

const fourHoursMs = 4 * 60 * 60 * 1000;
const oneMinuteMs = 60_000;
/** The longest session SimulatorConfigSchema accepts: 1440 minutes. */
const oneDayMs = 24 * 60 * oneMinuteMs;
const defaultRace = { seed: 2027, carCount: 60, sessionDurationMs: fourHoursMs };
/** 14:00:00 UTC on 14 August 2027, the wall-clock moment of the poll. */
const pollAtWallClockMs = Date.parse('2027-08-14T14:00:00.000Z');

describe('the cars once the session is finished', () => {
  it('reports a car left in the pits or stopped at the finish as finished, like the others', () => {
    // Arrange: the 2027 race once finished, with car 25 (the winner) put back in the
    // pits and car 12 put back on a repair, and car 58 retired as it is. Today's numbers
    // (a stop of 4 min at most, a repair of 15 min at most, 15 min of checkered flag)
    // never leave a car there at the finish, so the race state is changed by hand: the
    // rule must hold if those numbers change.
    const finishedRace = simulateEnduroAt(defaultRace, fourHoursMs + 2 * 60 * oneMinuteMs);
    const raceWithCarsLeftBehind: EnduroRaceState = {
      ...finishedRace,
      cars: finishedRace.cars.map((car) => {
        if (car.carNumber === 25) {
          return { ...car, status: 'inPit' as const };
        }
        if (car.carNumber === 12) {
          return { ...car, status: 'stopped' as const };
        }
        return car;
      }),
    };

    // Act: build the positions as a poll at 14:00 would.
    const positions = buildShapesFromRaceState(raceWithCarsLeftBehind, pollAtWallClockMs).positions;

    // Assert: cars 25 and 12 read running like every other finisher; car 58 stays retired.
    const statusOfCar = (carNumber: number) =>
      positions.entries.find((entry) => entry.carNumber === carNumber)?.status;
    expect(finishedRace.flag, 'the session must be finished').toBe('finished');
    expect(statusOfCar(25), 'car 25, left in the pits, must read as finished').toBe('running');
    expect(statusOfCar(12), 'car 12, left on a repair, must read as finished').toBe('running');
    expect(statusOfCar(58), 'car 58 retired and must stay retired').toBe('retired');
  });

  it('keeps a car in the pits in the pits while the checkered flag is still out', () => {
    // Arrange: the 2027 race five minutes into the checkered flag, car 25 put in the
    // pits by hand: it can still come out and cross the line.
    const checkeredRace = simulateEnduroAt(defaultRace, fourHoursMs + 5 * oneMinuteMs);
    const raceWithCar25InThePits: EnduroRaceState = {
      ...checkeredRace,
      cars: checkeredRace.cars.map((car) =>
        car.carNumber === 25 ? { ...car, status: 'inPit' as const } : car,
      ),
    };

    // Act: build the positions.
    const positions = buildShapesFromRaceState(raceWithCar25InThePits, pollAtWallClockMs).positions;

    // Assert: the flag is checkered, not finished, and car 25 is still in the pits.
    expect(checkeredRace.flag, 'the checkered flag must still be out').toBe('checkered');
    expect(
      positions.entries.find((entry) => entry.carNumber === 25)?.status,
      'before the finish a car in the pits is in the pits',
    ).toBe('inPit');
  });

  const finishedRaceScenarios = [
    // The default race, as the seeded source runs it.
    { name: 'the default race', race: defaultRace },
    // A full field of 100 cars over four hours, more cars to be caught out.
    {
      name: '100 cars, seed 21',
      race: { seed: 21, carCount: 100, sessionDurationMs: fourHoursMs },
    },
    // The longest session the config accepts (24 h), where about nine cars in ten
    // break down (15 % per four hours, times six).
    {
      name: 'a day-long session, seed 7',
      race: { seed: 7, carCount: 60, sessionDurationMs: oneDayMs },
    },
  ];

  it.each(finishedRaceScenarios)('leaves every car running or retired in $name', ({ race }) => {
    // Arrange: two hours after the session's time is up, long after it finished.
    const finishedAtMs = race.sessionDurationMs + 2 * 60 * oneMinuteMs;

    // Act: build the positions of the finished race.
    const positions = buildShapesFromRaceState(
      simulateEnduroAt(race, finishedAtMs),
      pollAtWallClockMs,
    ).positions;

    // Assert: no car is left in the pits or stopped.
    const carsNeitherRunningNorRetired = positions.entries
      .filter((entry) => entry.status !== 'running' && entry.status !== 'retired')
      .map((entry) => `${String(entry.carNumber)}: ${entry.status}`);
    expect(
      carsNeitherRunningNorRetired,
      'once finished, every car is running (finished) or retired',
    ).toEqual([]);
  });
});
