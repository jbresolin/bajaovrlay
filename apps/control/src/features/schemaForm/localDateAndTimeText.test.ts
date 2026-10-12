/**
 * A moment as ISO 8601 text and as the text of a date-and-time input (apps/control)
 *
 * What this module is for:
 *   A graphic receives a moment as ISO 8601 text ("2026-10-10T12:45:00.000Z"). The
 *   browser's date-and-time input holds the same moment as "2026-10-10T09:45" on the
 *   clock of the operator's computer, with no time zone. localDateAndTimeText converts
 *   one into the other.
 *
 * What these tests prove:
 *   - The input's text converts to ISO 8601 text in UTC, with and without seconds.
 *   - Text that is not a date and time, or names a day or hour that does not exist,
 *     gives no result.
 *   - ISO 8601 text converts to the input's text; seconds appear only when not zero and
 *     a part of a second is dropped.
 *   - Text that is not ISO 8601 gives no result.
 *
 * What these tests deliberately do not cover:
 *   - A particular time zone: the tests build their expectations with this computer's
 *     own clock, so they pass wherever they run. That a control page set to another
 *     zone shows other digits for the same moment is written next to the code.
 *   - The pt-BR message for a refused date; checkSchemaFormValues.test.ts does.
 */
import { describe, expect, it } from 'vitest';

import {
  convertIsoTextToLocalDateAndTimeText,
  convertLocalDateAndTimeTextToIsoText,
} from './localDateAndTimeText';

describe('convertLocalDateAndTimeTextToIsoText', () => {
  it('converts the text of the input into the same moment as ISO 8601 text', () => {
    // Arrange: 9:45 on 10 October 2026 on this computer's clock, as the input writes it.
    const textInTheInput = '2026-10-10T09:45';
    const sameMomentBuiltByHand = new Date(2026, 9, 10, 9, 45, 0).toISOString();

    // Act: convert it.
    const isoText = convertLocalDateAndTimeTextToIsoText(textInTheInput);

    // Assert: it is that moment, written in UTC.
    expect(isoText, 'the moment must not move').toBe(sameMomentBuiltByHand);
    expect(isoText, 'the text must be ISO 8601 in UTC').toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('keeps the seconds when the input writes them', () => {
    // Arrange: the same morning, 30 seconds later.
    const textInTheInput = '2026-10-10T09:45:30';
    const sameMomentBuiltByHand = new Date(2026, 9, 10, 9, 45, 30).toISOString();

    // Act: convert it.
    const isoText = convertLocalDateAndTimeTextToIsoText(textInTheInput);

    // Assert: the 30 seconds are still there.
    expect(isoText, 'the seconds must be kept').toBe(sameMomentBuiltByHand);
  });

  const textsThatAreNotADateAndTime = [
    // The Brazilian way of writing a date, which the input never hands over.
    { name: 'refuses 10/10/2026 09:45', text: '10/10/2026 09:45' },
    // A date with no time.
    { name: 'refuses a date without a time', text: '2026-10-10' },
    // April has 30 days; JavaScript would quietly make this the 1st of May.
    { name: 'refuses the 31st of April', text: '2026-04-31T09:45' },
    // There is no 25th hour.
    { name: 'refuses 25 o’clock', text: '2026-10-10T25:00' },
    // Words.
    { name: 'refuses "sábado de manhã"', text: 'sábado de manhã' },
    // Nothing typed.
    { name: 'refuses an empty text', text: '' },
  ];

  it.each(textsThatAreNotADateAndTime)('$name', ({ text }) => {
    // Arrange: the text of this scenario (see the table).

    // Act: try to convert it.
    const isoText = convertLocalDateAndTimeTextToIsoText(text);

    // Assert: there is no result, which is how the form knows to show a message.
    expect(isoText, `"${text}" is not a date and time`).toBeUndefined();
  });
});

describe('convertIsoTextToLocalDateAndTimeText', () => {
  it('writes a moment on a whole minute without seconds', () => {
    // Arrange: 9:45 on this computer's clock, as ISO 8601 text.
    const isoText = new Date(2026, 9, 10, 9, 45, 0).toISOString();

    // Act: convert it for the input.
    const textForTheInput = convertIsoTextToLocalDateAndTimeText(isoText);

    // Assert: the input shows that morning, to the minute.
    expect(textForTheInput, 'the input must show 10 October 2026, 9:45').toBe('2026-10-10T09:45');
  });

  it('writes the seconds when they are not zero and drops the part of a second', () => {
    // Arrange: 9:45:30 and 250 milliseconds.
    const isoText = new Date(2026, 9, 10, 9, 45, 30, 250).toISOString();

    // Act: convert it for the input.
    const textForTheInput = convertIsoTextToLocalDateAndTimeText(isoText);

    // Assert: the seconds stay, the quarter of a second goes.
    expect(textForTheInput, 'the input must show 9:45:30').toBe('2026-10-10T09:45:30');
  });

  it('reads a moment written with an offset as the same moment', () => {
    // Arrange: 9:45 in Brasília (UTC-3), and the same moment written in UTC.
    const isoTextWithOffset = '2026-10-10T09:45:00-03:00';
    const isoTextInUtc = '2026-10-10T12:45:00.000Z';

    // Act: convert both for the input.
    const textFromOffset = convertIsoTextToLocalDateAndTimeText(isoTextWithOffset);
    const textFromUtc = convertIsoTextToLocalDateAndTimeText(isoTextInUtc);

    // Assert: one moment, one text.
    expect(textFromOffset, 'the two writings must show the same digits').toBe(textFromUtc);
    expect(textFromOffset, 'there must be a text to show').toBeDefined();
  });

  const textsThatAreNotIsoDates = [
    // Date.parse would read this one, but no graphic should be sent it.
    { name: 'refuses "10 October 2026 09:45"', text: '10 October 2026 09:45' },
    // The right shape with a month that does not exist.
    { name: 'refuses month 13', text: '2026-13-10T09:45:00Z' },
    // Nothing.
    { name: 'refuses an empty text', text: '' },
  ];

  it.each(textsThatAreNotIsoDates)('$name', ({ text }) => {
    // Arrange: the text of this scenario (see the table).

    // Act: try to convert it.
    const textForTheInput = convertIsoTextToLocalDateAndTimeText(text);

    // Assert: there is nothing to show.
    expect(textForTheInput, `"${text}" is not an ISO 8601 date and time`).toBeUndefined();
  });
});
