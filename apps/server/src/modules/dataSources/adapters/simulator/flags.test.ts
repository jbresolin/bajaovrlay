/**
 * The simulated enduro's flags (apps/server)
 *
 * What this module is for:
 *   flags.ts decides, from the seed alone, when the yellows come out and whether a red
 *   stops the race, and answers the flag at any simulated moment. A red stops the
 *   clock: the "running time" the cars and the session clock follow leaves reds out.
 *
 * What these tests prove:
 *   - A four-hour race always has yellows, inside the session and not overlapping.
 *   - Running time equals elapsed time before a red, holds still during it, and trails
 *     elapsed time by the red's length after it.
 *   - The flag reads green, yellow, red, checkered and finished at the right moments.
 *   - A red is rare: only some seeds have one.
 *
 * What these tests deliberately do not cover:
 *   - Lap times under yellow (simulateEnduro.test.ts sees slower laps through the race).
 */
import { describe, expect, it } from 'vitest';

import {
  buildFlagScheduleOfRace,
  checkeredFlagPeriodMs,
  convertElapsedTimeToRunningTime,
  readSessionFlagAt,
} from './flags.js';
import {
  findTheFirstSeedWithARedFlag,
  findTheMiddleOfTheFirstYellow,
} from './raceMoments.testSupport.js';

const fourHoursMs = 4 * 60 * 60 * 1000;
const oneMinuteMs = 60_000;

describe('the flag schedule of a four-hour enduro', () => {
  it('has yellows inside the session that never overlap', () => {
    // Arrange: nothing beyond the 2027 seed and four hours.

    // Act: build the schedule.
    const schedule = buildFlagScheduleOfRace(2027, fourHoursMs);

    // Assert: there are yellows, each inside the session and after the previous one.
    expect(
      schedule.yellowPeriods.length,
      'a four-hour enduro must have at least one yellow',
    ).toBeGreaterThan(0);
    schedule.yellowPeriods.forEach((yellow, index) => {
      const previousYellow = schedule.yellowPeriods[index - 1];
      expect(yellow.startRunningMs, 'a yellow must start after the green').toBeGreaterThan(0);
      expect(yellow.endRunningMs, 'a yellow must end before the checkered flag').toBeLessThan(
        fourHoursMs,
      );
      expect(yellow.endRunningMs, 'a yellow must last some time').toBeGreaterThan(
        yellow.startRunningMs,
      );
      if (previousYellow !== undefined) {
        expect(
          yellow.startRunningMs,
          'a yellow must start after the previous one ended',
        ).toBeGreaterThan(previousYellow.endRunningMs);
      }
    });
  });

  it('gives a red flag to some races and not to others', () => {
    // Arrange: the first 40 seeds.
    const seeds = Array.from({ length: 40 }, (_, index) => index + 1);

    // Act: count the races with a red.
    const racesWithARed = seeds.filter(
      (seed) => buildFlagScheduleOfRace(seed, fourHoursMs).redFlag !== null,
    );

    // Assert: a red is rare but does happen.
    expect(racesWithARed.length, 'some of 40 races must have a red').toBeGreaterThan(0);
    expect(racesWithARed.length, 'most of 40 races must have no red').toBeLessThan(20);
  });
});

describe('running time around a red flag', () => {
  it('follows elapsed time, holds during the red and trails by the red after it', () => {
    // Arrange: a race with a red flag.
    const schedule = buildFlagScheduleOfRace(findTheFirstSeedWithARedFlag(), fourHoursMs);
    const redFlag = schedule.redFlag;
    if (redFlag === null) {
      throw new Error('the chosen seed must have a red flag');
    }
    const redEndsAtElapsedMs = redFlag.startsAtElapsedMs + redFlag.durationMs;

    // Act: read running time a minute before, in the middle of, and a minute after the red.
    const beforeTheRed = convertElapsedTimeToRunningTime(
      redFlag.startsAtElapsedMs - oneMinuteMs,
      schedule,
    );
    const duringTheRed = convertElapsedTimeToRunningTime(
      redFlag.startsAtElapsedMs + redFlag.durationMs / 2,
      schedule,
    );
    const afterTheRed = convertElapsedTimeToRunningTime(redEndsAtElapsedMs + oneMinuteMs, schedule);

    // Assert: before, equal; during, stopped at the red's start; after, behind by the red.
    expect(beforeTheRed, 'before the red, running time is elapsed time').toBe(
      redFlag.startsAtElapsedMs - oneMinuteMs,
    );
    expect(duringTheRed, 'during the red, running time holds still').toBe(
      redFlag.startsAtElapsedMs,
    );
    expect(afterTheRed, 'after the red, running time trails by the red length').toBe(
      redFlag.startsAtElapsedMs + oneMinuteMs,
    );
  });
});

describe('the flag at a moment', () => {
  it('reads green, yellow, red, checkered and finished at the right moments', () => {
    // Arrange: a race with a red, its first yellow and the checkered moment on the
    // elapsed timeline (the red pushes everything after it back by its length).
    const schedule = buildFlagScheduleOfRace(findTheFirstSeedWithARedFlag(), fourHoursMs);
    const redFlag = schedule.redFlag;
    if (redFlag === null) {
      throw new Error('the chosen seed must have a red flag');
    }
    const firstYellowMiddleElapsedMs = findTheMiddleOfTheFirstYellow(schedule);
    const checkeredAtElapsedMs = fourHoursMs + redFlag.durationMs;

    // Act: read the flag at six moments.
    const flagsRead = {
      atTheStart: readSessionFlagAt(0, schedule, fourHoursMs),
      inTheFirstYellow: readSessionFlagAt(firstYellowMiddleElapsedMs, schedule, fourHoursMs),
      inTheRed: readSessionFlagAt(redFlag.startsAtElapsedMs + 1, schedule, fourHoursMs),
      atTheCheckered: readSessionFlagAt(checkeredAtElapsedMs, schedule, fourHoursMs),
      justBeforeTheEnd: readSessionFlagAt(
        checkeredAtElapsedMs + checkeredFlagPeriodMs - 1,
        schedule,
        fourHoursMs,
      ),
      afterTheEnd: readSessionFlagAt(
        checkeredAtElapsedMs + checkeredFlagPeriodMs,
        schedule,
        fourHoursMs,
      ),
    };

    // Assert: each moment shows its flag.
    expect(flagsRead, 'each moment must show the flag the schedule says').toEqual({
      atTheStart: 'green',
      inTheFirstYellow: 'yellow',
      inTheRed: 'red',
      atTheCheckered: 'checkered',
      justBeforeTheEnd: 'checkered',
      afterTheEnd: 'finished',
    });
  });
});
