/**
 * Which rows are on each page of the results table, as pure functions of the rows: 20 a
 * page, like the standings' overall table, with the same page line in the head ("2/3 · 21º
 * A 40º", or "16 EQUIPES" on one page). The page size is the brief's fixed number, not a
 * theme token: it decides which team is on which page, which a look change must not move.
 */
import { ptBR } from './ptBR.js';
import type { ResultsTableEntry } from './resultsTableModel.js';

/** Rows on one page of the table. */
export const rowsPerPage = 20;

/** One page as the view draws it: its rows and the head's line. */
export type ResultsTablePage = {
  pageNumber: number;
  pageCount: number;
  entries: ResultsTableEntry[];
  /** "1/3 · 1º A 20º", or "16 EQUIPES" when every row fits on one page. */
  pageLine: string;
};

/** How many pages `entryCount` rows take; never fewer than one (an empty table is one page). */
export function countResultsTablePages(entryCount: number): number {
  return Math.max(1, Math.ceil(entryCount / rowsPerPage));
}

/**
 * Keeps a page number inside the pages the rows fill now. A list that shrank under the
 * page on air goes to its last page, the nearest to what was on screen (as the standings).
 */
export function keepPageInsideTheList(pageNumber: number, entryCount: number): number {
  return Math.min(Math.max(1, pageNumber), countResultsTablePages(entryCount));
}

/**
 * The head's line: with several pages the page and the rows it shows, by row position in
 * the list counted from 1 (whatever the site's ranks); with one page the number of teams.
 */
export function writePageLine(pageNumber: number, entryCount: number): string {
  const pageCount = countResultsTablePages(entryCount);
  if (pageCount === 1) {
    return ptBR.teamCount(entryCount);
  }
  const firstRowNumber = (pageNumber - 1) * rowsPerPage + 1;
  const lastRowNumber = Math.min(pageNumber * rowsPerPage, entryCount);
  return ptBR.pageLine(pageNumber, pageCount, firstRowNumber, lastRowNumber);
}

/** Lays out one page of the rows (the page number kept inside the list first) and its line. */
export function layOutResultsTablePage(
  entries: readonly ResultsTableEntry[],
  pageNumberAsked: number,
): ResultsTablePage {
  const pageNumber = keepPageInsideTheList(pageNumberAsked, entries.length);
  const firstIndex = (pageNumber - 1) * rowsPerPage;
  return {
    pageNumber,
    pageCount: countResultsTablePages(entries.length),
    entries: entries.slice(firstIndex, firstIndex + rowsPerPage),
    pageLine: writePageLine(pageNumber, entries.length),
  };
}
