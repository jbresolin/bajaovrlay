/**
 * The canonical shapes built from a simulated race (apps/server)
 *
 * What this module is for:
 *   shapesFromRaceState.ts turns the race state of simulateEnduroAt into the three
 *   shapes the simulator source answers: session (flag and remaining clock), positions
 *   (order, gaps, intervals, status) and overall standings (simulated points).
 *
 * What these tests prove:
 *   - All three shapes pass the canonical validators at the start, mid-race, during a
 *     yellow and after the checkered flag.
 *   - Positions are valid and consistent at many moments of the race: every car once,
 *     places 1..n, ordered by laps and then by who crossed the line first, gaps that
 *     agree with the laps, intervals that agree with the line crossings.
 *   - Every car's fuelStops equals its pitStops: in the simulator's model every pit stop
 *     is a refuel (a real scoring app may count them differently).
 *   - Every car's bestLapNumber names the lap that took its bestLapMs (BAJAOVRLAY-44).
 *   - The session clock counts down the remaining time, stops during a red and at zero.
 *   - Standings: overall points are the sum of the events, ranked high to low.
 *
 * What these tests deliberately do not cover:
 *   - How the race itself unfolds (simulateEnduro.test.ts).
 *   - The statuses once the session is finished (finishedSessionStatuses.test.ts).
 *   - Every rule of the shapes (packages/shared/src/dataShapes tests them).
 */
import { type PositionsShape, validateDataShape } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildFlagScheduleOfRace, convertElapsedTimeToRunningTime } from './flags.js';
import {
  findTheFirstSeedWithARedFlag,
  findTheMiddleOfTheFirstYellow,
} from './raceMoments.testSupport.js';
import { buildShapesFromRaceState } from './shapesFromRaceState.js';
import { type EnduroRaceState, simulateEnduroAt } from './simulateEnduro.js';

const fourHoursMs = 4 * 60 * 60 * 1000;
const oneMinuteMs = 60_000;
const defaultRace = { seed: 2027, carCount: 60, sessionDurationMs: fourHoursMs };
/** 14:00:00 UTC on 14 August 2027, the wall-clock moment of the poll. */
const pollAtWallClockMs = Date.parse('2027-08-14T14:00:00.000Z');

/** The elapsed moment in the middle of the first yellow of the 2027 race. */
function findTheMiddleOfTheFirstYellowOf2027(): number {
  return findTheMiddleOfTheFirstYellow(buildFlagScheduleOfRace(defaultRace.seed, fourHoursMs));
}

/** The last completed lap moment of a car in the race state, or 0 with no lap. */
function readLastLapMomentOfCar(raceState: EnduroRaceState, carNumber: number): number {
  const car = raceState.cars.find((candidate) => candidate.carNumber === carNumber);
  return car?.lapCompletedAtRunningMs.at(-1) ?? 0;
}

/** When a car crossed the line at the end of a given lap, or undefined before that lap. */
function readLapMomentOfCar(
  raceState: EnduroRaceState,
  carNumber: number,
  lapNumber: number,
): number | undefined {
  const car = raceState.cars.find((candidate) => candidate.carNumber === carNumber);
  return car?.lapCompletedAtRunningMs[lapNumber - 1];
}

/**
 * Checks every entry of a positions shape against the race it was built from: places
 * 1..n; laps never growing down the order; on the same lap, the car ahead crossed the
 * line first; a gap in ms on the leader's lap, in laps otherwise (none in ms then); an
 * interval, when given, equal to how much later this car crossed the line of its last
 * lap than the car ahead did.
 */
function expectPositionsToAgreeWithTheRace(
  positions: PositionsShape,
  raceState: EnduroRaceState,
  minute: string,
): void {
  const leader = positions.entries[0];
  positions.entries.forEach((entry, index) => {
    const carAhead = positions.entries[index - 1];
    expect(entry.position, `places must run 1..n (minute ${minute})`).toBe(index + 1);
    if (carAhead === undefined || leader === undefined) {
      return;
    }
    expect(
      entry.laps,
      `laps must never grow down the order (minute ${minute})`,
    ).toBeLessThanOrEqual(carAhead.laps);
    if (entry.laps === carAhead.laps && entry.laps > 0) {
      expect(
        readLastLapMomentOfCar(raceState, entry.carNumber),
        `on the same lap, the car ahead crossed the line first (minute ${minute})`,
      ).toBeGreaterThanOrEqual(readLastLapMomentOfCar(raceState, carAhead.carNumber));
    }
    if (leader.laps > 0 && entry.laps === leader.laps) {
      expect(
        entry.gapToLeaderMs,
        `a car on the leader's lap has a gap in ms (minute ${minute})`,
      ).toBeGreaterThanOrEqual(0);
    }
    if (entry.laps < leader.laps) {
      expect(
        entry.gapToLeaderLaps,
        `a lapped car's gap in laps is the laps it is behind (minute ${minute})`,
      ).toBe(leader.laps - entry.laps);
      expect(
        entry.gapToLeaderMs,
        `a lapped car has no gap in ms (minute ${minute})`,
      ).toBeUndefined();
    }
    if (entry.intervalMs !== undefined) {
      const carCrossedAtMs = readLapMomentOfCar(raceState, entry.carNumber, entry.laps);
      const carAheadCrossedAtMs = readLapMomentOfCar(raceState, carAhead.carNumber, entry.laps);
      expect(
        entry.intervalMs,
        `the interval is the time between the two crossings of the same lap (minute ${minute})`,
      ).toBe((carCrossedAtMs ?? 0) - (carAheadCrossedAtMs ?? 0));
    }
  });
}

describe('the shapes at the key moments of the race', () => {
  const momentScenarios = [
    // The green flag: nobody has a lap, so no gaps at all.
    { name: 'at the start', elapsedMs: () => 0, expectedFlag: 'green' },
    // The common case: two hours in, the field spread over several laps.
    { name: 'mid-race', elapsedMs: () => 2 * 60 * oneMinuteMs, expectedFlag: undefined },
    // The yellow slows the laps; the shapes must still hold together.
    {
      name: 'during a yellow',
      elapsedMs: findTheMiddleOfTheFirstYellowOf2027,
      expectedFlag: 'yellow',
    },
    // After the end, the clock is at zero and the cars are parked.
    {
      name: 'after the checkered flag',
      elapsedMs: () => fourHoursMs + 2 * 60 * oneMinuteMs,
      expectedFlag: 'finished',
    },
  ] as const;

  it.each(momentScenarios)('all three shapes are valid $name', ({ elapsedMs, expectedFlag }) => {
    // Arrange: the 2027 race at this moment.
    const raceState = simulateEnduroAt(defaultRace, elapsedMs());

    // Act: build the shapes as a poll at 14:00 would.
    const shapes = buildShapesFromRaceState(raceState, pollAtWallClockMs);

    // Assert: each shape passes its canonical validator, and the flag is the expected one.
    for (const shapeKey of ['session', 'positions', 'standings'] as const) {
      const validation = validateDataShape(shapeKey, shapes[shapeKey]);
      expect(
        validation.isValid ? 'valid' : validation.errorMessage,
        `the ${shapeKey} shape must be valid`,
      ).toBe('valid');
    }
    if (expectedFlag !== undefined) {
      expect(shapes.session.state, `the flag must be ${expectedFlag}`).toBe(expectedFlag);
    }
    expect(shapes.positions.entries, 'every car must be in the positions').toHaveLength(60);
    expect(shapes.standings.entries, 'every team must be in the standings').toHaveLength(60);
  });
});

describe('positions through the race', () => {
  it('are consistent at every seven minutes of the race', () => {
    // Arrange: every seven minutes from the start to well past the finish.
    const sampleMoments = Array.from({ length: 40 }, (_, index) => index * 7 * oneMinuteMs);

    // Act: build the race state and its positions at each moment.
    const positionsAtEachMoment = sampleMoments.map((elapsedMs) => {
      const raceState = simulateEnduroAt(defaultRace, elapsedMs);
      const positions = buildShapesFromRaceState(raceState, pollAtWallClockMs).positions;
      return { minute: String(elapsedMs / oneMinuteMs), raceState, positions };
    });

    // Assert: at each moment, the shape is valid, every car is listed once, and the
    // order, places, gaps and intervals agree with the race state.
    for (const { minute, raceState, positions } of positionsAtEachMoment) {
      const validation = validateDataShape('positions', positions);
      expect(
        validation.isValid ? 'valid' : validation.errorMessage,
        `the positions shape must be valid (minute ${minute})`,
      ).toBe('valid');
      const carNumbers = positions.entries.map((entry) => entry.carNumber);
      expect(new Set(carNumbers).size, `every car is listed once (minute ${minute})`).toBe(
        positions.entries.length,
      );
      expectPositionsToAgreeWithTheRace(positions, raceState, minute);
    }
  });

  it('puts every car in its grid order with no gaps at the start', () => {
    // Arrange: the race at the green flag.
    const raceState = simulateEnduroAt(defaultRace, 0);

    // Act: build the positions.
    const positions = buildShapesFromRaceState(raceState, pollAtWallClockMs).positions;

    // Assert: cars 1..60 in order, every one running with no lap, gap or interval.
    expect(
      positions.entries.map((entry) => entry.carNumber),
      'the grid is in car number order',
    ).toEqual(Array.from({ length: 60 }, (_, index) => index + 1));
    const entriesWithAGap = positions.entries.filter(
      (entry) =>
        entry.gapToLeaderMs !== undefined ||
        entry.gapToLeaderLaps !== undefined ||
        entry.intervalMs !== undefined,
    );
    expect(entriesWithAGap, 'nobody has a gap before the first lap').toEqual([]);
  });

  it("counts every car's refuels as its pit stops, because every simulated stop is a refuel", () => {
    // Arrange: the race two hours in, when the field has been through the pits.
    const raceState = simulateEnduroAt(defaultRace, 2 * 60 * oneMinuteMs);

    // Act: build the positions.
    const positions = buildShapesFromRaceState(raceState, pollAtWallClockMs).positions;

    // Assert: some cars have stopped by now, and each car's fuelStops is its pitStops.
    const carsThatStopped = positions.entries.filter((entry) => (entry.pitStops ?? 0) > 0);
    expect(carsThatStopped.length, 'two hours in, some cars must have stopped').toBeGreaterThan(0);
    for (const entry of positions.entries) {
      expect(
        entry.fuelStops,
        `car ${String(entry.carNumber)} must have refuelled once per pit stop`,
      ).toBe(entry.pitStops);
    }
  });

  it("names the lap of every car's best lap, the lap whose time is its bestLapMs", () => {
    // Arrange: the race three hours in, with every running car many laps into it.
    const raceState = simulateEnduroAt(defaultRace, 3 * 60 * oneMinuteMs);

    // Act: build the positions and, for each car, the time of the lap its entry names.
    const positions = buildShapesFromRaceState(raceState, pollAtWallClockMs).positions;
    const lapChecks = positions.entries.map((entry) => {
      const car = raceState.cars.find((candidate) => candidate.carNumber === entry.carNumber);
      const lapMoments = car?.lapCompletedAtRunningMs ?? [];
      const lapIndex = (entry.bestLapNumber ?? 0) - 1;
      const timeOfNamedLapMs = (lapMoments[lapIndex] ?? 0) - (lapMoments[lapIndex - 1] ?? 0);
      return { entry, timeOfNamedLapMs };
    });

    // Assert: a car with a best lap names a lap it has run, and that lap took exactly its
    // best lap time; a car with no lap has neither (the fastest-lap notice reads both).
    for (const { entry, timeOfNamedLapMs } of lapChecks) {
      const carText = `car ${String(entry.carNumber)}`;
      if (entry.bestLapMs === undefined) {
        expect(entry.bestLapNumber, `${carText} has no lap, so no best lap number`).toBe(undefined);
        continue;
      }
      expect(entry.bestLapNumber, `${carText} must name a lap it has run`).toBeLessThanOrEqual(
        entry.laps,
      );
      expect(timeOfNamedLapMs, `${carText}'s named lap must be its best lap`).toBe(entry.bestLapMs);
    }
  });
});

describe('the session clock', () => {
  it('counts down the time left, running, mid-race', () => {
    // Arrange: one hour into the 2027 race (no red can have come out before an hour
    // into the session — reds come between a quarter and three quarters of the way).
    const oneHourMs = 60 * oneMinuteMs;
    const raceState = simulateEnduroAt(defaultRace, oneHourMs);

    // Act: build the session at 14:00.
    const session = buildShapesFromRaceState(raceState, pollAtWallClockMs).session;

    // Assert: three hours left, counting, read at 14:00.
    expect(session.clock, 'the clock must show three hours left, running').toEqual({
      clockMode: 'remaining',
      referenceTimeMs: 3 * oneHourMs,
      referenceWallClockMs: pollAtWallClockMs,
      running: true,
    });
    expect(session.scheduledDurationMs, 'the session is planned for four hours').toBe(fourHoursMs);
  });

  it('stops during a red flag and at zero after the checkered flag', () => {
    // Arrange: the first seed whose race has a red, in the middle of the red and after
    // the finish.
    const race = { ...defaultRace, seed: findTheFirstSeedWithARedFlag() };
    const schedule = buildFlagScheduleOfRace(race.seed, fourHoursMs);
    const redFlag = schedule.redFlag;
    if (redFlag === null) {
      throw new Error('the chosen seed must have a red flag');
    }
    const middleOfTheRedMs = redFlag.startsAtElapsedMs + redFlag.durationMs / 2;

    // Act: build the session in the red and long after the finish.
    const inTheRed = buildShapesFromRaceState(
      simulateEnduroAt(race, middleOfTheRedMs),
      pollAtWallClockMs,
    ).session;
    const afterTheFinish = buildShapesFromRaceState(
      simulateEnduroAt(race, fourHoursMs + 2 * 60 * oneMinuteMs),
      pollAtWallClockMs,
    ).session;

    // Assert: held at the time left when the red came out; held at zero at the end.
    expect(inTheRed.state, 'the flag must be red').toBe('red');
    expect(inTheRed.clock.running, 'the clock must stop during a red').toBe(false);
    expect(inTheRed.clock.referenceTimeMs, 'the clock holds the time left at the red').toBe(
      fourHoursMs - convertElapsedTimeToRunningTime(middleOfTheRedMs, schedule),
    );
    expect(afterTheFinish.clock.running, 'the clock must stop after the end').toBe(false);
    expect(afterTheFinish.clock.referenceTimeMs, 'no time is left after the end').toBe(0);
  });
});

describe('the overall standings', () => {
  it('add up every event, ranked from most points to fewest', () => {
    // Arrange: the 2027 race at the end.
    const raceState = simulateEnduroAt(defaultRace, fourHoursMs + 2 * 60 * oneMinuteMs);

    // Act: build the standings.
    const standings = buildShapesFromRaceState(raceState, pollAtWallClockMs).standings;

    // Assert: overall scope; each total is the sum of its events; points never go up
    // down the list; the enduro winner scores the full 400.
    expect(standings.scope, 'the standings are the overall ones').toBe('overall');
    standings.entries.forEach((entry, index) => {
      const eventPoints = Object.values(entry.pointsByEvent ?? {});
      const sumOfEvents = eventPoints.reduce((sum, points) => sum + points, 0);
      expect(
        entry.points,
        `the total of car ${String(entry.carNumber)} is its events' sum`,
      ).toBeCloseTo(sumOfEvents, 5);
      const entryAbove = standings.entries[index - 1];
      if (entryAbove !== undefined) {
        expect(entry.points, 'points never go up down the standings').toBeLessThanOrEqual(
          entryAbove.points,
        );
      }
    });
    const enduroPoints = standings.entries.map((entry) => entry.pointsByEvent?.enduro ?? 0);
    expect(Math.max(...enduroPoints), 'the enduro winner scores the full 400').toBe(400);
  });
});
