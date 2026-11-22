/**
 * The words of one results table row, and which of the page's columns are shown. A cell
 * goes on air as the site writes it ("SPOILERS", "SIM", "–"), with one exception: a cell
 * holding two values ("55.6 / 54.9", two timed laps) shows the first, so a column stays as
 * narrow as one value (gate decision of BAJAOVRLAY-83, written in docs/decisions.md).
 */
import { ptBR } from './ptBR.js';
import type { ResultsTableEntry } from './resultsTableModel.js';

/** One column of the page that is shown: its head, and where its cell is in each row. */
export type ShownColumn = { head: string; cellIndex: number };

/** The rank cell: the site's own rank, or "–" when the site gives none. */
export function writeRankText(entry: ResultsTableEntry): string {
  if (entry.rank === undefined) {
    return ptBR.emptyRankMark;
  }
  return String(entry.rank);
}

/** Whether the row's rank sits on the green chip: ranks 1 to 3, as the site's medals. */
export function isOnTheMedalChip(entry: ResultsTableEntry): boolean {
  return entry.rank !== undefined && entry.rank <= 3;
}

/**
 * The text a cell shows: as written, or the first of two values ("55.6 / 54.9" shows
 * "55.6"). A cell the row lacks shows empty.
 */
export function writeCellText(cellText: string | undefined): string {
  if (cellText === undefined) {
    return '';
  }
  const separatorPlace = cellText.indexOf(ptBR.twoValuesSeparator);
  if (separatorPlace === -1) {
    return cellText;
  }
  return cellText.slice(0, separatorPlace);
}

/** A column name as typed or as the site writes it, compared without case or extra spaces. */
export function normalizeColumnName(columnName: string): string {
  return columnName.trim().toLocaleLowerCase('pt-BR');
}

/**
 * The page's columns that are shown, in the page's order: those named in "Colunas
 * mostradas" (separated by commas, compared without case), or every column when it is
 * empty. Names that match no column are ignored; when none matches at all, every column
 * is shown, so a typo never leaves the board with the team alone.
 */
export function chooseShownColumns(
  columnHeads: readonly string[],
  columnsShownText: string,
): ShownColumn[] {
  const everyColumn = columnHeads.map((head, cellIndex) => ({ head, cellIndex }));
  const namesTyped = columnsShownText
    .split(',')
    .map(normalizeColumnName)
    .filter((name) => name !== '');
  if (namesTyped.length === 0) {
    return everyColumn;
  }
  const columnsNamed = everyColumn.filter((column) =>
    namesTyped.includes(normalizeColumnName(column.head)),
  );
  if (columnsNamed.length === 0) {
    return everyColumn;
  }
  return columnsNamed;
}
