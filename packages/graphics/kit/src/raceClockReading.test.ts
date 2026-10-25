/**
 * The race clock's reading, as every graphic with a clock reads it (packages/graphics/kit)
 *
 * What this module is for:
 *   Three graphics show the session's clock: the race clock's card, and the clock block of
 *   the lower strip and of the message ticker. They must show the same time at the same
 *   moment, so the five fields of a reading (flag, mode, reference time, reference moment,
 *   running) are checked by one set of Zod schemas and turned into text by one function.
 *
 * What these tests prove:
 *   - The reading's field schemas take a real reading and refuse a negative time and an
 *     unknown flag, as each graphic's strict schema will once it spreads them in.
 *   - The time text is the shared H:MM:SS of `@bajaovrlay/shared/clock` for a running
 *     elapsed clock, a running countdown and a held clock.
 *
 * What these tests deliberately do not cover:
 *   - The sum and the rounding themselves: packages/shared/src/clock tests them.
 *   - Two graphics showing the same text on screen: the lower strip's
 *     sameTimeAsTheRaceClock test puts both on one page.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  clockModes,
  flagStates,
  type RaceClockReading,
  raceClockReadingFieldSchemas,
  writeRaceClockTimeTextAt,
} from './raceClockReading.js';

const readingSchema = z.strictObject(raceClockReadingFieldSchemas);

// 14:00:00 on the enduro's day, as the server's clock read it.
const twoInTheAfternoonMs = Date.UTC(2026, 2, 8, 17, 0, 0);

/** The enduro an hour in, green flag, counting up, as the session source sends it. */
function createEnduroOneHourInReading(): RaceClockReading {
  return {
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_600_000,
    referenceWallClockMs: twoInTheAfternoonMs,
    running: true,
  };
}

describe('the reading field schemas', () => {
  it('take a real reading as it comes from the session source', () => {
    // Arrange: the enduro an hour in.
    const reading = createEnduroOneHourInReading();

    // Act: check it with the five schemas in one strict object.
    const parsed = readingSchema.safeParse(reading);

    // Assert: it passes unchanged.
    expect(parsed.success, 'a real reading must pass the reading schemas').toBe(true);
    expect(parsed.data, 'the reading must come out unchanged').toEqual(reading);
  });

  it('refuse a negative reference time', () => {
    // Arrange: a reading whose time went below zero, as a buggy source might send.
    const reading = { ...createEnduroOneHourInReading(), referenceTimeMs: -1000 };

    // Act: check it.
    const parsed = readingSchema.safeParse(reading);

    // Assert: refused; a graphic shows "0:00" from a countdown's sum, never from its data.
    expect(parsed.success, 'a negative reference time must be refused').toBe(false);
  });

  it('refuse a flag state the clock does not know', () => {
    // Arrange: a reading with "blue", which is no flag of the session.
    const reading = { ...createEnduroOneHourInReading(), state: 'blue' };

    // Act: check it.
    const parsed = readingSchema.safeParse(reading);

    // Assert: refused.
    expect(parsed.success, 'an unknown flag state must be refused').toBe(false);
  });

  it('list the six flags in the order a session goes through them, and the two modes', () => {
    // Arrange: nothing; the lists are constants.

    // Act: read them.
    const listedFlags = [...flagStates];
    const listedModes = [...clockModes];

    // Assert: the order the forms and the preview buttons show.
    expect(listedFlags, 'the six flag states in session order').toEqual([
      'pre',
      'green',
      'yellow',
      'red',
      'checkered',
      'finished',
    ]);
    expect(listedModes, 'the two clock modes').toEqual(['elapsed', 'remaining']);
  });
});

describe('writeRaceClockTimeTextAt', () => {
  const timeTextScenarios = [
    // The everyday case: the clock runs up, and 90 s after the reading it shows 1:01:30.
    {
      name: 'counts a running elapsed clock up from its reading',
      reading: createEnduroOneHourInReading(),
      secondsAfterTheReading: 90,
      expected: '1:01:30',
    },
    // A countdown runs down; with 30 min left, 90 s later it shows 28:30.
    {
      name: 'counts a running countdown down from its reading',
      reading: {
        ...createEnduroOneHourInReading(),
        clockMode: 'remaining' as const,
        referenceTimeMs: 1_800_000,
      },
      secondsAfterTheReading: 90,
      expected: '28:30',
    },
    // A red flag holds the clock: however long after, it shows the reading.
    {
      name: 'holds a stopped clock at its reading',
      reading: { ...createEnduroOneHourInReading(), state: 'red' as const, running: false },
      secondsAfterTheReading: 600,
      expected: '1:00:00',
    },
  ];

  it.each(timeTextScenarios)('$name', ({ reading, secondsAfterTheReading, expected }) => {
    // Arrange: the moment the scenario row asks for, on the server's clock.
    const nowMs = twoInTheAfternoonMs + secondsAfterTheReading * 1000;

    // Act: write the clock's text at that moment.
    const timeText = writeRaceClockTimeTextAt(reading, nowMs);

    // Assert: the text the race clock's card shows.
    expect(timeText, 'the clock text must be the shared H:MM:SS at that moment').toBe(expected);
  });
});
