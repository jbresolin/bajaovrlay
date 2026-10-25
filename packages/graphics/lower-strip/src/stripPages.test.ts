/**
 * The lower strip's pages (packages/graphics/lower-strip)
 *
 * What this module is for:
 *   The strip shows the running order six cars a page and turns the page every
 *   `--motion-strip-hold`, cycling through the field. stripPages.ts decides which cars a
 *   page holds and what the page cell reads.
 *
 * What these tests prove:
 *   - The real 34-car field makes 6 pages: five of six cars and one of four, and the page
 *     cells read "1/6" to "6/6".
 *   - A page past the last, after the list shrank on air, shows the last page.
 *   - An empty list is one empty page.
 *
 * What these tests deliberately do not cover:
 *   - Whether each page fits the bar; that needs the real face and widths, so
 *     e2e/lowerStripFitsTheBar.e2e.ts renders the real field in Chromium.
 *   - The turn's motion; lowerStripAnimations.test.ts and lower-strip.paging.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  carsPerStripPage,
  countStripPages,
  listCarsOfStripPage,
  writePageCellText,
} from './stripPages.js';

/** The real enduro's field as car numbers 1 to 34, in position order. */
function listThirtyFourCarPositions(): number[] {
  return Array.from({ length: 34 }, (_unused, index) => index + 1);
}

describe('the pages of the real 34-car field', () => {
  it('makes 6 pages, five of six cars and the last of four, with page cells 1/6 to 6/6', () => {
    // Arrange: the 34 cars, in position order.
    const cars = listThirtyFourCarPositions();

    // Act: count the pages, then list each page's cars and its page cell.
    const pageCount = countStripPages(cars.length);
    const pages = Array.from({ length: pageCount }, (_unused, index) => ({
      cars: listCarsOfStripPage(cars, index + 1),
      pageCell: writePageCellText(index + 1, pageCount),
    }));

    // Assert: six cars a page, in order, and the page cells as the design writes them.
    expect(carsPerStripPage, 'six cars a page, the design’s measurement').toBe(6);
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

describe('listCarsOfStripPage when the list changes under the page on air', () => {
  it('shows the last page when the page on air is past the end', () => {
    // Arrange: page 6 was on air, and five cars retired, so the list has 29 (5 pages).
    const cars = Array.from({ length: 29 }, (_unused, index) => index + 1);

    // Act: list page 6.
    const carsShown = listCarsOfStripPage(cars, 6);

    // Assert: the last page, positions 25 to 29, never an empty bar.
    expect(carsShown, 'the last page instead of nothing').toEqual([25, 26, 27, 28, 29]);
  });

  it('counts an empty list as one empty page', () => {
    // Arrange: the positions before the start, with no car listed yet.
    const cars: number[] = [];

    // Act: count the pages and list page 1.
    const pageCount = countStripPages(cars.length);
    const carsShown = listCarsOfStripPage(cars, 1);

    // Assert: one page, empty.
    expect(pageCount, 'one page').toBe(1);
    expect(carsShown, 'with no car').toEqual([]);
  });
});
