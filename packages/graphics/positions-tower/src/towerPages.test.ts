/**
 * Tower pages (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   The tower holds as many rows as `--tower-rows-per-page` says (20 in Ardósia) and the
 *   field may have 60 cars, so the list is cut into pages: which cars are on page n, how
 *   many pages there are, and which page comes after the one on air when the tower
 *   cycles. Pure arithmetic on the list; the page size comes from the theme, never from
 *   here.
 *
 * What these tests prove:
 *   - Page 1 is the first 20 cars, page 3 of a 60-car field is cars 41–60, and a last
 *     page shorter than the others holds only the cars left.
 *   - A field that fits on one page has one page, an empty list still has one page (so
 *     the tower never divides by nothing), and 60 cars make three pages of 20.
 *   - The page after the last one is page 1 again; with one page, the next page is 1.
 *
 * What these tests deliberately do not cover:
 *   - When pages turn and how they animate; pageTurner.ts and the component own that.
 */
import { describe, expect, it } from 'vitest';

import { chooseNextPageInCycle, countTowerPages, selectEntriesOnPage } from './towerPages.js';

/** Builds a field of `carCount` cars numbered from 1, each with its position. */
function createFieldOfCars(carCount: number): Array<{ position: number; carNumber: number }> {
  const cars = [];
  for (let index = 0; index < carCount; index += 1) {
    cars.push({ position: index + 1, carNumber: index + 1 });
  }
  return cars;
}

describe('selectEntriesOnPage', () => {
  it('gives the first 20 cars for page 1', () => {
    // Arrange: the whole 60-car field and 20 rows per page.
    const field = createFieldOfCars(60);

    // Act: pick page 1.
    const page = selectEntriesOnPage(field, 1, 20);

    // Assert: positions 1 to 20, in order.
    expect(
      page.map((car) => car.position),
      'page 1 must hold positions 1 to 20',
    ).toEqual(createFieldOfCars(20).map((car) => car.position));
  });

  it('gives cars 41 to 60 for page 3 of a 60-car field', () => {
    // Arrange: the whole 60-car field and 20 rows per page.
    const field = createFieldOfCars(60);

    // Act: pick page 3.
    const page = selectEntriesOnPage(field, 3, 20);

    // Assert: the last twenty positions.
    expect(page[0]?.position, 'page 3 must start at position 41').toBe(41);
    expect(page[19]?.position, 'page 3 must end at position 60').toBe(60);
    expect(page, 'page 3 must hold exactly 20 cars').toHaveLength(20);
  });

  it('gives only the cars left on a last page shorter than the others', () => {
    // Arrange: 45 cars: two full pages and five on the third.
    const field = createFieldOfCars(45);

    // Act: pick page 3.
    const page = selectEntriesOnPage(field, 3, 20);

    // Assert: positions 41 to 45 and nothing else (no empty rows).
    expect(
      page.map((car) => car.position),
      'a short last page must hold only the cars left',
    ).toEqual([41, 42, 43, 44, 45]);
  });
});

describe('countTowerPages', () => {
  const pageCountScenarios = [
    // A small field: everything fits on one page.
    { name: 'counts one page for 12 cars', carCount: 12, expected: 1 },
    // Exactly one page: no empty second page.
    { name: 'counts one page for exactly 20 cars', carCount: 20, expected: 1 },
    // One car over the edge needs a second page.
    { name: 'counts two pages for 21 cars', carCount: 21, expected: 2 },
    // The national enduro: 60 cars, three pages.
    { name: 'counts three pages for 60 cars', carCount: 60, expected: 3 },
    // No cars yet (before the grid is published): still one page, never zero.
    { name: 'counts one page for no cars at all', carCount: 0, expected: 1 },
  ];

  it.each(pageCountScenarios)('$name', ({ carCount, expected }) => {
    // Arrange: the number of cars of this row and 20 rows per page.

    // Act: count the pages.
    const pageCount = countTowerPages(carCount, 20);

    // Assert: what this row expects.
    expect(pageCount, 'the page count must cover every car and never be zero').toBe(expected);
  });
});

describe('chooseNextPageInCycle', () => {
  const nextPageScenarios = [
    // Mid-cycle: the next page.
    { name: 'goes from page 1 to page 2 of three', currentPage: 1, pageCount: 3, expected: 2 },
    // The last page wraps around to the first.
    { name: 'goes from page 3 of three back to page 1', currentPage: 3, pageCount: 3, expected: 1 },
    // One page only: the "next" page is the same one.
    {
      name: 'stays on page 1 when there is only one page',
      currentPage: 1,
      pageCount: 1,
      expected: 1,
    },
  ];

  it.each(nextPageScenarios)('$name', ({ currentPage, pageCount, expected }) => {
    // Arrange: the page on air and the page count of this row.

    // Act: choose the page that comes next.
    const nextPage = chooseNextPageInCycle(currentPage, pageCount);

    // Assert: what this row expects.
    expect(nextPage, 'the next page must follow the cycle and wrap around').toBe(expected);
  });
});
