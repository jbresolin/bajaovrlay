/**
 * Minutes and seconds typed as text (apps/control)
 *
 * What this module is for:
 *   The operator types the race clock's reference time as mm:ss ("12:34"), and the
 *   graphic wants milliseconds. minutesAndSeconds converts one into the other and says
 *   "this is not a time" for anything typed in another shape. It also writes
 *   milliseconds back as mm:ss, so the form can show the time the clock on air shows.
 *
 * What these tests prove:
 *   - mm:ss text converts to milliseconds, including minutes past 59 for the four-hour
 *     endurance race and text with stray spaces around it.
 *   - Text in any other shape (an hours part, 60 seconds, one-digit seconds, no colon,
 *     words, a negative time, nothing) gives no result.
 *   - Milliseconds are written back as mm:ss with two-digit seconds, minutes past 59
 *     staying minutes, and a part of a second dropped.
 *
 * What these tests deliberately do not cover:
 *   - The pt-BR message the form shows for a refused time; raceClockTakeForm.test.ts does.
 *   - Rounding a countdown's part of a second up, as the graphic does: the caller does
 *     that before formatting (raceClockDataOnAir.test.ts).
 *   - Times past 999:59, which the form's own rule then refuses when it is sent.
 */
import { describe, expect, it } from 'vitest';

import {
  convertMinutesAndSecondsToMilliseconds,
  formatMillisecondsAsMinutesAndSeconds,
} from './minutesAndSeconds';

describe('convertMinutesAndSecondsToMilliseconds', () => {
  const timesTheFormAccepts = [
    // The start of a session: the clock at zero.
    { name: 'reads 0:00 as zero', text: '0:00', milliseconds: 0 },
    // Minutes and seconds both count: 65 seconds.
    { name: 'reads 1:05 as 65 seconds', text: '1:05', milliseconds: 65_000 },
    // A leading zero on the minutes is how many people type it.
    { name: 'reads 05:07 the same as 5:07', text: '05:07', milliseconds: 307_000 },
    // The last second before one hour.
    { name: 'reads 59:59 as one second short of an hour', text: '59:59', milliseconds: 3_599_000 },
    // The endurance race lasts four hours, so minutes may go past 59.
    { name: 'reads 240:00 as four hours', text: '240:00', milliseconds: 14_400_000 },
    // Spaces around the text come from copy and paste and mean nothing.
    { name: 'ignores spaces around the text', text: ' 12:34 ', milliseconds: 754_000 },
  ];

  it.each(timesTheFormAccepts)('$name', ({ text, milliseconds }) => {
    // Arrange: the text as typed in the "tempo de referência" field (see the scenario).

    // Act: convert it.
    const convertedTime = convertMinutesAndSecondsToMilliseconds(text);

    // Assert: the result is the same time in milliseconds.
    expect(convertedTime, `"${text}" must be ${milliseconds} milliseconds`).toBe(milliseconds);
  });

  const textsTheFormRefuses = [
    // Hours are not part of mm:ss; one hour is typed as 60:00.
    { name: 'refuses 1:00:00, which has an hours part', text: '1:00:00' },
    // There is no 60th second; it is the next minute.
    { name: 'refuses 1:60, because seconds stop at 59', text: '1:60' },
    // Seconds always take two digits, so 1:5 is ambiguous (five or fifty?).
    { name: 'refuses 1:5, because seconds need two digits', text: '1:5' },
    // A bare number does not say whether it means minutes or seconds.
    { name: 'refuses 90, which has no colon', text: '90' },
    // Words are not a time.
    { name: 'refuses "doze e trinta"', text: 'doze e trinta' },
    // A clock never shows negative time.
    { name: 'refuses -1:00', text: '-1:00' },
    // Nothing typed at all.
    { name: 'refuses an empty text', text: '' },
  ];

  it.each(textsTheFormRefuses)('$name', ({ text }) => {
    // Arrange: the text as typed in the "tempo de referência" field (see the scenario).

    // Act: try to convert it.
    const convertedTime = convertMinutesAndSecondsToMilliseconds(text);

    // Assert: there is no result, which is how the form knows to show a message.
    expect(convertedTime, `"${text}" is not a valid mm:ss time`).toBeUndefined();
  });
});

describe('formatMillisecondsAsMinutesAndSeconds', () => {
  const timesTheFormShows = [
    // A clock that has not started.
    { name: 'writes zero as 0:00', milliseconds: 0, text: '0:00' },
    // Seconds under ten keep their leading zero, or 1:05 would read as 1:5.
    { name: 'writes 65 seconds as 1:05', milliseconds: 65_000, text: '1:05' },
    // The example used all over these tests: 12 minutes 34 seconds.
    { name: 'writes 754 000 ms as 12:34', milliseconds: 754_000, text: '12:34' },
    // There is no hours part: the four-hour endurance race is 240 minutes.
    { name: 'writes four hours as 240:00', milliseconds: 14_400_000, text: '240:00' },
    // A running clock is rarely on a whole second; the part of a second is dropped.
    { name: 'drops the part of a second', milliseconds: 754_900, text: '12:34' },
  ];

  it.each(timesTheFormShows)('$name', ({ milliseconds, text }) => {
    // Arrange: a time in milliseconds, as the graphic's data holds it (see the scenario).

    // Act: write it the way the operator types it.
    const formattedTime = formatMillisecondsAsMinutesAndSeconds(milliseconds);

    // Assert: the text is the same time as mm:ss.
    expect(formattedTime, `${milliseconds} milliseconds must read "${text}"`).toBe(text);
  });

  it('writes a time the form reads back as the same milliseconds', () => {
    // Arrange: 27 minutes 34 seconds, the time the clock in these tests shows on air.
    const timeShownOnAirInMilliseconds = 1_654_000;

    // Act: write it as mm:ss, then read that text again as the form does.
    const formattedTime = formatMillisecondsAsMinutesAndSeconds(timeShownOnAirInMilliseconds);
    const timeReadBack = convertMinutesAndSecondsToMilliseconds(formattedTime);

    // Assert: nothing was lost on the way.
    expect(formattedTime, 'the time must be written as 27:34').toBe('27:34');
    expect(timeReadBack, 'the form must read the written time back unchanged').toBe(1_654_000);
  });
});
