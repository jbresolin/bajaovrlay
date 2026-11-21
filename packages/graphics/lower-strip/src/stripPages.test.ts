/**
 * The lower strip's pages (packages/graphics/lower-strip)
 *
 * What this module is for:
 *   The strip shows the running order six cars a page (fewer when each car also shows its
 *   laps or its gap, BAJAOVRLAY-81) and turns the page every `--motion-strip-hold`,
 *   cycling through the field. stripPages.ts decides how many cars a page holds, which
 *   cars they are and what the page cell reads.
 *
 * What these tests prove:
 *   - The real 34-car field makes 6 pages: five of six cars and one of four, and the page
 *     cells read "1/6" to "6/6".
 *   - Six cars a page with the plain pill; four with one extra cell (the laps, or a gap in
 *     any of its three looks); three with both. "Não mostrar" is no cell.
 *   - With the laps on, the real field makes 9 pages; with laps and gap, 12.
 *   - A page past the last, after the list shrank on air, shows the last page.
 *   - An empty list is one empty page.
 *
 * What these tests deliberately do not cover:
 *   - Whether each page fits the bar; that needs the real face and widths, so
 *     e2e/lowerStripFitsTheBar.e2e.ts renders the real field in Chromium.
 *   - The turn's motion; lowerStripAnimations.test.ts and lower-strip.paging.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { StripCarColumns } from './lowerStripModel.js';
import {
  carsPerStripPage,
  chooseCarsPerStripPage,
  countStripPages,
  listCarsOfStripPage,
  writePageCellText,
} from './stripPages.js';

/** The plain pill: no laps, no gap; every strip made before BAJAOVRLAY-81. */
const plainPillColumns: StripCarColumns = { isLapsShown: false, gapDisplay: 'none' };

/** The real enduro's field as car numbers 1 to 34, in position order. */
function listThirtyFourCarPositions(): number[] {
  return Array.from({ length: 34 }, (_unused, index) => index + 1);
}

describe('the pages of the real 34-car field', () => {
  it('makes 6 pages, five of six cars and the last of four, with page cells 1/6 to 6/6', () => {
    // Arrange: the 34 cars, in position order.
    const cars = listThirtyFourCarPositions();

    // Act: count the pages, then list each page's cars and its page cell.
    const carsPerPage = chooseCarsPerStripPage(plainPillColumns);
    const pageCount = countStripPages(cars.length, carsPerPage);
    const pages = Array.from({ length: pageCount }, (_unused, index) => ({
      cars: listCarsOfStripPage(cars, index + 1, carsPerPage),
      pageCell: writePageCellText(index + 1, pageCount),
    }));

    // Assert: six cars a page, in order, and the page cells as the design writes them.
    expect(carsPerStripPage, 'six cars a page, the design’s measurement').toBe(6);
    expect(carsPerPage, 'the plain pill takes six a page').toBe(6);
    expect(pageCount, '34 cars make 6 pages').toBe(6);
    expect(
      pages.map((page) => page.cars.length),
      'five full pages and a last page of four',
    ).toEqual([6, 6, 6, 6, 6, 4]);
    expect(pages[1]?.cars, 'page 2 holds positions 7 to 12').toEqual([7, 8, 9, 10, 11, 12]);
    expect(
      pages.map((page) => page.pageCell),
      'the page cells',
    ).toEqual(['1/6', '2/6', '3/6', '4/6', '5/6', '6/6']);
  });
});

describe('chooseCarsPerStripPage (BAJAOVRLAY-81)', () => {
  const carsPerPageScenarios: { name: string; columns: StripCarColumns; expected: number }[] = [
    // Every strip made before: six, the design's measurement.
    { name: 'six with no laps and no gap', columns: plainPillColumns, expected: 6 },
    // One extra cell: four fit the bar (measured, stripPages.ts).
    {
      name: 'four with the laps alone',
      columns: { isLapsShown: true, gapDisplay: 'none' },
      expected: 4,
    },
    // The gap counts as one cell whichever of its three looks the item picked.
    {
      name: 'four with the gap in laps alone',
      columns: { isLapsShown: false, gapDisplay: 'laps' },
      expected: 4,
    },
    {
      name: 'four with the gap in laps and time alone',
      columns: { isLapsShown: false, gapDisplay: 'lapsAndTime' },
      expected: 4,
    },
    {
      name: 'four with the gap in time alone',
      columns: { isLapsShown: false, gapDisplay: 'time' },
      expected: 4,
    },
    // Both cells: three fit the bar.
    {
      name: 'three with the laps and the gap',
      columns: { isLapsShown: true, gapDisplay: 'lapsAndTime' },
      expected: 3,
    },
  ];

  it.each(carsPerPageScenarios)('takes $name', ({ columns, expected }) => {
    // Arrange: what each car shows comes from the row above.

    // Act: choose the cars a page.
    const carsPerPage = chooseCarsPerStripPage(columns);

    // Assert: the count the measurement allows.
    expect(carsPerPage, 'the cars a page must be what fits the bar').toBe(expected);
  });

  it('pages the real 34-car field in 9 pages with the laps, and 12 with laps and gap', () => {
    // Arrange: the 34 cars, and the two choices.
    const cars = listThirtyFourCarPositions();
    const lapsAlone: StripCarColumns = { isLapsShown: true, gapDisplay: 'none' };
    const lapsAndGap: StripCarColumns = { isLapsShown: true, gapDisplay: 'laps' };

    // Act: count the pages for each, and list the last page with laps and gap.
    const pageCountWithLaps = countStripPages(cars.length, chooseCarsPerStripPage(lapsAlone));
    const pageCountWithBoth = countStripPages(cars.length, chooseCarsPerStripPage(lapsAndGap));
    const lastPageWithBoth = listCarsOfStripPage(cars, 12, chooseCarsPerStripPage(lapsAndGap));

    // Assert: 34 / 4 is 9 pages (the last of two); 34 / 3 is 12 (the last of one).
    expect(pageCountWithLaps, 'four a page makes 9 pages').toBe(9);
    expect(pageCountWithBoth, 'three a page makes 12 pages').toBe(12);
    expect(lastPageWithBoth, 'the last page holds the 34th car alone').toEqual([34]);
  });
});

describe('listCarsOfStripPage when the list changes under the page on air', () => {
  it('shows the last page when the page on air is past the end', () => {
    // Arrange: page 6 was on air, and five cars retired, so the list has 29 (5 pages).
    const cars = Array.from({ length: 29 }, (_unused, index) => index + 1);

    // Act: list page 6.
    const carsShown = listCarsOfStripPage(cars, 6, carsPerStripPage);

    // Assert: the last page, positions 25 to 29, never an empty bar.
    expect(carsShown, 'the last page instead of nothing').toEqual([25, 26, 27, 28, 29]);
  });

  it('counts an empty list as one empty page', () => {
    // Arrange: the positions before the start, with no car listed yet.
    const cars: number[] = [];

    // Act: count the pages and list page 1.
    const pageCount = countStripPages(cars.length, carsPerStripPage);
    const carsShown = listCarsOfStripPage(cars, 1, carsPerStripPage);

    // Assert: one page, empty.
    expect(pageCount, 'one page').toBe(1);
    expect(carsShown, 'with no car').toEqual([]);
  });
});
