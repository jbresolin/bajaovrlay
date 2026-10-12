/**
 * The time a clock on air shows right now (apps/control)
 *
 * What this module is for:
 *   A clock on air holds one reading ("at 9:45 it read 12:34") and the graphic counts on
 *   from it. For "Edição rápida" to show the operator the time that is on screen, the
 *   page must do the graphic's sum and the graphic's rounding. Both are the one copy in
 *   packages/shared/src/clock; this file reads the reading out of the data on air,
 *   through the keys found in the manifest, and writes the result as mm:ss.
 *
 * What these tests prove:
 *   - The text is what the screen shows: a running clock counted on from its reading
 *     (up for time elapsed, down for time remaining), a held clock at its reading, a
 *     countdown that ran out at 0:00, and a part of a second rounded as the graphic
 *     rounds it (down when counting up, up when counting down).
 *   - The data on air is read through whatever keys the manifest gave, and is refused
 *     as a whole when one of the four values is missing or is not what a clock holds.
 *
 * What these tests deliberately do not cover:
 *   - The sum and the rounding themselves, case by case: packages/shared/src/clock.
 *   - Finding the keys in a manifest: clockFieldsOfGraphic.test.ts.
 *   - Keeping the text up to date on the page: useTimeOnScreenInQuickEdit.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { readClockReadingOnAir, writeTimeOnScreenOfClock } from './timeOnScreenOfClockOnAir';

// The Saturday of the endurance race, in Brasília time: the clock went on air at 9:45.
const quarterToTenMs = Date.parse('2026-10-10T12:45:00.000Z');
const tenOClockMs = Date.parse('2026-10-10T13:00:00.000Z');

// The keys of a pit-stop countdown, a clock that shares no key with the race clock.
const keysOfThePitStopCountdown = {
  timeFieldKey: 'tempoMs',
  referenceMomentFieldKey: 'momentoDaLeituraMs',
  runningFieldKey: 'contando',
  clockModeFieldKey: 'sentido',
};

describe('writeTimeOnScreenOfClock', () => {
  const clocksOnAir = [
    // The first heat: running from 12:34 since 9:45, read at 10:00, fifteen minutes on.
    {
      name: 'counts a running clock up from its reading: 12:34 at 9:45 reads 27:34 at 10:00',
      reading: {
        clockMode: 'elapsed' as const,
        referenceTimeMs: 754_000,
        referenceWallClockMs: quarterToTenMs,
        running: true,
      },
      nowMs: tenOClockMs,
      expectedText: '27:34',
    },
    // A four-hour countdown, fifteen minutes in.
    {
      name: 'counts a running countdown down from its reading: 240:00 at 9:45 reads 225:00 at 10:00',
      reading: {
        clockMode: 'remaining' as const,
        referenceTimeMs: 14_400_000,
        referenceWallClockMs: quarterToTenMs,
        running: true,
      },
      nowMs: tenOClockMs,
      expectedText: '225:00',
    },
    // A ten-minute countdown left running for fifteen: the screen stays at 0:00, it
    // does not go below zero.
    {
      name: 'shows 0:00 for a countdown that ran out five minutes ago',
      reading: {
        clockMode: 'remaining' as const,
        referenceTimeMs: 600_000,
        referenceWallClockMs: quarterToTenMs,
        running: true,
      },
      nowMs: tenOClockMs,
      expectedText: '0:00',
    },
    // A red flag: the clock was held at 27:34 and shows that however long it takes.
    {
      name: 'shows a held clock at its reading, however much time has passed',
      reading: {
        clockMode: 'elapsed' as const,
        referenceTimeMs: 1_654_000,
        referenceWallClockMs: quarterToTenMs,
        running: false,
      },
      nowMs: tenOClockMs,
      expectedText: '27:34',
    },
    // Half a second past 27:34: the screen does not show a second that has not passed.
    {
      name: 'rounds a part of a second down when counting up: 27:34.5 reads 27:34',
      reading: {
        clockMode: 'elapsed' as const,
        referenceTimeMs: 754_000,
        referenceWallClockMs: quarterToTenMs,
        running: true,
      },
      nowMs: tenOClockMs + 500,
      expectedText: '27:34',
    },
    // Half a second into the countdown: the screen still shows the second being used up.
    {
      name: 'rounds a part of a second up when counting down: 224:59.5 reads 225:00',
      reading: {
        clockMode: 'remaining' as const,
        referenceTimeMs: 14_400_000,
        referenceWallClockMs: quarterToTenMs,
        running: true,
      },
      nowMs: tenOClockMs + 500,
      expectedText: '225:00',
    },
    // A countdown held between two seconds reads the higher one on screen, although the
    // reading itself, written plainly, would say 4:59.
    {
      name: 'rounds a held countdown up too: held at 4:59.5 it reads 5:00',
      reading: {
        clockMode: 'remaining' as const,
        referenceTimeMs: 299_500,
        referenceWallClockMs: quarterToTenMs,
        running: false,
      },
      nowMs: tenOClockMs,
      expectedText: '5:00',
    },
  ];

  it.each(clocksOnAir)('$name', ({ reading, nowMs, expectedText }) => {
    // Arrange: the reading on air and the moment it is looked at are the row of the table.

    // Act: write the time the screen shows at that moment.
    const textOnScreen = writeTimeOnScreenOfClock(reading, nowMs);

    // Assert: the same digits the audience sees.
    expect(textOnScreen, 'the text must be the time on screen at that moment, as mm:ss').toBe(
      expectedText,
    );
  });
});

describe('readClockReadingOnAir', () => {
  it('reads the four values through the keys the manifest gave', () => {
    // Arrange: a pit-stop countdown on air, 30 seconds counting down since 9:45.
    const dataOnAir = {
      equipe: 'Baja UFPR',
      tempoMs: 30_000,
      momentoDaLeituraMs: quarterToTenMs,
      contando: true,
      sentido: 'remaining',
    };

    // Act: read it as a clock.
    const reading = readClockReadingOnAir(keysOfThePitStopCountdown, dataOnAir);

    // Assert: one reading, in the words the shared clock sum uses.
    expect(reading, 'the data on air must be read as one clock reading').toEqual({
      clockMode: 'remaining',
      referenceTimeMs: 30_000,
      referenceWallClockMs: quarterToTenMs,
      running: true,
    });
  });

  const dataOnAirThatIsNotAClock = [
    // An instance that went on air under an older manifest may lack a field.
    {
      name: 'refuses data without the moment of the reading',
      dataOnAir: { tempoMs: 30_000, contando: true, sentido: 'remaining' },
    },
    // Data sent through the API by another program can hold anything.
    {
      name: 'refuses a time that is text',
      dataOnAir: {
        tempoMs: '0:30',
        momentoDaLeituraMs: quarterToTenMs,
        contando: true,
        sentido: 'remaining',
      },
    },
    // The switch must be a plain yes or no.
    {
      name: 'refuses a running switch that is not true or false',
      dataOnAir: {
        tempoMs: 30_000,
        momentoDaLeituraMs: quarterToTenMs,
        contando: 'sim',
        sentido: 'remaining',
      },
    },
    // The sum knows two directions; a manifest that offers a third cannot be followed.
    {
      name: 'refuses a direction that is neither elapsed nor remaining',
      dataOnAir: {
        tempoMs: 30_000,
        momentoDaLeituraMs: quarterToTenMs,
        contando: true,
        sentido: 'regressivo',
      },
    },
  ];

  it.each(dataOnAirThatIsNotAClock)('$name', ({ dataOnAir }) => {
    // Arrange: the data on air is the row of the table.

    // Act: read it as a clock.
    const reading = readClockReadingOnAir(keysOfThePitStopCountdown, dataOnAir);

    // Assert: no reading, so the form shows what is on air as it is.
    expect(reading, 'data that is not a whole clock reading must give no reading').toBeUndefined();
  });
});
