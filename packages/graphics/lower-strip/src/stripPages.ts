/**
 * Which cars the lower strip shows on which page, and the words around them: the page
 * cell ("1/6") and a car's position with its ordinal sign ("1º"). Pure: no DOM, no clock.
 * The pages are in the list's order, which is the source's (the positions shape lists the
 * cars by position); a car that moves to another page is simply there at the next turn.
 */

/**
 * Six cars a page (decided in the brief). The design measured it with whole names: every
 * page of pass 1's 60-car sample fitted with six, the widest needing 1244 px of the 1392
 * the bar leaves between the clock block and the page cell, while seven would need 1444
 * (docs/design/directions/ardosia/README.md, "The lower strip"). The real 34-car field
 * makes six pages. Names are never cut: e2e/lowerStripFitsTheBar.e2e.ts renders the real
 * field and checks that no page is wider than the bar.
 */
export const carsPerStripPage = 6;

/** How many pages a list of cars fills; an empty list is still one (empty) page. */
export function countStripPages(carCount: number): number {
  if (carCount === 0) {
    return 1;
  }
  return Math.ceil(carCount / carsPerStripPage);
}

/**
 * The cars of one page, counted from 1. A page past the last (the list shrank under the
 * page on air) gives the last page, never an empty bar.
 */
export function listCarsOfStripPage<Car>(cars: readonly Car[], pageNumber: number): Car[] {
  const lastPageNumber = countStripPages(cars.length);
  const pageShown = Math.min(Math.max(pageNumber, 1), lastPageNumber);
  const firstIndex = (pageShown - 1) * carsPerStripPage;
  return cars.slice(firstIndex, firstIndex + carsPerStripPage);
}

/** The page cell's text: "1/6". */
export function writePageCellText(pageNumber: number, pageCount: number): string {
  return `${pageNumber}/${pageCount}`;
}
