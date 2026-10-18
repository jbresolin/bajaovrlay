/**
 * The whole seconds a clock shows (packages/shared)
 *
 * What this module is for:
 *   A race clock holds its time in milliseconds but shows whole seconds. Which whole
 *   second it shows depends on its direction: a clock counting up never shows a second
 *   that has not fully passed, and a countdown never shows 0:00 while time is left. The
 *   race clock graphic uses this rule to write its text, and the server uses it when an
 *   operator turns a clock around on air, so that the number on screen stays the same
 *   at the press. Both use this one function, so they cannot disagree.
 *
 * What these tests prove:
 *   - An elapsed clock drops the part of a second that has not finished.
 *   - A remaining clock counts a started second as a whole one, and shows zero only
 *     when nothing is left.
 *   - A time that is already a whole number of seconds is the same in both directions.
 *
 * What these tests deliberately do not cover:
 *   - Turning the seconds into H:MM:SS text, and clamping a negative time to zero; the
 *     clockFormatting.test.ts beside it covers both.
 *   - What the server writes when a clock is turned around; apps/server's
 *     carryClockForward.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { countWholeSecondsClockShows } from './clockWholeSeconds.js';

const scenariosByDirectionOfTheClock: Array<{
  name: string;
  clockTimeMs: number;
  clockMode: 'elapsed' | 'remaining';
  expectedWholeSeconds: number;
}> = [
  // 45 minutes and half a second into the race: the 2701st second has not passed yet.
  {
    name: 'drops the unfinished half second of an elapsed clock',
    clockTimeMs: 2_700_500,
    clockMode: 'elapsed',
    expectedWholeSeconds: 2_700,
  },
  // The same half second on a countdown: 45:00.5 left still reads as 45:01.
  {
    name: 'counts the started half second of a remaining clock as a whole one',
    clockTimeMs: 2_700_500,
    clockMode: 'remaining',
    expectedWholeSeconds: 2_701,
  },
  // One millisecond short of a minute elapsed must not show the minute yet.
  {
    name: 'shows 59 seconds at 59 999 ms elapsed',
    clockTimeMs: 59_999,
    clockMode: 'elapsed',
    expectedWholeSeconds: 59,
  },
  // The last second of a countdown: the race is not over, so zero must not show.
  {
    name: 'shows one second with 1 ms left on a countdown',
    clockTimeMs: 1,
    clockMode: 'remaining',
    expectedWholeSeconds: 1,
  },
  // Only at exactly zero is the countdown over.
  {
    name: 'shows zero when nothing is left on a countdown',
    clockTimeMs: 0,
    clockMode: 'remaining',
    expectedWholeSeconds: 0,
  },
  // A whole number of seconds is not rounded at all, counting up...
  {
    name: 'leaves a whole number of seconds as it is on an elapsed clock',
    clockTimeMs: 1_654_000,
    clockMode: 'elapsed',
    expectedWholeSeconds: 1_654,
  },
  // ...or counting down. This is why a clock turned around on a whole second keeps its number.
  {
    name: 'leaves a whole number of seconds as it is on a remaining clock',
    clockTimeMs: 1_654_000,
    clockMode: 'remaining',
    expectedWholeSeconds: 1_654,
  },
];

describe('countWholeSecondsClockShows', () => {
  it.each(scenariosByDirectionOfTheClock)(
    '$name',
    ({ clockTimeMs, clockMode, expectedWholeSeconds }) => {
      // Arrange: the time and the direction of the clock come from the scenario row above.

      // Act: ask how many whole seconds the clock shows.
      const wholeSeconds = countWholeSecondsClockShows(clockTimeMs, clockMode);

      // Assert: exactly the number of seconds the row expects.
      expect(
        wholeSeconds,
        `${clockTimeMs} ms on a ${clockMode} clock must show ${expectedWholeSeconds} whole seconds`,
      ).toBe(expectedWholeSeconds);
    },
  );
});
