/**
 * The simulator's seeded random draws (apps/server)
 *
 * What this module is for:
 *   Every random number of the simulated enduro comes from here: a mulberry32 generator
 *   seeded by mixing the race seed with who the draw is for (a car and a lap, or a race
 *   event) and what it is for (a lap time, a pit stop...). That is what makes lap 34 of
 *   car 12 the same lap at every poll, after a restart and in every test.
 *
 * What these tests prove:
 *   - The same seed, car, lap and purpose always give the same draw.
 *   - Changing any one of them gives a different draw.
 *   - Draws lie between 0 (included) and 1 (excluded), and spread over that range.
 *   - Race-wide draws are stable too, and differ from a car's draws.
 *
 * What these tests deliberately do not cover:
 *   - The statistical quality of mulberry32 (a published algorithm, chosen for being
 *     small and readable, not for cryptography).
 */
import { describe, expect, it } from 'vitest';

import { drawForCarAndLap, drawForRace, scaleDrawBetween } from './seededRandom.js';

const raceSeed = 2027;

describe('a draw for one car and one lap', () => {
  it('is the same every time for lap 34 of car 12', () => {
    // Arrange: the lap time variation of lap 34 of car 12 in the 2027 race.
    const carIndex = 11;

    // Act: draw it twice, as two polls a minute apart would.
    const firstDraw = drawForCarAndLap(raceSeed, carIndex, 34, 'lapVariation');
    const secondDraw = drawForCarAndLap(raceSeed, carIndex, 34, 'lapVariation');

    // Assert: both polls see the very same lap.
    expect(secondDraw, 'the same seed, car, lap and purpose must give the same draw').toBe(
      firstDraw,
    );
  });

  const changedInputScenarios = [
    // Another race must not repeat this race's laps.
    { name: 'another seed', seed: 2028, carIndex: 11, lapNumber: 34, purpose: 'lapVariation' },
    // The car behind must not drive the same lap as car 12.
    { name: 'another car', seed: raceSeed, carIndex: 12, lapNumber: 34, purpose: 'lapVariation' },
    // Lap 35 must not copy lap 34.
    { name: 'another lap', seed: raceSeed, carIndex: 11, lapNumber: 35, purpose: 'lapVariation' },
    // The pit decision must not be tied to the lap time of the same lap.
    {
      name: 'another purpose',
      seed: raceSeed,
      carIndex: 11,
      lapNumber: 34,
      purpose: 'pitStopDuration',
    },
  ] as const;

  it.each(changedInputScenarios)('changes with $name', ({ seed, carIndex, lapNumber, purpose }) => {
    // Arrange: the draw of lap 34 of car 12 in the 2027 race, to compare against.
    const lap34OfCar12 = drawForCarAndLap(raceSeed, 11, 34, 'lapVariation');

    // Act: draw again with one input changed.
    const changedDraw = drawForCarAndLap(seed, carIndex, lapNumber, purpose);

    // Assert: the draw is a different number.
    expect(changedDraw, 'changing one input must give an independent draw').not.toBe(lap34OfCar12);
  });

  it('lies between 0 and 1 and spreads over the whole range', () => {
    // Arrange: nothing beyond the 2027 seed.

    // Act: draw the variation of the first 100 laps of the first 60 cars.
    const draws: number[] = [];
    for (let carIndex = 0; carIndex < 60; carIndex += 1) {
      for (let lapNumber = 1; lapNumber <= 100; lapNumber += 1) {
        draws.push(drawForCarAndLap(raceSeed, carIndex, lapNumber, 'lapVariation'));
      }
    }

    // Assert: every draw is in [0, 1), and each tenth of the range gets a fair share.
    const drawsOutOfRange = draws.filter((draw) => draw < 0 || draw >= 1);
    expect(drawsOutOfRange, 'every draw must lie in [0, 1)').toEqual([]);
    for (let tenth = 0; tenth < 10; tenth += 1) {
      const drawsInThisTenth = draws.filter(
        (draw) => draw >= tenth / 10 && draw < (tenth + 1) / 10,
      );
      expect(
        drawsInThisTenth.length,
        `each tenth of the range must get roughly a tenth of 6 000 draws (tenth ${tenth})`,
      ).toBeGreaterThan(450);
    }
  });
});

describe('a race-wide draw', () => {
  it('is stable for the second yellow and differs from any car draw', () => {
    // Arrange: nothing beyond the 2027 seed.

    // Act: draw when the second yellow starts, twice, and car 3's base lap time
    // (car 3 is car index 2).
    const secondYellowStart = drawForRace(raceSeed, 2, 'yellowStart');
    const secondYellowStartAgain = drawForRace(raceSeed, 2, 'yellowStart');
    const baseLapOfCar3 = drawForCarAndLap(raceSeed, 2, 0, 'baseLapTime');

    // Assert: the race draw repeats, and is not the car's draw.
    expect(secondYellowStartAgain, 'a race-wide draw must repeat').toBe(secondYellowStart);
    expect(secondYellowStart, 'a race-wide draw must not equal a car draw').not.toBe(baseLapOfCar3);
  });
});

describe('scaleDrawBetween', () => {
  it('maps 0 to the lowest value and 0.5 to the middle', () => {
    // Arrange: the pit stop range, 60 to 240 seconds.
    const shortestPitStopMs = 60_000;
    const longestPitStopMs = 240_000;

    // Act: scale the two draws.
    const atZero = scaleDrawBetween(0, shortestPitStopMs, longestPitStopMs);
    const atHalf = scaleDrawBetween(0.5, shortestPitStopMs, longestPitStopMs);

    // Assert: 0 is the shortest stop and 0.5 the middle one.
    expect(atZero, 'a draw of 0 must give the lowest value').toBe(60_000);
    expect(atHalf, 'a draw of 0.5 must give the middle value').toBe(150_000);
  });
});
