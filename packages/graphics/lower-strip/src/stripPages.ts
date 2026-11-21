/**
 * Which cars the lower strip shows on which page, and the words around them: the page
 * cell ("1/6") and a car's position with its ordinal sign ("1º"). Pure: no DOM, no clock.
 * The pages are in the list's order, which is the source's (the positions shape lists the
 * cars by position); a car that moves to another page is simply there at the next turn.
 */
import type { StripCarColumns } from './lowerStripModel.js';

/**
 * Six cars a page (decided in the brief). The design measured it with whole names: every
 * page of pass 1's 60-car sample fitted with six, the widest needing 1244 px of the 1392
 * the bar leaves between the clock block and the page cell, while seven would need 1444
 * (docs/design/directions/ardosia/README.md, "The lower strip"). The real 34-car field
 * makes six pages. Names are never cut: e2e/lowerStripFitsTheBar.e2e.ts renders the real
 * field and checks that no page is wider than the bar.
 */
export const carsPerStripPage = 6;

/**
 * Four cars a page when each pill also shows its laps or its gap (BAJAOVRLAY-81), so the
 * extra cell fits at the strip's own size instead of shrinking any text. Measured on the
 * real 34-car field in Chromium with the theme's face (2026-11-20): with the clock block
 * the bar leaves 1359 px; the widest page of four needs 1271 px with the laps ("43
 * VOLTAS") and 1278 with the gap in laps ("+41 VOLTAS", wider than any time gap), while
 * five would need 1521 and 1587.
 */
export const carsPerStripPageWithOneExtraCell = 4;

/**
 * Three cars a page when each pill shows both its laps and its gap: the widest page of
 * three needs 1295 px of the 1335 left beside a two-digit page cell ("1/12"); four would
 * need 1703. The real field then makes 12 pages.
 */
export const carsPerStripPageWithBothExtraCells = 3;

/**
 * How many cars a page holds for what each car shows: six with the plain pill, fewer with
 * one extra cell (laps, or a gap) and fewest with both. A gap shown as "Não mostrar" is no
 * cell. The count goes by the cells asked for, not by the texts of one page, so the pages
 * never reshuffle when a car's gap comes or goes.
 */
export function chooseCarsPerStripPage(columns: StripCarColumns): number {
  const isGapCellShown = columns.gapDisplay !== 'none';
  const extraCellCount = (columns.isLapsShown ? 1 : 0) + (isGapCellShown ? 1 : 0);
  if (extraCellCount === 2) {
    return carsPerStripPageWithBothExtraCells;
  }
  if (extraCellCount === 1) {
    return carsPerStripPageWithOneExtraCell;
  }
  return carsPerStripPage;
}

/** How many pages a list of cars fills; an empty list is still one (empty) page. */
export function countStripPages(carCount: number, carsPerPage: number): number {
  if (carCount === 0) {
    return 1;
  }
  return Math.ceil(carCount / carsPerPage);
}

/**
 * The cars of one page, counted from 1. A page past the last (the list shrank under the
 * page on air, or the pages got shorter) gives the last page, never an empty bar.
 */
export function listCarsOfStripPage<Car>(
  cars: readonly Car[],
  pageNumber: number,
  carsPerPage: number,
): Car[] {
  const lastPageNumber = countStripPages(cars.length, carsPerPage);
  const pageShown = Math.min(Math.max(pageNumber, 1), lastPageNumber);
  const firstIndex = (pageShown - 1) * carsPerPage;
  return cars.slice(firstIndex, firstIndex + carsPerPage);
}

/** The page cell's text: "1/6". */
export function writePageCellText(pageNumber: number, pageCount: number): string {
  return `${pageNumber}/${pageCount}`;
}
