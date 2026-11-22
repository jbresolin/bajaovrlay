/**
 * The words of one results table row, and which of the page's columns are shown. A cell
 * goes on air as the site writes it ("SPOILERS", "SIM", "–"), with one exception: a cell
 * holding two numbers ("55.6 / 54.9", two timed laps) shows the first, so a column stays as
 * narrow as one value (gate decision of BAJAOVRLAY-83, written in docs/decisions.md).
 */
import { readNumberFromValueText } from './cellNumbers.js';
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
 * The text a cell shows: as written, or the first of two values when it is a number
 * ("55.6 / 54.9" shows "55.6"). Words around the separator ("Aprovado / Pendente") are one
 * text and stay whole. A cell the row lacks shows empty.
 */
export function writeCellText(cellText: string | undefined): string {
  if (cellText === undefined) {
    return '';
  }
  const separatorPlace = cellText.indexOf(ptBR.twoValuesSeparator);
  if (separatorPlace === -1) {
    return cellText;
  }
  const firstValue = cellText.slice(0, separatorPlace);
  const isFirstValueANumber = readNumberFromValueText(firstValue) !== undefined;
  return isFirstValueANumber ? firstValue : cellText;
}

/**
 * A column name as typed or as the site writes it, compared without case, accents or
 * extra spaces: an operator typing "% da media" or "bonus 4x4" means the site's column.
 */
export function normalizeColumnName(columnName: string): string {
  const withoutAccents = columnName.normalize('NFD').replace(/\p{M}/gu, '');
  return withoutAccents.trim().toLocaleLowerCase('pt-BR');
}

/**
 * The place of the head a typed name means, or -1 for none: the head equal to it
 * (normalizeColumnName), else the one head that starts with it ("classificado" for
 * "Classificado (≤115%)"). A start two heads share means neither, so nothing is guessed.
 */
export function findColumnNamed(columnHeads: readonly string[], typedName: string): number {
  const nameTyped = normalizeColumnName(typedName);
  if (nameTyped === '') {
    return -1;
  }
  const headsNormalized = columnHeads.map(normalizeColumnName);
  const equalPlace = headsNormalized.indexOf(nameTyped);
  if (equalPlace !== -1) {
    return equalPlace;
  }
  const placesStartingWithIt = headsNormalized
    .map((head, place) => (head.startsWith(nameTyped) ? place : -1))
    .filter((place) => place !== -1);
  if (placesStartingWithIt.length !== 1) {
    return -1;
  }
  return placesStartingWithIt[0] ?? -1;
}

/**
 * The page's columns that are shown, in the page's order: those named in "Colunas
 * mostradas" (separated by commas, each found by findColumnNamed), or every column when it
 * is empty. Names that match no column are ignored; when none matches at all, every column
 * is shown, so a typo never leaves the board with the team alone.
 */
export function chooseShownColumns(
  columnHeads: readonly string[],
  columnsShownText: string,
): ShownColumn[] {
  const everyColumn = columnHeads.map((head, cellIndex) => ({ head, cellIndex }));
  const namesTyped = columnsShownText.split(',').filter((name) => name.trim() !== '');
  if (namesTyped.length === 0) {
    return everyColumn;
  }
  const placesNamed = namesTyped.map((name) => findColumnNamed(columnHeads, name));
  const columnsNamed = everyColumn.filter((column) => placesNamed.includes(column.cellIndex));
  if (columnsNamed.length === 0) {
    return everyColumn;
  }
  return columnsNamed;
}
