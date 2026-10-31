/**
 * Working out gaps from laps and line passes (packages/shared)
 *
 * What this module is for:
 *   The Baja app's race answer has no gaps: its doc says to work them out from each car's
 *   `laps` and `last_pass_ms`. A positions mapping may switch on `workOutGapsFromLaps` and
 *   map each car's last pass to `lastPassAtMs`; after the mapping, the gaps are worked out
 *   here and `lastPassAtMs` is taken off, since the shape has no such field
 *   (BAJAOVRLAY-53). The gaps are as of the last line crossing: between two crossings the
 *   gap stays put, however the cars move on track.
 *
 * What these tests prove, one table per rule, with the lap counts of a four-hour enduro:
 *   - The leader is position 1 and carries no gap and no interval.
 *   - A car on the leader's lap gets gapToLeaderMs = its last pass − the leader's.
 *   - A lapped car gets gapToLeaderLaps = the laps it is behind.
 *   - intervalMs goes to the car directly ahead when both are on the same lap, and not
 *     across a lap or to a car ahead that is out of the race.
 *   - Only cars still in the race (running, inPit, stopped) get gaps.
 *   - Gaps a source sends itself are never overwritten.
 *   - Every car loses lastPassAtMs, and a car without one gets no time gap.
 *
 * What these tests deliberately do not cover:
 *   - Mapping lastPassAtMs from the answer, and the result through validateDataShape:
 *     bajaAppFixtures.test.ts does both with the doc's race.
 */
import { describe, expect, it } from 'vitest';

import { addGapsWorkedOutFromLaps } from './gapsFromLaps.js';

/** The moment the leader last crossed the line: 14:31:08.120 in Brasília, lap 34. */
const leaderLastPassAtMs = Date.UTC(2026, 2, 28, 17, 31, 8, 120);

/**
 * One mapped car as the mapping hands it over: its place, number, laps and status, and
 * its last pass `msAfterTheLeader` after the leader's (undefined for none).
 */
function buildMappedCar(
  position: number,
  carNumber: number,
  laps: number,
  msAfterTheLeader: number | undefined,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  const car: Record<string, unknown> = { position, carNumber, laps, status: 'running', ...extras };
  if (msAfterTheLeader !== undefined) {
    car.lastPassAtMs = leaderLastPassAtMs + msAfterTheLeader;
  }
  return car;
}

/** The fields of each car the gaps step writes or keeps, by car number. */
function readGapsByCar(cars: Array<Record<string, unknown>>) {
  return cars.map((car) => ({
    carNumber: car.carNumber,
    gapToLeaderMs: car.gapToLeaderMs,
    gapToLeaderLaps: car.gapToLeaderLaps,
    intervalMs: car.intervalMs,
  }));
}

type GapScenario = {
  name: string;
  cars: Array<Record<string, unknown>>;
  expected: Array<Record<string, unknown>>;
};

/** What a car with no gap of any kind reads as. */
function noGaps(carNumber: number) {
  return { carNumber, gapToLeaderMs: undefined, gapToLeaderLaps: undefined, intervalMs: undefined };
}

/** Runs one table of gap scenarios. */
function runGapScenarios(scenarios: GapScenario[]) {
  it.each(scenarios)('$name', ({ cars, expected }) => {
    // Arrange: the mapped cars of this row, in position order.

    // Act: work out their gaps.
    const carsWithGaps = addGapsWorkedOutFromLaps(cars);

    // Assert: each car's gaps as this row says.
    expect(readGapsByCar(carsWithGaps), 'the gaps must be worked out as this row says').toEqual(
      expected,
    );
  });
}

describe('addGapsWorkedOutFromLaps', () => {
  describe('the leader', () => {
    runGapScenarios([
      // Position 1 has nobody to be behind.
      {
        name: 'gives car 2, leading on 34 laps, no gap and no interval',
        cars: [buildMappedCar(1, 2, 34, 0)],
        expected: [noGaps(2)],
      },
    ]);
  });

  describe('a car on the leader’s lap', () => {
    runGapScenarios([
      // Car 13 crossed 12.399 s after the leader, both on lap 34.
      {
        name: 'gives car 13, on lap 34 like the leader, its 12 399 ms behind',
        cars: [buildMappedCar(1, 2, 34, 0), buildMappedCar(2, 13, 34, 12_399)],
        expected: [noGaps(2), { ...noGaps(13), gapToLeaderMs: 12_399, intervalMs: 12_399 }],
      },
      // A third car on the same lap: its gap is to the leader, its interval to car 13.
      {
        name: 'gives car 4, also on lap 34, 61 020 ms to the leader and 48 621 ms to car 13',
        cars: [
          buildMappedCar(1, 2, 34, 0),
          buildMappedCar(2, 13, 34, 12_399),
          buildMappedCar(3, 4, 34, 61_020),
        ],
        expected: [
          noGaps(2),
          { ...noGaps(13), gapToLeaderMs: 12_399, intervalMs: 12_399 },
          { ...noGaps(4), gapToLeaderMs: 61_020, intervalMs: 48_621 },
        ],
      },
    ]);
  });

  describe('a lapped car', () => {
    runGapScenarios([
      // One lap down: a gap in laps, never in ms.
      {
        name: 'gives car 7, on 33 laps, one lap behind',
        cars: [buildMappedCar(1, 2, 34, 0), buildMappedCar(2, 7, 33, -90_000)],
        expected: [noGaps(2), { ...noGaps(7), gapToLeaderLaps: 1 }],
      },
      // Several laps down, after a long pit stop.
      {
        name: 'gives car 30, on 29 laps, five laps behind',
        cars: [buildMappedCar(1, 2, 34, 0), buildMappedCar(2, 30, 29, 140_000)],
        expected: [noGaps(2), { ...noGaps(30), gapToLeaderLaps: 5 }],
      },
    ]);
  });

  describe('the interval to the car directly ahead', () => {
    runGapScenarios([
      // Two lapped cars on the same lap: an interval between them, gaps in laps.
      {
        name: 'gives car 30 its 21 500 ms to car 7, both on 33 laps',
        cars: [
          buildMappedCar(1, 2, 34, 0),
          buildMappedCar(2, 7, 33, -90_000),
          buildMappedCar(3, 30, 33, -68_500),
        ],
        expected: [
          noGaps(2),
          { ...noGaps(7), gapToLeaderLaps: 1 },
          { ...noGaps(30), gapToLeaderLaps: 1, intervalMs: 21_500 },
        ],
      },
      // Across a lap there is no interval in time.
      {
        name: 'gives car 7 no interval to car 13, which is a lap ahead of it',
        cars: [
          buildMappedCar(1, 2, 34, 0),
          buildMappedCar(2, 13, 34, 12_399),
          buildMappedCar(3, 7, 33, -90_000),
        ],
        expected: [
          noGaps(2),
          { ...noGaps(13), gapToLeaderMs: 12_399, intervalMs: 12_399 },
          { ...noGaps(7), gapToLeaderLaps: 1 },
        ],
      },
      // The car directly ahead retired: no interval to a car that is not racing.
      {
        name: 'gives car 4 no interval to car 13 ahead of it, which retired',
        cars: [
          buildMappedCar(1, 2, 34, 0),
          buildMappedCar(2, 13, 34, 12_399, { status: 'retired' }),
          buildMappedCar(3, 4, 34, 61_020),
        ],
        expected: [noGaps(2), noGaps(13), { ...noGaps(4), gapToLeaderMs: 61_020 }],
      },
    ]);
  });

  describe('only cars still in the race', () => {
    runGapScenarios([
      // In the pit and stopped for a repair are still racing.
      {
        name: 'gives cars in the pit (13) and stopped (4) their gaps',
        cars: [
          buildMappedCar(1, 2, 34, 0),
          buildMappedCar(2, 13, 34, 12_399, { status: 'inPit' }),
          buildMappedCar(3, 4, 33, 30_000, { status: 'stopped' }),
        ],
        expected: [
          noGaps(2),
          { ...noGaps(13), gapToLeaderMs: 12_399, intervalMs: 12_399 },
          { ...noGaps(4), gapToLeaderLaps: 1 },
        ],
      },
      // Retired, disqualified and not started get nothing.
      {
        name: 'gives retired (7), disqualified (30) and not started (44) cars nothing',
        cars: [
          buildMappedCar(1, 2, 34, 0),
          buildMappedCar(2, 7, 30, 0, { status: 'retired' }),
          buildMappedCar(3, 30, 12, 0, { status: 'disqualified' }),
          buildMappedCar(4, 44, 0, undefined, { status: 'notStarted' }),
        ],
        expected: [noGaps(2), noGaps(7), noGaps(30), noGaps(44)],
      },
    ]);
  });

  describe('gaps the source sends itself', () => {
    runGapScenarios([
      // The source's own gap and interval stay as sent.
      {
        name: 'keeps the 12 300 ms gap and interval car 13 came with',
        cars: [
          buildMappedCar(1, 2, 34, 0),
          buildMappedCar(2, 13, 34, 12_399, { gapToLeaderMs: 12_300, intervalMs: 12_300 }),
        ],
        expected: [noGaps(2), { ...noGaps(13), gapToLeaderMs: 12_300, intervalMs: 12_300 }],
      },
      // A gap in laps sent by the source is a gap too: no time gap is added beside it.
      {
        name: 'keeps the lap gap car 7 came with and adds no interval it did not send',
        cars: [
          buildMappedCar(1, 2, 34, 0),
          buildMappedCar(2, 13, 33, -100_000),
          buildMappedCar(3, 7, 33, -90_000, { gapToLeaderLaps: 1 }),
        ],
        expected: [
          noGaps(2),
          { ...noGaps(13), gapToLeaderLaps: 1 },
          { ...noGaps(7), gapToLeaderLaps: 1, intervalMs: 10_000 },
        ],
      },
    ]);
  });

  it('takes lastPassAtMs off every car, and gives a car without one no time gap', () => {
    // Arrange: the leader, and car 13 on its lap with no last pass known.
    const cars = [buildMappedCar(1, 2, 34, 0), buildMappedCar(2, 13, 34, undefined)];

    // Act: work out the gaps.
    const carsWithGaps = addGapsWorkedOutFromLaps(cars);

    // Assert: no car keeps lastPassAtMs, and car 13 has no gap in time.
    expect(
      carsWithGaps.some((car) => 'lastPassAtMs' in car),
      'lastPassAtMs must never reach the shape',
    ).toBe(false);
    expect(readGapsByCar(carsWithGaps), 'no last pass means no time gap').toEqual([
      noGaps(2),
      noGaps(13),
    ]);
  });
});
