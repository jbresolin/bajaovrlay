/**
 * The battle card's trend, remembered from lap to lap (packages/graphics/battle-card)
 *
 * What this module is for:
 *   No data source says what the gap was a lap ago, so the battle card remembers it: the
 *   gap it saw when the car behind last completed a lap. When the car behind completes
 *   another lap, the new gap is compared with that one and the card shows "FECHANDO −0,7"
 *   (closing, green), "ABRINDO +0,7" (opening, blue) or "ESTÁVEL" (steady). battleTrend.ts
 *   holds these rules as pure functions.
 *
 * What these tests prove:
 *   - The first reading shows "ESTÁVEL" with no number, since there is nothing to compare.
 *   - A gap 0,1 s or more smaller after a lap is closing and 0,1 s or more larger is
 *     opening, exactly at the threshold too; anything less is steady with no number.
 *   - An update without a lap of the car behind compares nothing: the trend and the
 *     remembered gap stay as they were, however the gap moved within the lap.
 *   - Another pair of cars, laps that went down, or laps that jumped by two start the
 *     memory again (steady with no number); the next single lap compares with that reading.
 *   - Gate 2 of PR #27: once the car behind passes the car ahead, or a car runs between
 *     them, or the gap disappears, there is no trend at all (the card shows "—") and the
 *     memory is emptied, so the battle starts again from nothing; isGapOfTheseTwoCars is
 *     that check.
 *
 * What these tests deliberately do not cover:
 *   - A trend set by hand, and the words of the cell: battleTrendShown.test.ts.
 *   - Drawing the words, the shape and the colour, and the crossfade when the word
 *     changes: battleCardView.test.ts and battle-card.trendOnAir.test.ts cover those.
 *   - A renderer reload, which starts the memory again by design (the trade-off is written
 *     at the top of battleTrend.ts).
 */
import { describe, expect, it } from 'vitest';

import {
  chooseTrendToShow,
  followGapReading,
  type GapReading,
  isGapOfTheseTwoCars,
  type TrendShown,
} from './battleTrend.js';
import {
  followReadings,
  readFeiAfterPassingImperador,
  readFeiBehindImperador,
} from './battleTrendReadings.testSupport.js';

/** The trend a graphic would show after the last of these readings, with nothing by hand. */
function chooseTrendAfterReadings(readings: GapReading[]): TrendShown {
  const lastReading = readings.at(-1);
  const isGapShown = lastReading !== undefined && isGapOfTheseTwoCars(lastReading);
  return chooseTrendToShow(followReadings(readings), {}, isGapShown);
}

describe('the trend worked out from the gap', () => {
  const trendScenarios: Array<{ name: string; readings: GapReading[]; expected: TrendShown }> = [
    // Nothing to compare yet: the card must not invent a trend.
    {
      name: 'shows steady with no number at the first reading',
      readings: [readFeiBehindImperador(1, 2000)],
      expected: { word: 'steady', changeMs: undefined },
    },
    // The everyday closing: 0,7 s gained in one lap.
    {
      name: 'shows closing when the gap is 0,7 s smaller after a lap',
      readings: [readFeiBehindImperador(1, 2000), readFeiBehindImperador(2, 1300)],
      expected: { word: 'closing', changeMs: -700 },
    },
    // Exactly the threshold counts as a trend (at least 0,1 s, the brief says).
    {
      name: 'shows closing when the gap is exactly 0,1 s smaller',
      readings: [readFeiBehindImperador(1, 2000), readFeiBehindImperador(2, 1900)],
      expected: { word: 'closing', changeMs: -100 },
    },
    // One millisecond under the threshold is steady, with no number.
    {
      name: 'shows steady when the gap is 0,099 s smaller',
      readings: [readFeiBehindImperador(1, 2000), readFeiBehindImperador(2, 1901)],
      expected: { word: 'steady', changeMs: undefined },
    },
    // The everyday opening: 0,7 s lost in one lap.
    {
      name: 'shows opening when the gap is 0,7 s larger after a lap',
      readings: [readFeiBehindImperador(1, 2000), readFeiBehindImperador(2, 2700)],
      expected: { word: 'opening', changeMs: 700 },
    },
    // Exactly the threshold the other way.
    {
      name: 'shows opening when the gap is exactly 0,1 s larger',
      readings: [readFeiBehindImperador(1, 2000), readFeiBehindImperador(2, 2100)],
      expected: { word: 'opening', changeMs: 100 },
    },
    // Just under the threshold the other way.
    {
      name: 'shows steady when the gap is 0,099 s larger',
      readings: [readFeiBehindImperador(1, 2000), readFeiBehindImperador(2, 2099)],
      expected: { word: 'steady', changeMs: undefined },
    },
    // Within one lap the gap moves at every poll; only a completed lap compares, so the
    // closing seen at lap 2 holds while the gap changes before lap 3.
    {
      name: 'compares nothing while the car behind has not completed another lap',
      readings: [
        readFeiBehindImperador(1, 2000),
        readFeiBehindImperador(2, 1300),
        readFeiBehindImperador(2, 2600),
        readFeiBehindImperador(2, 2900),
      ],
      expected: { word: 'closing', changeMs: -700 },
    },
    // The comparison is with the gap at the last lap change, not the last poll: 2,9 s
    // seen within lap 2 does not count, 1,3 s at the lap change does.
    {
      name: 'compares with the gap seen at the last lap change, not at the last update',
      readings: [
        readFeiBehindImperador(1, 2000),
        readFeiBehindImperador(2, 1300),
        readFeiBehindImperador(2, 2900),
        readFeiBehindImperador(3, 2000),
      ],
      expected: { word: 'opening', changeMs: 700 },
    },
    // The item now follows another car behind: its gaps say nothing about the old one.
    {
      name: 'starts again when the car behind is another car',
      readings: [
        readFeiBehindImperador(1, 2000),
        readFeiBehindImperador(2, 1300),
        { ...readFeiBehindImperador(3, 900), behindCarNumber: 47 },
      ],
      expected: { word: 'steady', changeMs: undefined },
    },
    // A timing correction took a lap away: what was remembered no longer holds.
    {
      name: 'starts again when the laps of the car behind went down',
      readings: [
        readFeiBehindImperador(1, 2000),
        readFeiBehindImperador(2, 1300),
        readFeiBehindImperador(1, 2000),
      ],
      expected: { word: 'steady', changeMs: undefined },
    },
    // Gate 2 of PR #27: a missed poll, or a correction, made the laps jump by two; the gap
    // of two laps ago says nothing about one lap, so nothing is compared.
    {
      name: 'starts again when the laps of the car behind jumped by two',
      readings: [
        readFeiBehindImperador(1, 2000),
        readFeiBehindImperador(2, 1300),
        readFeiBehindImperador(4, 600),
      ],
      expected: { word: 'steady', changeMs: undefined },
    },
    // After a lap jump the new reading is kept, so the next single lap compares with it.
    {
      name: 'compares again at the next single lap after a jump',
      readings: [
        readFeiBehindImperador(1, 2000),
        readFeiBehindImperador(3, 1300),
        readFeiBehindImperador(4, 600),
      ],
      expected: { word: 'closing', changeMs: -700 },
    },
    // Car 1 passed car 8: its interval is now to a third car, so there is no trend at all
    // (the card shows "—" as the gap), never an "ABRINDO +4,7" across cars.
    {
      name: 'shows no trend once the car behind has passed the car ahead',
      readings: [
        readFeiBehindImperador(1, 2000),
        readFeiBehindImperador(2, 1300),
        readFeiAfterPassingImperador(3, 6000),
      ],
      expected: { word: 'none', changeMs: undefined },
    },
    // Car 1 became leader: the source sends it no interval.
    {
      name: 'shows no trend when the gap disappears',
      readings: [
        readFeiBehindImperador(1, 2000),
        readFeiBehindImperador(2, 1300),
        { ...readFeiBehindImperador(3, 0), gapMs: undefined },
      ],
      expected: { word: 'none', changeMs: undefined },
    },
    // Car 8 passes car 1 back: the memory was emptied at the pass, so the first reading of
    // the battle again shows steady with no number, not a comparison with before the pass.
    {
      name: 'starts again from nothing when the cars are one place apart again',
      readings: [
        readFeiBehindImperador(1, 2000),
        readFeiAfterPassingImperador(2, 6000),
        readFeiBehindImperador(3, 1300),
      ],
      expected: { word: 'steady', changeMs: undefined },
    },
  ];

  it.each(trendScenarios)('$name', ({ readings, expected }) => {
    // Arrange: the readings of this row, one per update, from the load on.

    // Act: follow them all and choose the trend with nothing set by hand.
    const trend = chooseTrendAfterReadings(readings);

    // Assert: the trend this row expects.
    expect(trend, 'the trend must be the one this row expects').toEqual(expected);
  });

  it('keeps the very same memory when no lap was completed', () => {
    // Arrange: a memory that has seen lap 2.
    const memoryAtLapTwo = followReadings([
      readFeiBehindImperador(1, 2000),
      readFeiBehindImperador(2, 1300),
    ]);

    // Act: take a reading of the same lap with another gap.
    const memoryAfter = followGapReading(memoryAtLapTwo, readFeiBehindImperador(2, 2400));

    // Assert: nothing at all changed, the remembered gap included.
    expect(memoryAfter, 'a reading without a lap must leave the memory as it was').toBe(
      memoryAtLapTwo,
    );
  });
});

describe('isGapOfTheseTwoCars', () => {
  const gapScenarios = [
    // The battle as the item means it: car 1 one place behind car 8.
    { name: 'is true one place behind', reading: readFeiBehindImperador(2, 1300), expected: true },
    // Car 1 passed car 8: its interval is to someone else.
    {
      name: 'is false after the pass',
      reading: readFeiAfterPassingImperador(2, 6000),
      expected: false,
    },
    // A car between them (car 1 fell to P6): its interval is to that car.
    {
      name: 'is false with a car between them',
      reading: { ...readFeiBehindImperador(2, 900), behindPosition: 6 },
      expected: false,
    },
    // No interval sent (car 1 leads, or the leader has no lap yet).
    {
      name: 'is false with no gap',
      reading: { ...readFeiBehindImperador(2, 0), gapMs: undefined },
      expected: false,
    },
  ];

  it.each(gapScenarios)('$name', ({ reading, expected }) => {
    // Arrange: the reading of this row.

    // Act: ask whether its gap is these two cars'.
    const isTheirs = isGapOfTheseTwoCars(reading);

    // Assert: as the row says.
    expect(isTheirs, 'the gap belongs to these two cars only one place apart').toBe(expected);
  });
});
