/**
 * Clock text formatting (packages/graphics/race-clock)
 *
 * What this module is for:
 *   The race clock shows a time on air as H:MM:SS, dropping the hours while they are
 *   zero (so twelve minutes reads "12:00", not "0:12:00"). This file turns a number of
 *   milliseconds into that text.
 *
 * What these tests prove:
 *   - The edge cases the brief names: 0 s, 59 s, 59:59, exactly one hour, and a
 *     negative time, which is clamped to "0:00" instead of showing a minus sign.
 *   - Partial seconds are dropped, never rounded up, so the clock never shows a second
 *     that has not fully passed.
 *
 * What these tests deliberately do not cover:
 *   - That the text keeps the same width on air (tabular numerals); that is a font
 *     question, checked in a real browser by e2e/raceClockOnAir.e2e.ts.
 */
import { describe, expect, it } from 'vitest';

import { formatClockTimeAsHoursMinutesSeconds } from './clockFormatting.js';

const clockTextScenarios = [
  // The very start of a race: nothing has elapsed yet.
  { name: 'shows 0:00 at zero', clockTimeMs: 0, expected: '0:00' },
  // The last second before the first minute: seconds are padded, minutes are not.
  { name: 'shows 0:59 at fifty-nine seconds', clockTimeMs: 59_000, expected: '0:59' },
  // A typical moment early in a session: single-digit minutes stay unpadded.
  { name: 'shows 7:05 at seven minutes and five seconds', clockTimeMs: 425_000, expected: '7:05' },
  // The last second before the hour: still no hour digit.
  { name: 'shows 59:59 just before the hour', clockTimeMs: 3_599_000, expected: '59:59' },
  // Exactly one hour: the hour appears and minutes become two digits.
  { name: 'shows 1:00:00 at exactly one hour', clockTimeMs: 3_600_000, expected: '1:00:00' },
  // The four-hour Enduro de Resistência, well into the race.
  { name: 'shows 3:42:07 deep into an enduro', clockTimeMs: 13_327_000, expected: '3:42:07' },
  // 59.999 s must not round up to a minute that has not happened yet.
  { name: 'drops partial seconds instead of rounding up', clockTimeMs: 59_999, expected: '0:59' },
  // A countdown that ran past zero must never show "-0:03" on air.
  { name: 'clamps a negative time to 0:00', clockTimeMs: -3_000, expected: '0:00' },
];

describe('formatClockTimeAsHoursMinutesSeconds', () => {
  it.each(clockTextScenarios)('$name', ({ clockTimeMs, expected }) => {
    // Arrange: the time comes from the scenario row above.

    // Act: turn the milliseconds into the text shown on air.
    const clockText = formatClockTimeAsHoursMinutesSeconds(clockTimeMs);

    // Assert: the text is exactly what the row expects.
    expect(clockText, `${clockTimeMs} ms must be shown on air as "${expected}"`).toBe(expected);
  });
});
