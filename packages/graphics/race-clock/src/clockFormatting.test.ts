/**
 * Clock text formatting (packages/graphics/race-clock)
 *
 * What this module is for:
 *   The race clock shows a time on air as H:MM:SS, dropping the hours while they are
 *   zero (so twelve minutes reads "12:00", not "0:12:00"). This file turns a number of
 *   milliseconds into that text, for a clock counting up (elapsed) or down (remaining).
 *
 * What these tests prove:
 *   - The edge cases the brief names: 0 s, 59 s, 59:59, exactly one hour, and a
 *     negative time, which is clamped to "0:00" instead of showing a minus sign.
 *   - An elapsed clock drops partial seconds, so it never shows a second that has not
 *     fully passed.
 *   - A countdown rounds partial seconds up, so it shows 0:01 until the race is really
 *     over and reaches 0:00 only at zero.
 *
 * What these tests deliberately do not cover:
 *   - That the text keeps the same width on air (tabular numerals); that is a font
 *     question, checked in a real browser by e2e/raceClockOnAir.e2e.ts.
 */
import { describe, expect, it } from 'vitest';

import { formatClockTimeAsHoursMinutesSeconds } from './clockFormatting.js';
import type { ClockMode } from './raceClockModel.js';

const clockTextScenarios: {
  name: string;
  clockTimeMs: number;
  clockMode: ClockMode;
  expected: string;
}[] = [
  // The very start of a race: nothing has elapsed yet.
  { name: 'shows 0:00 at zero', clockTimeMs: 0, clockMode: 'elapsed', expected: '0:00' },
  // The last second before the first minute: seconds are padded, minutes are not.
  {
    name: 'shows 0:59 at fifty-nine seconds',
    clockTimeMs: 59_000,
    clockMode: 'elapsed',
    expected: '0:59',
  },
  // A typical moment early in a session: single-digit minutes stay unpadded.
  {
    name: 'shows 7:05 at seven minutes and five seconds',
    clockTimeMs: 425_000,
    clockMode: 'elapsed',
    expected: '7:05',
  },
  // The last second before the hour: still no hour digit.
  {
    name: 'shows 59:59 just before the hour',
    clockTimeMs: 3_599_000,
    clockMode: 'elapsed',
    expected: '59:59',
  },
  // Exactly one hour: the hour appears and minutes become two digits.
  {
    name: 'shows 1:00:00 at exactly one hour',
    clockTimeMs: 3_600_000,
    clockMode: 'elapsed',
    expected: '1:00:00',
  },
  // The four-hour Enduro de Resistência, well into the race.
  {
    name: 'shows 3:42:07 deep into an enduro',
    clockTimeMs: 13_327_000,
    clockMode: 'elapsed',
    expected: '3:42:07',
  },
  // 59.999 s elapsed must not round up to a minute that has not happened yet.
  {
    name: 'drops partial seconds of an elapsed clock instead of rounding up',
    clockTimeMs: 59_999,
    clockMode: 'elapsed',
    expected: '0:59',
  },
  // The countdown's last second: the race is not over, so 0:00 must not show yet.
  {
    name: 'shows 0:01 with 999 ms left on a countdown',
    clockTimeMs: 999,
    clockMode: 'remaining',
    expected: '0:01',
  },
  // The countdown at exactly zero: now, and only now, the race time is over.
  {
    name: 'shows 0:00 when a countdown reaches zero',
    clockTimeMs: 0,
    clockMode: 'remaining',
    expected: '0:00',
  },
  // A sliver past 59 s left still counts as the whole sixtieth second.
  {
    name: 'shows 1:00 with 59 001 ms left on a countdown',
    clockTimeMs: 59_001,
    clockMode: 'remaining',
    expected: '1:00',
  },
  // A countdown that ran past zero must never show "-0:03" on air.
  {
    name: 'clamps a negative countdown to 0:00',
    clockTimeMs: -3_000,
    clockMode: 'remaining',
    expected: '0:00',
  },
];

describe('formatClockTimeAsHoursMinutesSeconds', () => {
  it.each(clockTextScenarios)('$name', ({ clockTimeMs, clockMode, expected }) => {
    // Arrange: the time and the clock mode come from the scenario row above.

    // Act: turn the milliseconds into the text shown on air.
    const clockText = formatClockTimeAsHoursMinutesSeconds(clockTimeMs, clockMode);

    // Assert: the text is exactly what the row expects.
    expect(
      clockText,
      `${clockTimeMs} ms on a ${clockMode} clock must be shown on air as "${expected}"`,
    ).toBe(expected);
  });
});
