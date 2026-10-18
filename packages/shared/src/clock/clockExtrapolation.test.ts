/**
 * Clock extrapolation (packages/shared)
 *
 * What this module is for:
 *   The server does not send the clock every frame. It sends one reading ("at wall-clock
 *   time W the clock read T") and whether the clock is running. The race clock graphic
 *   works out the current clock time from that reading on every animation frame, so the
 *   clock runs smoothly on air even if updates arrive only once a minute. The server
 *   does the same sum when an operator changes the clock on air, to find the time the
 *   screen shows at that moment. Both use this one function, so they cannot disagree.
 *
 * What these tests prove:
 *   - A running elapsed clock counts up from the reading; a running remaining clock
 *     counts down from it.
 *   - A held clock (running = false) shows the reading unchanged however much wall-clock
 *     time passes.
 *   - A reading taken long ago (the graphic was loaded mid-race) is extrapolated
 *     forward correctly, not restarted.
 *   - A countdown that ran out gives a negative number: no clamp happens here.
 *
 * What these tests deliberately do not cover:
 *   - Turning the result into text, which the clockFormatting.test.ts beside it
 *     covers (including what a countdown that went past zero looks like).
 *   - What the server writes after an update; apps/server's carryClockForward.test.ts.
 *   - Clock drift between the server's and the OBS machine's wall clocks; the graphic
 *     trusts the wall clock it is given.
 */
import { describe, expect, it } from 'vitest';

import { type ClockReading, computeClockTimeMsAtWallClock } from './clockExtrapolation.js';

/** 16 May 2026, 14:30:00 UTC (11:30 in Brasília): when the reading in these tests was taken. */
const readingWallClockMs = Date.parse('2026-05-16T14:30:00.000Z');

/** Builds an enduro reading: 1 h 05 min on the clock at 14:30:00, running, elapsed mode. */
function createRunningEnduroReading(changes: Partial<ClockReading> = {}): ClockReading {
  return {
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: readingWallClockMs,
    running: true,
    ...changes,
  };
}

describe('computeClockTimeMsAtWallClock', () => {
  it('counts up from the reading when an elapsed clock is running', () => {
    // Arrange: a running elapsed clock that read 1:05:00 at 14:30:00.
    const reading = createRunningEnduroReading();
    const twelveSecondsLater = readingWallClockMs + 12_000;

    // Act: ask what the clock shows twelve seconds after the reading.
    const clockTimeMs = computeClockTimeMsAtWallClock(reading, twelveSecondsLater);

    // Assert: twelve seconds were added.
    expect(clockTimeMs, 'a running elapsed clock must count up with the wall clock').toBe(
      3_912_000,
    );
  });

  it('counts down from the reading when a remaining clock is running', () => {
    // Arrange: a running countdown that had 10:00 left at 14:30:00.
    const reading = createRunningEnduroReading({
      clockMode: 'remaining',
      referenceTimeMs: 600_000,
    });
    const twelveSecondsLater = readingWallClockMs + 12_000;

    // Act: ask what the countdown shows twelve seconds after the reading.
    const clockTimeMs = computeClockTimeMsAtWallClock(reading, twelveSecondsLater);

    // Assert: twelve seconds were taken off.
    expect(clockTimeMs, 'a running remaining clock must count down with the wall clock').toBe(
      588_000,
    );
  });

  it('holds the reading when the clock is not running, however much time passes', () => {
    // Arrange: the clock was stopped under a red flag at 1:05:00.
    const reading = createRunningEnduroReading({ running: false });
    const fiveMinutesLater = readingWallClockMs + 300_000;

    // Act: ask what the clock shows five minutes later.
    const clockTimeMs = computeClockTimeMsAtWallClock(reading, fiveMinutesLater);

    // Assert: the clock still shows exactly the reading.
    expect(clockTimeMs, 'a held clock must keep showing the reading unchanged').toBe(3_900_000);
  });

  it('extrapolates a reading taken long ago instead of restarting from it', () => {
    // Arrange: the graphic is loaded 45 minutes after the last reading was taken.
    const reading = createRunningEnduroReading();
    const fortyFiveMinutesLater = readingWallClockMs + 2_700_000;

    // Act: ask what the clock shows now.
    const clockTimeMs = computeClockTimeMsAtWallClock(reading, fortyFiveMinutesLater);

    // Assert: 1:05:00 plus 45 minutes is 1:50:00.
    expect(clockTimeMs, 'an old reading must be carried forward by the time since it').toBe(
      6_600_000,
    );
  });

  it('lets a running countdown go below zero, leaving the clamp to whoever uses the result', () => {
    // Arrange: a countdown with 5 seconds left, read 8 seconds ago.
    const reading = createRunningEnduroReading({ clockMode: 'remaining', referenceTimeMs: 5_000 });
    const eightSecondsLater = readingWallClockMs + 8_000;

    // Act: ask what the countdown shows now.
    const clockTimeMs = computeClockTimeMsAtWallClock(reading, eightSecondsLater);

    // Assert: the raw value is negative; the graphic's formatter shows it as 0:00 and the
    // server clamps it before storing it.
    expect(clockTimeMs, 'extrapolation must stay plain arithmetic, without clamping').toBe(-3_000);
  });
});
