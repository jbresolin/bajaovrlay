/**
 * Which page comes after the one on air when a graphic cycles through its pages: the tower,
 * the standings, the lower strip and the message ticker all turn 1, 2, … last, then 1
 * again. Written once here (BAJAOVRLAY-23 found the fourth copy).
 */

/** The page after this one, back to 1 after the last; with one page, page 1 again. */
export function chooseNextPageInCycle(pageNumber: number, pageCount: number): number {
  const isOnTheLastPage = pageNumber >= pageCount;
  return isOnTheLastPage ? 1 : pageNumber + 1;
}
