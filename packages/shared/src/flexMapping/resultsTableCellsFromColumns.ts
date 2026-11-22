/**
 * A table answer read whole, every column as text, for the results table shape
 * (BAJAOVRLAY-83). The columns kept are listed once per poll (their heads and places); each
 * entry then gets one text cell per column kept. Nothing here refuses a cell: a page writes
 * "SPOILERS", "SIM" or "–" where another writes a number, and every one goes on air as it
 * is written. Generic on purpose: which value of a cell is read, and which columns are left
 * out, is the preset's to say.
 */
import type { FlexCellsAsTextFromColumns, FlexTableLayout } from './flexMappingListOptions.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';
import { cleanUpTextFromASource } from './sourceTextCleanup.js';
import { readValueAtPath } from './valuePath.js';

/** One column kept: its head as text ("" when it has none) and its place in the cells. */
export type ColumnReadAsText = { head: string; columnPlace: number };

/**
 * The columns kept, in the table's order, each with its cleaned-up head; undefined when
 * the answer has no list of columns (the mapping's table check names that problem).
 */
export function listColumnsReadAsText(
  table: FlexTableLayout,
  cellsAsText: FlexCellsAsTextFromColumns,
  response: unknown,
): ColumnReadAsText[] | undefined {
  const columnsReading = readValueAtPath(response, table.columnsPath);
  if (columnsReading.outcome !== 'found' || !Array.isArray(columnsReading.value)) {
    return undefined;
  }
  const columns: unknown[] = columnsReading.value;
  const columnsKept: ColumnReadAsText[] = [];
  columns.forEach((column, columnPlace) => {
    if (isColumnLeftOut(column, cellsAsText)) {
      return;
    }
    const headReading = readValueAtPath(column, table.headerPath);
    const hasTextHead = headReading.outcome === 'found' && typeof headReading.value === 'string';
    // A column with no title (`header: null`) is kept: its cells still show, under no head.
    const head = hasTextHead ? cleanUpTextFromASource(headReading.value as string) : '';
    columnsKept.push({ head, columnPlace });
  });
  return columnsKept;
}

/**
 * One entry's cells as text, one per column kept. A row shorter than the columns, or a
 * cell with nothing readable, gives "" for that cell, so the cells never shift columns.
 */
export function readCellsOfEntryAsText(
  cellsOfEntry: unknown[] | undefined,
  columnsKept: readonly ColumnReadAsText[],
  cellsAsText: FlexCellsAsTextFromColumns,
): string[] {
  return columnsKept.map((column) => {
    const cell = cellsOfEntry?.[column.columnPlace];
    const value = readFirstValueOfCell(cell, cellsAsText.valuePaths);
    return writeCellValueAsText(value);
  });
}

/**
 * Writes one cell's value as text: text cleaned up the usual way, a number with at most
 * two decimals and a point, as the site writes them (an old answer's raw 252.39999999999998
 * reads 252.4), yes or no in pt-BR, and anything else (null, a list, an object) as "".
 */
export function writeCellValueAsText(value: unknown): string {
  if (typeof value === 'string') {
    return cleanUpTextFromASource(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const roundedToTwoDecimals = Math.round(value * 100) / 100;
    return String(roundedToTwoDecimals);
  }
  if (typeof value === 'boolean') {
    return value ? ptBRFlexMapping.cellTexts.yes : ptBRFlexMapping.cellTexts.no;
  }
  return '';
}

/** The first value found and not null at the cell's paths, in order; undefined for none. */
function readFirstValueOfCell(cell: unknown, valuePaths: readonly string[]): unknown {
  for (const valuePath of valuePaths) {
    const reading = readValueAtPath(cell, valuePath);
    if (reading.outcome === 'found' && reading.value !== null) {
      return reading.value;
    }
  }
  return undefined;
}

/** Whether the column's value at the condition's path is one of the values listed. */
function isColumnLeftOut(column: unknown, cellsAsText: FlexCellsAsTextFromColumns): boolean {
  const condition = cellsAsText.leaveOutColumnsWhen;
  if (condition === undefined) {
    return false;
  }
  const reading = readValueAtPath(column, condition.path);
  if (reading.outcome !== 'found') {
    return false;
  }
  return condition.isOneOf.some((value) => value === reading.value);
}
