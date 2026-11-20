/**
 * The lower strip's pages when a laps or gap cell is switched on air
 * (packages/graphics/lower-strip, BAJAOVRLAY-81)
 *
 * What this module is for:
 *   Switching "Mostrar as voltas" or "Diferença para o líder" changes how many cars a page
 *   holds (six, four or three, stripPages.ts), so every page boundary moves. Keeping the
 *   page number would jump around the running order ("6/6" becoming "6/9", cars 21 to 24),
 *   so the strip starts again at page 1, with the leader. An update that leaves the cars a
 *   page as they were keeps the page on air, as before.
 *
 * What these tests prove:
 *   - Switching the laps on while page 4 is on air shows page 1 of 9, the leader first.
 *   - Switching the laps off on page 8 of 9 shows page 1 of 6, not a clamped later page.
 *   - A switch that arrives during a page turn is drawn once the turn ends, at page 1.
 *   - An update that keeps the cars a page (a new running order, or one gap look swapped
 *     for another) keeps the page on air.
 *
 * What these tests deliberately do not cover:
 *   - The page timer itself; lower-strip.paging.test.ts.
 *   - How many cars a page each choice takes; stripPages.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  createLowerStripOnThePage,
  createRealEnduroStripData,
  loadLowerStripWithData,
  readCarNumbersOnAir,
  readPageCell,
} from './lowerStripOnThePage.testSupport.js';
import { createRealEnduroField } from './realEnduroField.js';

/** The car number of the leader of the real field: car 51, FAHOR. */
const leaderCarNumber = 51;

/** Puts the real field on air with the given data and turns the page `turns` times. */
async function putRealFieldOnAirAtPage(data: object, turns: number) {
  const lowerStrip = createLowerStripOnThePage();
  await loadLowerStripWithData(lowerStrip, data);
  await lowerStrip.playAction({ skipAnimation: true });
  for (let turnIndex = 0; turnIndex < turns; turnIndex += 1) {
    await lowerStrip.turnToTheNextPageNow();
  }
  return lowerStrip;
}

describe('a cell switched on air changes the cars a page', () => {
  it('starts again at page 1 of 9 when the laps come on while page 4 is on air', async () => {
    // Arrange: the everyday strip (six a page) turned to page 4.
    const lowerStrip = await putRealFieldOnAirAtPage(createRealEnduroStripData(), 3);
    const pageCellBefore = readPageCell(lowerStrip);

    // Act: the operator switches "Mostrar as voltas" on.
    await lowerStrip.updateAction({ data: { showLaps: true } });

    // Assert: page 1 of the shorter pages, starting at the leader.
    expect(pageCellBefore, 'the strip was on page 4').toBe('4/6');
    expect(readPageCell(lowerStrip), 'back to page 1, now of 9').toBe('1/9');
    expect(readCarNumbersOnAir(lowerStrip)[0], 'the leader comes first').toBe(leaderCarNumber);
    expect(readCarNumbersOnAir(lowerStrip), 'four cars a page now').toHaveLength(4);
  });

  it('starts again at page 1 of 6 when the laps go off on page 8 of 9', async () => {
    // Arrange: the strip with laps (four a page) turned to page 8.
    const lowerStrip = await putRealFieldOnAirAtPage(
      { ...createRealEnduroStripData(), showLaps: true },
      7,
    );
    const pageCellBefore = readPageCell(lowerStrip);

    // Act: the operator switches the laps off.
    await lowerStrip.updateAction({ data: { showLaps: false } });

    // Assert: page 1 of 6 with the leader, not the clamped "6/6".
    expect(pageCellBefore, 'the strip was on page 8').toBe('8/9');
    expect(readPageCell(lowerStrip), 'back to page 1, now of 6').toBe('1/6');
    expect(readCarNumbersOnAir(lowerStrip)[0], 'the leader comes first').toBe(leaderCarNumber);
  });

  it('draws a switch that arrives during a page turn at page 1, once the turn ends', async () => {
    // Arrange: the everyday strip on air, on page 1.
    const lowerStrip = await putRealFieldOnAirAtPage(createRealEnduroStripData(), 0);

    // Act: a turn to page 2 starts, the gap is switched on while it runs, then it ends.
    const pendingTurn = lowerStrip.turnToTheNextPageNow();
    await lowerStrip.updateAction({ data: { gapDisplay: 'laps' } });
    await pendingTurn;

    // Assert: after the turn, page 1 of the four-car pages, the leader first.
    expect(readPageCell(lowerStrip), 'page 1, now of 9').toBe('1/9');
    expect(readCarNumbersOnAir(lowerStrip)[0], 'the leader comes first').toBe(leaderCarNumber);
  });
});

describe('an update that keeps the cars a page', () => {
  it('keeps the page on air for a new running order', async () => {
    // Arrange: the everyday strip on page 3.
    const lowerStrip = await putRealFieldOnAirAtPage(createRealEnduroStripData(), 2);

    // Act: the positions send the running order again, as every few seconds.
    await lowerStrip.updateAction({ data: { entries: createRealEnduroField() } });

    // Assert: still page 3.
    expect(readPageCell(lowerStrip), 'the page on air is kept').toBe('3/6');
  });

  it('keeps the page on air when one gap look is swapped for another', async () => {
    // Arrange: the strip with the gap in laps (four a page) on page 5.
    const lowerStrip = await putRealFieldOnAirAtPage(
      { ...createRealEnduroStripData(), gapDisplay: 'laps' },
      4,
    );

    // Act: the operator picks "Voltas e tempo", still one cell.
    await lowerStrip.updateAction({ data: { gapDisplay: 'lapsAndTime' } });

    // Assert: still page 5 of 9.
    expect(readPageCell(lowerStrip), 'the page on air is kept').toBe('5/9');
  });
});
