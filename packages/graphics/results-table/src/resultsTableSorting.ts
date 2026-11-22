/**
 * "Ordenar por" and "Sentido" (BAJAOVRLAY-83, João's addition): the rows ordered by one
 * column of the page, as named pure functions in the graphic's model rather than a binding
 * transform, since the column and direction are the item's own settings and only this
 * graphic reads them. Only the row order changes: the rank shown is always the site's.
 *
 * The rules:
 * - a cell is compared as a number wherever one can be read from it ("57.3", "102.5%",
 *   "6º", "-15", "1:02.3", and the first of "55.6 / 54.9");
 * - a cell with no number ("SPOILERS", "–", "SIM", an empty cell) goes after every number,
 *   in either direction; two of them are compared as pt-BR text, in the direction chosen;
 * - a tie keeps the site's order.
 */
import { readNumberFromValueText } from './cellNumbers.js';
import { ptBR } from './ptBR.js';
import type { ResultsTableEntry, SortDirection } from './resultsTableModel.js';
import { findColumnNamed, normalizeColumnName, writeCellText } from './resultsTableText.js';

/** What a row is ordered by: one of its three fixed columns, or a cell of the page. */
type SortColumn =
  { kind: 'rank' } | { kind: 'car' } | { kind: 'team' } | { kind: 'cell'; cellIndex: number };

/** One row's value in the column ordered by: a number, or text when none can be read. */
type SortValue = { kind: 'number'; value: number } | { kind: 'text'; value: string };

/**
 * The number a cell's text holds, or undefined when it holds none: the number of the value
 * the cell shows (the first of "55.6 / 54.9"), read by cellNumbers.ts.
 */
export function readNumberFromCellText(cellText: string): number | undefined {
  return readNumberFromValueText(writeCellText(cellText));
}

/**
 * The rows ordered by the column named in "Ordenar por", in "Sentido". Empty, "Ordem do
 * site" or a name the page does not have keeps the site's order. The list given is never
 * changed; a new one is answered.
 */
export function orderRowsByColumn(
  entries: readonly ResultsTableEntry[],
  columnHeads: readonly string[],
  sortByColumnText: string,
  sortDirection: SortDirection,
): ResultsTableEntry[] {
  const sortColumn = findSortColumn(columnHeads, sortByColumnText);
  if (sortColumn === undefined) {
    return [...entries];
  }
  const rowsWithTheirPlace = entries.map((entry, siteIndex) => ({
    entry,
    siteIndex,
    sortValue: readSortValue(entry, sortColumn),
  }));
  rowsWithTheirPlace.sort((rowA, rowB) => {
    const comparison = compareSortValues(rowA.sortValue, rowB.sortValue, sortDirection);
    if (comparison !== 0) {
      return comparison;
    }
    // A tie keeps the site's order, whatever the direction.
    return rowA.siteIndex - rowB.siteIndex;
  });
  return rowsWithTheirPlace.map((row) => row.entry);
}

/**
 * Which column "Ordenar por" names: a page column or a fixed one; undefined for the site's
 * order (nothing typed, "Ordem do site", or a name the page does not have).
 */
function findSortColumn(
  columnHeads: readonly string[],
  sortByColumnText: string,
): SortColumn | undefined {
  const nameTyped = normalizeColumnName(sortByColumnText);
  if (nameTyped === '' || nameTyped === normalizeColumnName(ptBR.siteOrderName)) {
    return undefined;
  }
  // The page's own heads first: a page column named "Pos" would be the one meant.
  const cellIndex = findColumnNamed(columnHeads, sortByColumnText);
  if (cellIndex !== -1) {
    return { kind: 'cell', cellIndex };
  }
  const names = ptBR.fixedColumnNames;
  if (isOneOfTheNames(nameTyped, names.rank)) {
    return { kind: 'rank' };
  }
  if (isOneOfTheNames(nameTyped, names.car)) {
    return { kind: 'car' };
  }
  if (isOneOfTheNames(nameTyped, names.team)) {
    return { kind: 'team' };
  }
  return undefined;
}

/** Whether a normalized name is one of the catalog's names, compared the same way. */
function isOneOfTheNames(nameTyped: string, names: readonly string[]): boolean {
  return names.some((name) => normalizeColumnName(name) === nameTyped);
}

/** One row's value in the column: the rank and car as numbers, the team and cells as read. */
function readSortValue(entry: ResultsTableEntry, sortColumn: SortColumn): SortValue {
  switch (sortColumn.kind) {
    case 'rank':
      return entry.rank === undefined
        ? { kind: 'text', value: ptBR.emptyRankMark }
        : { kind: 'number', value: entry.rank };
    case 'car':
      return { kind: 'number', value: entry.carNumber };
    case 'team':
      return { kind: 'text', value: entry.teamName };
    case 'cell': {
      const cellText = entry.cells[sortColumn.cellIndex] ?? '';
      const cellNumber = readNumberFromCellText(cellText);
      return cellNumber === undefined
        ? { kind: 'text', value: cellText }
        : { kind: 'number', value: cellNumber };
    }
  }
}

/**
 * Compares two values: numbers before text in either direction, numbers by value and
 * text as pt-BR text, each in the direction chosen. 0 means a tie.
 */
function compareSortValues(
  valueA: SortValue,
  valueB: SortValue,
  sortDirection: SortDirection,
): number {
  if (valueA.kind === 'number' && valueB.kind === 'text') {
    return -1;
  }
  if (valueA.kind === 'text' && valueB.kind === 'number') {
    return 1;
  }
  const ascendingComparison =
    valueA.kind === 'number' && valueB.kind === 'number'
      ? valueA.value - valueB.value
      : String(valueA.value).localeCompare(String(valueB.value), 'pt-BR');
  return sortDirection === 'ascending' ? ascendingComparison : -ascendingComparison;
}
