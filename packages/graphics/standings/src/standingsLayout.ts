/**
 * Which board the standings draw and what is on each page, as pure functions of the data.
 * The layout is chosen from the data, never by a switch: with score parts the overall
 * table (20 rows a page, one column per part), without them the board in three columns of
 * 20 (the whole field at once, up to 60 teams). The design never shows more than 60 teams
 * in columns; past 60 the columns board pages by 60 (decision of BAJAOVRLAY-24). The page
 * sizes are the brief's and the design's fixed numbers, not theme tokens: they decide which
 * team is on which page, which a look change must not move ("page 2" means the same teams
 * on the tower and the board).
 */
import { ptBR } from './ptBR.js';
import type { ScorePart, StandingsEntry } from './standingsModel.js';

/** The two boards: the overall table with its parts, or the columns with one number each. */
export type StandingsLayout = 'table' | 'columns';

/** Rows on one page of the table, and rows in one column of the columns board. */
export const rowsPerTablePage = 20;
export const rowsPerColumn = 20;
export const columnsPerPage = 3;

/** One page as the view draws it: the columns of rows (the table is one column) and the head's line. */
export type StandingsPage = {
  layout: StandingsLayout;
  pageNumber: number;
  pageCount: number;
  /** The table has one; the columns board one to three, filled top to bottom, left to right. */
  columns: StandingsEntry[][];
  /** "1/3 · 1º A 20º", or "54 EQUIPES" when the whole field fits on one page. */
  pageLine: string;
};

/** The table when there are score parts, the columns board when there are none. */
export function chooseStandingsLayout(scoreParts: readonly ScorePart[]): StandingsLayout {
  return scoreParts.length > 0 ? 'table' : 'columns';
}

/** How many teams one page of a layout holds: 20 in the table, 3 × 20 in columns. */
export function countRowsPerPage(layout: StandingsLayout): number {
  return layout === 'table' ? rowsPerTablePage : columnsPerPage * rowsPerColumn;
}

/** How many pages `entryCount` teams take; never fewer than one (an empty board is one page). */
export function countStandingsPages(entryCount: number, layout: StandingsLayout): number {
  const pageCount = Math.ceil(entryCount / countRowsPerPage(layout));
  return Math.max(1, pageCount);
}

/**
 * Keeps a page number inside the pages the list has now. A list that shrank under the
 * page on air goes to its last page, the nearest to what was on screen (the tower does
 * the same); a re-take always starts on page 1 anyway.
 */
export function keepPageInsideTheList(
  pageNumber: number,
  entryCount: number,
  layout: StandingsLayout,
): number {
  const pageCount = countStandingsPages(entryCount, layout);
  return Math.min(Math.max(1, pageNumber), pageCount);
}

/**
 * The head's line: with several pages the page and the rows it shows, by row position in
 * the list counted from 1 ("2/3 · 21º A 40º", whatever the ranks, which tie); with one
 * page the number of teams ("33 EQUIPES"), as the design's columns board writes it.
 */
export function writePageLine(
  pageNumber: number,
  entryCount: number,
  layout: StandingsLayout,
): string {
  const pageCount = countStandingsPages(entryCount, layout);
  if (pageCount === 1) {
    return ptBR.teamCount(entryCount);
  }
  const rowsPerPage = countRowsPerPage(layout);
  const firstRowNumber = (pageNumber - 1) * rowsPerPage + 1;
  const lastRowNumber = Math.min(pageNumber * rowsPerPage, entryCount);
  return ptBR.pageLine(pageNumber, pageCount, firstRowNumber, lastRowNumber);
}

/**
 * Splits a page's teams into the columns board's columns: the first 20 down the left
 * column, the next 20 down the middle, the rest down the right. A column with no team is
 * left out, so 33 teams draw two columns and never an empty frame.
 */
export function splitIntoColumns(entriesOnPage: readonly StandingsEntry[]): StandingsEntry[][] {
  const columns: StandingsEntry[][] = [];
  for (let firstIndex = 0; firstIndex < entriesOnPage.length; firstIndex += rowsPerColumn) {
    columns.push(entriesOnPage.slice(firstIndex, firstIndex + rowsPerColumn));
  }
  return columns;
}

/**
 * Lays out one page of the list for the layout: the teams of that page (the page number
 * kept inside the list first), split into columns for the columns board, and the line.
 */
export function layOutStandingsPage(
  entries: readonly StandingsEntry[],
  layout: StandingsLayout,
  pageNumberAsked: number,
): StandingsPage {
  const pageNumber = keepPageInsideTheList(pageNumberAsked, entries.length, layout);
  const rowsPerPage = countRowsPerPage(layout);
  const firstIndex = (pageNumber - 1) * rowsPerPage;
  const entriesOnPage = entries.slice(firstIndex, firstIndex + rowsPerPage);
  const columns = layout === 'table' ? [entriesOnPage] : splitIntoColumns(entriesOnPage);
  return {
    layout,
    pageNumber,
    pageCount: countStandingsPages(entries.length, layout),
    columns,
    pageLine: writePageLine(pageNumber, entries.length, layout),
  };
}
