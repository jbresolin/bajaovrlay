/**
 * The laps and the gap to the leader in a car's pill (packages/graphics/lower-strip,
 * BAJAOVRLAY-81)
 *
 * What this module is for:
 *   Each item of the strip may ask every car to show its laps and its gap to the leader,
 *   read from the positions entry the strip already receives (`laps`, `gapToLeaderMs`,
 *   `gapToLeaderLaps`). stripCarTexts.ts turns those numbers into the words in the pill,
 *   following the item's two choices; an empty text means the cell is not drawn at all.
 *
 * What these tests prove:
 *   - The laps read "43 voltas" (and "1 volta"), only when the item asks for them, and
 *     nothing when the source did not send them.
 *   - The gap, for each of the four choices, on a lapped car, on a car on the leader's
 *     lap, on the leader and on a car the source sent no gap for: laps as "+2 voltas",
 *     time as "+12,3" (to the tenth, cut, no unit, as the tower writes it).
 *   - The leader never shows a gap, and "+0 voltas" never appears.
 *
 * What these tests deliberately do not cover:
 *   - Working a gap out from the laps: that is the source mapping's job
 *     (`workOutGapsFromLaps`, shared/flexMapping/gapsFromLaps.ts); a graphic only shows
 *     the data it is given.
 *   - Upper case on air; the theme's --case-rows does it, and the screenshots show it.
 */
import { describe, expect, it } from 'vitest';

import type { StripCar, StripGapDisplay } from './lowerStripModel.js';
import { writeGapText, writeLapsText } from './stripCarTexts.js';

/** The leader of the enduro: car 51, FAHOR, 43 laps; a leader carries no gap. */
function createLeaderFahor(): StripCar {
  return { position: 1, carNumber: 51, schoolName: 'FAHOR', laps: 43 };
}

/** Car 10, UFSJ, in 2nd on 42 laps: one lap down, as the positions shape sends it. */
function createLappedUfsj(): StripCar {
  return { position: 2, carNumber: 10, schoolName: 'UFSJ', laps: 42, gapToLeaderLaps: 1 };
}

/** Car 47, UTFPR-PB, in 3rd on 41 laps: two laps down. */
function createTwoLapsDownUtfprPb(): StripCar {
  return { position: 3, carNumber: 47, schoolName: 'UTFPR-PB', laps: 41, gapToLeaderLaps: 2 };
}

/** Car 1, FEI, early in the race: on the leader's lap, 12.399 s behind. */
function createFeiOnTheLeadersLap(): StripCar {
  return { position: 2, carNumber: 1, schoolName: 'FEI', laps: 5, gapToLeaderMs: 12_399 };
}

/** Car 8, UTFPR-CWB, as a source that sends no gaps lists it: laps only. */
function createUtfprCwbWithoutGaps(): StripCar {
  return { position: 5, carNumber: 8, schoolName: 'UTFPR-CWB', laps: 37 };
}

describe('writeLapsText', () => {
  const lapsScenarios = [
    // The everyday case: the item asks for laps and the source sends them.
    {
      name: 'writes "43 voltas" for 43 laps',
      car: createLeaderFahor(),
      isLapsShown: true,
      expected: '43 voltas',
    },
    // Portuguese has a singular: one lap is "1 volta", never "1 voltas".
    {
      name: 'writes the singular "1 volta" for one lap',
      car: { ...createLeaderFahor(), laps: 1 },
      isLapsShown: true,
      expected: '1 volta',
    },
    // A car that has not finished a lap yet still shows its count, 0 included.
    {
      name: 'writes "0 voltas" before the first lap',
      car: { ...createLeaderFahor(), laps: 0 },
      isLapsShown: true,
      expected: '0 voltas',
    },
    // The default: the item did not ask for laps, so the pill looks as it always did.
    {
      name: 'writes nothing when the item does not ask for laps',
      car: createLeaderFahor(),
      isLapsShown: false,
      expected: '',
    },
    // A typed list, or a source without laps: nothing to show, so no cell.
    {
      name: 'writes nothing when the car carries no laps',
      car: { position: 1, carNumber: 51, schoolName: 'FAHOR' },
      isLapsShown: true,
      expected: '',
    },
  ];

  it.each(lapsScenarios)('$name', ({ car, isLapsShown, expected }) => {
    // Arrange: the car and the item's choice come from the row above.

    // Act: write the laps cell.
    const lapsText = writeLapsText(car, isLapsShown);

    // Assert: the words the pill shows.
    expect(lapsText, 'the laps cell must read as the row says').toBe(expected);
  });
});

describe('writeGapText', () => {
  const gapScenarios: {
    name: string;
    car: StripCar;
    gapDisplay: StripGapDisplay;
    expected: string;
  }[] = [
    // "Não mostrar", the default: no car shows a gap, so existing strips keep their look.
    {
      name: 'none: a lapped car shows nothing',
      car: createLappedUfsj(),
      gapDisplay: 'none',
      expected: '',
    },
    {
      name: 'none: a car on the leader’s lap shows nothing',
      car: createFeiOnTheLeadersLap(),
      gapDisplay: 'none',
      expected: '',
    },

    // "Só voltas": the laps behind, with the singular for one lap.
    {
      name: 'laps: one lap down reads "+1 volta"',
      car: createLappedUfsj(),
      gapDisplay: 'laps',
      expected: '+1 volta',
    },
    {
      name: 'laps: two laps down reads "+2 voltas"',
      car: createTwoLapsDownUtfprPb(),
      gapDisplay: 'laps',
      expected: '+2 voltas',
    },
    // The rule João named: a car on the leader's lap never reads "+0 voltas".
    {
      name: 'laps: a car on the leader’s lap shows nothing, never "+0 voltas"',
      car: createFeiOnTheLeadersLap(),
      gapDisplay: 'laps',
      expected: '',
    },

    // "Voltas e tempo": whichever gap the car has, as the tower's DIF. column.
    {
      name: 'laps and time: a lapped car reads its laps',
      car: createTwoLapsDownUtfprPb(),
      gapDisplay: 'lapsAndTime',
      expected: '+2 voltas',
    },
    // Cut to the tenth, never rounded: 12 399 ms is "+12,3", not "+12,4".
    {
      name: 'laps and time: a car on the leader’s lap reads its time, cut to the tenth',
      car: createFeiOnTheLeadersLap(),
      gapDisplay: 'lapsAndTime',
      expected: '+12,3',
    },

    // "Só tempo": only a time; a lapped car has none in the positions shape.
    {
      name: 'time: a car on the leader’s lap reads "+12,3"',
      car: createFeiOnTheLeadersLap(),
      gapDisplay: 'time',
      expected: '+12,3',
    },
    {
      name: 'time: a lapped car shows nothing',
      car: createLappedUfsj(),
      gapDisplay: 'time',
      expected: '',
    },

    // The leader has no gap to itself, whatever the choice (the tower leaves it blank too).
    {
      name: 'the leader shows nothing with laps',
      car: createLeaderFahor(),
      gapDisplay: 'laps',
      expected: '',
    },
    {
      name: 'the leader shows nothing with laps and time',
      car: createLeaderFahor(),
      gapDisplay: 'lapsAndTime',
      expected: '',
    },
    // Even if a source wrongly sent the leader a gap, it is not shown.
    {
      name: 'the leader shows nothing even when the source sent it a gap',
      car: { ...createLeaderFahor(), gapToLeaderMs: 0 },
      gapDisplay: 'time',
      expected: '',
    },

    // A source that sends no gaps: nothing to show, so no cell (never a made-up gap).
    {
      name: 'a car the source sent no gap for shows nothing',
      car: createUtfprCwbWithoutGaps(),
      gapDisplay: 'lapsAndTime',
      expected: '',
    },
  ];

  it.each(gapScenarios)('$name', ({ car, gapDisplay, expected }) => {
    // Arrange: the car and the item's choice come from the row above.

    // Act: write the gap cell.
    const gapText = writeGapText(car, gapDisplay);

    // Assert: the words the pill shows.
    expect(gapText, 'the gap cell must read as the row says').toBe(expected);
  });
});
