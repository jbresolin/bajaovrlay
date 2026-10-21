/**
 * Which cars are on which page of the tower. The page size (`--tower-rows-per-page`) is
 * read from the theme by towerLayoutTokens.ts and passed in; nothing here knows it is 20.
 */

/** The entries on page `pageNumber` (from 1) when each page holds `rowsPerPage`. */
export function selectEntriesOnPage<Entry>(
  entries: readonly Entry[],
  pageNumber: number,
  rowsPerPage: number,
): Entry[] {
  const firstIndexOnPage = (pageNumber - 1) * rowsPerPage;
  return entries.slice(firstIndexOnPage, firstIndexOnPage + rowsPerPage);
}

/**
 * How many pages `entryCount` cars take: at least one, so an empty list still has a
 * page 1 (the tower shows its head and no rows, and never divides by nothing).
 */
export function countTowerPages(entryCount: number, rowsPerPage: number): number {
  const pagesNeeded = Math.ceil(entryCount / rowsPerPage);
  return Math.max(1, pagesNeeded);
}

/** The page after `currentPage` in a cycle of `pageCount` pages; the last wraps to 1. */
export function chooseNextPageInCycle(currentPage: number, pageCount: number): number {
  const isOnTheLastPage = currentPage >= pageCount;
  return isOnTheLastPage ? 1 : currentPage + 1;
}
