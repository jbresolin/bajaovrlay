/**
 * The lower strip's data (packages/graphics/lower-strip)
 *
 * What this module is for:
 *   lowerStripModel.ts checks the data `load` and `updateAction` receive: the running
 *   order (bound live to the positions), the clock group (the race clock's five reading
 *   fields) and the clock block's switch, and merges the partial updates the live
 *   bindings send.
 *
 * What these tests prove:
 *   - The clock block is shown unless the data switches it off.
 *   - A positions entry with every field the source sends (laps, gaps, status…) fits.
 *   - A new running order replaces the whole list and keeps the clock; a bad update is
 *     refused with a pt-BR sentence naming the field, the data left as it was.
 *
 * What these tests deliberately do not cover:
 *   - The manifest saying the same; lowerStripManifestDataAgreement.test.ts.
 *   - Which cars a page holds; stripPages.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  isClockBlockShown,
  type LowerStripData,
  mergePartialUpdateIntoLowerStripData,
  parseCompleteLowerStripData,
} from './lowerStripModel.js';
import { createRealEnduroStripData } from './lowerStripOnThePage.testSupport.js';

describe('isClockBlockShown', () => {
  const switchScenarios = [
    // The everyday strip, as an item made before the switch was touched.
    {
      name: 'shows the block when the switch is missing',
      showClockBlock: undefined,
      expected: true,
    },
    // The operator left it on.
    { name: 'shows the block when the switch is on', showClockBlock: true, expected: true },
    // The race clock card is up, so the strip leaves out its block.
    { name: 'hides the block when the switch is off', showClockBlock: false, expected: false },
  ];

  it.each(switchScenarios)('$name', ({ showClockBlock, expected }) => {
    // Arrange: the real enduro's strip with the switch of this row.
    const data: LowerStripData = { ...createRealEnduroStripData(), showClockBlock };

    // Act: ask whether the block is shown.
    const isShown = isClockBlockShown(data);

    // Assert: the answer of this row.
    expect(isShown, 'the block follows its switch, on by default').toBe(expected);
  });
});

describe('parseCompleteLowerStripData', () => {
  it('takes the positions entries as the source sends them, every field included', () => {
    // Arrange: the leader as the positions shape lists it, laps, gaps and status included.
    const data = {
      ...createRealEnduroStripData(),
      entries: [
        {
          position: 1,
          carNumber: 51,
          teamName: 'Sinuelo',
          schoolName: 'FAHOR',
          laps: 43,
          lastLapMs: 193_000,
          pitStops: 3,
          status: 'running',
        },
      ],
    };

    // Act: check it.
    const check = parseCompleteLowerStripData(data);

    // Assert: accepted; a whole list bound from the positions fits as it comes.
    expect(check.isValid, 'a positions entry must fit the strip as it is').toBe(true);
  });
});

describe('mergePartialUpdateIntoLowerStripData', () => {
  it('replaces the whole running order and keeps the clock', () => {
    // Arrange: the strip with the 34 cars.
    const currentData = createRealEnduroStripData();
    const twoCarsLeft = [
      { position: 1, carNumber: 51, schoolName: 'FAHOR' },
      { position: 2, carNumber: 10, schoolName: 'UFSJ' },
    ];

    // Act: the live binding sends a new list.
    const merged = mergePartialUpdateIntoLowerStripData(currentData, { entries: twoCarsLeft });

    // Assert: the new list in full, the clock as it was.
    expect(merged, 'the list is replaced, the clock kept').toEqual({
      isValid: true,
      data: { ...createRealEnduroStripData(), entries: twoCarsLeft },
    });
  });

  it('refuses a bad update with a pt-BR sentence and leaves the data as it was', () => {
    // Arrange: the strip with the 34 cars.
    const currentData = createRealEnduroStripData();

    // Act: an update with a flag the session does not know.
    const merged = mergePartialUpdateIntoLowerStripData(currentData, { state: 'azul' });

    // Assert: refused naming the field, the data untouched.
    expect(merged, 'a bad update must be refused in pt-BR').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "state".',
    });
    expect(currentData, 'the current data must not change').toEqual(createRealEnduroStripData());
  });
});
