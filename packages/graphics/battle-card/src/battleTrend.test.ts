/**
 * The battle card's trend, remembered from lap to lap (packages/graphics/battle-card)
 *
 * What this module is for:
 *   No data source says what the gap was a lap ago, so the battle card remembers it: the
 *   gap it saw when the car behind last completed a lap. When the car behind completes
 *   another lap, the new gap is compared with that one and the card shows "FECHANDO −0,7"
 *   (closing, green), "ABRINDO +0,7" (opening, blue) or "ESTÁVEL" (steady). The operator
 *   may also set the trend by hand, and then that one is shown. battleTrend.ts holds these
 *   rules as pure functions.
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
 *     them, or the gap disappears, there is no trend at all (the card shows "—"), even one
 *     set by hand, and the memory is emptied, so the battle starts again from nothing.
 *   - A trend set by hand otherwise always wins, its change signed by its word.
 *   - The words use the decimal comma, the tenth cut (never rounded) and the typographic
 *     minus (U+2212), never the hyphen.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the words, the shape and the colour, and the crossfade when the word
 *     changes: battleCardView.test.ts and battle-card.trendOnAir.test.ts cover those.
 *   - A renderer reload, which starts the memory again by design (the trade-off is written
 *     at the top of battleTrend.ts).
 */
import { describe, expect, it } from 'vitest';

import {
  chooseTrendToShow,
  emptyTrendMemory,
  followGapReading,
  type GapReading,
  isGapOfTheseTwoCars,
  type TrendMemory,
  type TrendShown,
  writeTrendWords,
} from './battleTrend.js';

/** Car 1 (Equipe FEI Baja, P5) right behind car 8 (Imperador, P4), at the given lap and gap. */
function readFeiBehindImperador(behindLaps: number, gapMs: number): GapReading {
  return {
    aheadCarNumber: 8,
    aheadPosition: 4,
    behindCarNumber: 1,
    behindPosition: 5,
    behindLaps,
    gapMs,
  };
}

/**
 * Car 1 has passed car 8: the item still names car 8 ahead and car 1 behind, but car 1 now
 * runs P4 and car 8 P5, and car 1's interval is to a third car, the P3.
 */
function readFeiAfterPassingImperador(behindLaps: number, gapMs: number): GapReading {
  return { ...readFeiBehindImperador(behindLaps, gapMs), aheadPosition: 5, behindPosition: 4 };
}

/** The trend a graphic would show after the last of these readings, with nothing by hand. */
function chooseTrendAfterReadings(readings: GapReading[]): TrendShown {
  const lastReading = readings.at(-1);
  const isGapShown = lastReading !== undefined && isGapOfTheseTwoCars(lastReading);
  return chooseTrendToShow(followReadings(readings), {}, isGapShown);
}

/** Follows a list of readings from an empty memory, as a graphic does from its load. */
function followReadings(readings: GapReading[]): TrendMemory {
  let memory = emptyTrendMemory;
  for (const reading of readings) {
    memory = followGapReading(memory, reading);
  }
  return memory;
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

describe('a trend set by hand', () => {
  const manualScenarios = [
    // The worked-out trend is opening; the operator says closing by 0,7 s: hand wins.
    {
      name: 'wins over the worked-out trend, its change shown as a closing minus',
      setByHand: { manualTrend: 'closing' as const, manualTrendChangeMs: 700 },
      expected: { word: 'closing', changeMs: -700 },
    },
    // The change typed is a size; opening shows it with a plus.
    {
      name: 'shows an opening change with a plus',
      setByHand: { manualTrend: 'opening' as const, manualTrendChangeMs: 700 },
      expected: { word: 'opening', changeMs: 700 },
    },
    // A trend by hand without a change shows the word alone.
    {
      name: 'shows the word alone when no change is typed',
      setByHand: { manualTrend: 'closing' as const },
      expected: { word: 'closing', changeMs: undefined },
    },
    // Steady never carries a number, even if one was typed.
    {
      name: 'never shows a number on steady',
      setByHand: { manualTrend: 'steady' as const, manualTrendChangeMs: 300 },
      expected: { word: 'steady', changeMs: undefined },
    },
  ];

  it.each(manualScenarios)('$name', ({ setByHand, expected }) => {
    // Arrange: a memory whose worked-out trend is opening by 0,7 s.
    const memory = followReadings([
      readFeiBehindImperador(1, 2000),
      readFeiBehindImperador(2, 2700),
    ]);

    // Act: choose the trend with this row's trend set by hand.
    const trend = chooseTrendToShow(memory, setByHand, true);

    // Assert: the hand's trend, never the worked-out one.
    expect(trend, 'a trend set by hand must always win').toEqual(expected);
  });

  it('shows no trend beside a gap of "—", even one set by hand', () => {
    // Arrange: car 1 has passed car 8, and the operator had set closing by 0,7 s.
    const memory = followReadings([readFeiAfterPassingImperador(3, 6000)]);

    // Act: choose the trend with the gap not shown.
    const trend = chooseTrendToShow(
      memory,
      { manualTrend: 'closing', manualTrendChangeMs: 700 },
      false,
    );

    // Assert: no trend; beside no gap a trend would say what the card cannot show.
    expect(trend, 'no trend at all beside "—"').toEqual({ word: 'none', changeMs: undefined });
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

describe('the words of the trend cell', () => {
  const wordScenarios: Array<{ name: string; trend: TrendShown; expected: string }> = [
    // The design's closing words, with the typographic minus.
    {
      name: 'writes closing by 0,7 s as "FECHANDO −0,7"',
      trend: { word: 'closing', changeMs: -700 },
      expected: 'FECHANDO −0,7',
    },
    // The design's opening words, with a plus.
    {
      name: 'writes opening by 0,7 s as "ABRINDO +0,7"',
      trend: { word: 'opening', changeMs: 700 },
      expected: 'ABRINDO +0,7',
    },
    // The tenth is cut like every race time: 0,79 s reads 0,7, never 0,8.
    {
      name: 'cuts the tenth: closing by 790 ms reads "FECHANDO −0,7"',
      trend: { word: 'closing', changeMs: -790 },
      expected: 'FECHANDO −0,7',
    },
    // A change past ten seconds keeps the comma (the design's "+11,0").
    {
      name: 'writes opening by 11 s as "ABRINDO +11,0"',
      trend: { word: 'opening', changeMs: 11_000 },
      expected: 'ABRINDO +11,0',
    },
    // Steady is the word alone.
    {
      name: 'writes steady as "ESTÁVEL"',
      trend: { word: 'steady', changeMs: undefined },
      expected: 'ESTÁVEL',
    },
  ];

  it.each(wordScenarios)('$name', ({ trend, expected }) => {
    // Arrange: the trend of this row.

    // Act: write its words.
    const words = writeTrendWords(trend);

    // Assert: the design's words, the comma and the right sign.
    expect(words, 'the trend words must be written as the design writes them').toBe(expected);
  });

  it('never writes the hyphen as the minus', () => {
    // Arrange: a closing trend.
    const closing: TrendShown = { word: 'closing', changeMs: -700 };

    // Act: write its words.
    const words = writeTrendWords(closing);

    // Assert: no hyphen, which Bebas Neue draws short and high.
    expect(words.includes('-'), 'the minus must be U+2212, never the hyphen').toBe(false);
  });
});
