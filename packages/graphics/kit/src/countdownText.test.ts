/**
 * The countdown's text, and the time of day of a start (packages/graphics/kit)
 *
 * What this module is for:
 *   The countdown card, the waiting screen and the intermission's next-session card count
 *   down to a session's start, `startsAtMs`, an absolute moment (BAJAOVRLAY-46). The count
 *   is written as the race clock writes a countdown (shared's formatter): `m:ss` below an
 *   hour, `h:mm:ss` from an hour up, a partial second rounded up so "0:00" shows only at
 *   the start, and never a negative time. Beside it, the start's time of day ("10:00") and
 *   the sessions board's times are written as the machine's clock reads them.
 *
 * What these tests prove (tables of named rows):
 *   - The count either side of an hour, at the start, a second before, and after it.
 *   - Whether the count has reached zero, at the very millisecond of the start.
 *   - The time of day in Brasília: 10:00, 07:30, 16:00, with two digits and no "h".
 *
 * What these tests deliberately do not cover:
 *   - The text of every clock time; shared's clockFormatting.test.ts.
 *   - Redrawing on air; countdownClock.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  hasCountdownReachedZeroAt,
  writeCountdownTextAt,
  writeTimeOfDayText,
} from './countdownText.js';

/** The enduro's start: Sunday 30 March 2025, 10:00 in Brasília (UTC−3). */
const enduroStartsAtMs = Date.parse('2025-03-30T10:00:00.000-03:00');

/** A moment `secondsBefore` seconds before the enduro's start (negative: after it). */
function secondsBeforeTheStart(secondsBefore: number): number {
  return enduroStartsAtMs - secondsBefore * 1000;
}

describe('writeCountdownTextAt', () => {
  const countScenarios = [
    // The design's sample: 23 min 45 s to go.
    { name: 'writes 23:45 with 23 min 45 s to go', secondsBefore: 1425, expected: '23:45' },
    // Just under an hour: still m:ss.
    { name: 'writes 59:59 a second under the hour', secondsBefore: 3599, expected: '59:59' },
    // At exactly an hour the hour appears.
    { name: 'writes 1:00:00 at an hour to go', secondsBefore: 3600, expected: '1:00:00' },
    // A long wait before the day starts.
    { name: 'writes 2:15:00 at two and a quarter hours', secondsBefore: 8100, expected: '2:15:00' },
    // The last second shows 0:01 until the start itself.
    { name: 'writes 0:01 with half a second to go', secondsBefore: 0.5, expected: '0:01' },
    // The start: 0:00.
    { name: 'writes 0:00 at the start', secondsBefore: 0, expected: '0:00' },
    // After the start the count never goes negative.
    { name: 'stays at 0:00 a minute after the start', secondsBefore: -60, expected: '0:00' },
  ];

  it.each(countScenarios)('$name', ({ secondsBefore, expected }) => {
    // Arrange: the moment of this row.
    const nowMs = secondsBeforeTheStart(secondsBefore);

    // Act: write the count.
    const text = writeCountdownTextAt(enduroStartsAtMs, nowMs);

    // Assert: the text on air.
    expect(text, 'the count as the design writes it').toBe(expected);
  });
});

describe('hasCountdownReachedZeroAt', () => {
  const zeroScenarios = [
    // A millisecond before, the count still runs.
    { name: 'has not reached zero a millisecond before', secondsBefore: 0.001, expected: false },
    // At the start itself, it has.
    { name: 'has reached zero at the start', secondsBefore: 0, expected: true },
    // And it stays there.
    { name: 'has reached zero after the start', secondsBefore: -5, expected: true },
  ];

  it.each(zeroScenarios)('$name', ({ secondsBefore, expected }) => {
    // Arrange: the moment of this row.
    const nowMs = secondsBeforeTheStart(secondsBefore);

    // Act: ask.
    const hasReachedZero = hasCountdownReachedZeroAt(enduroStartsAtMs, nowMs);

    // Assert: the answer.
    expect(hasReachedZero, 'whether the count is over').toBe(expected);
  });
});

describe('writeTimeOfDayText', () => {
  const timesOfDay = [
    // The enduro's start.
    { name: 'writes 10:00', moment: '2025-03-30T10:00:00.000-03:00', expected: '10:00' },
    // An early slot keeps its leading zero, as the sessions board shows it.
    {
      name: 'writes 07:30 with its zero',
      moment: '2025-03-30T07:30:00.000-03:00',
      expected: '07:30',
    },
    // The afternoon in 24-hour time.
    {
      name: 'writes 16:00 in 24-hour time',
      moment: '2025-03-30T16:00:00.000-03:00',
      expected: '16:00',
    },
  ];

  it.each(timesOfDay)('$name', ({ moment, expected }) => {
    // Arrange: the moment of this row.
    const momentMs = Date.parse(moment);

    // Act: write it as Brasília's clock reads it.
    const text = writeTimeOfDayText(momentMs, 'America/Sao_Paulo');

    // Assert: hours and minutes, two digits each.
    expect(text, 'the time of day on air').toBe(expected);
  });
});
