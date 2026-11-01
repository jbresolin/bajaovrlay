/**
 * Reading a table answer by its columns' headers (BAJAOVRLAY-53): the columns' places by
 * header, each entry's cells, the cell under a header, and the headers a mapping reads,
 * so a header the answer lacks is named once for the whole table. Headers are compared
 * cleaned up (sourceTextCleanup.ts), so a trailing space on either side does not matter.
 */
import type { FlexShapeMapping } from './flexMappingConfig.js';
import type { FlexTableLayout } from './flexMappingListOptions.js';
import { type FlexColumnReading, listReadingsOfRule } from './flexRuleSources.js';
import { cleanUpTextFromASource } from './sourceTextCleanup.js';
import { readValueAtPath, type ValueAtPath } from './valuePath.js';

/** Each column's place, by cleaned-up header; or undefined when there is no columns list. */
export function readColumnPlacesByHeader(
  table: FlexTableLayout,
  response: unknown,
): Map<string, number> | undefined {
  const columnsReading = readValueAtPath(response, table.columnsPath);
  if (columnsReading.outcome !== 'found' || !Array.isArray(columnsReading.value)) {
    return undefined;
  }
  const columns: unknown[] = columnsReading.value;
  const columnPlaceByHeader = new Map<string, number>();
  columns.forEach((column, columnPlace) => {
    const headerReading = readValueAtPath(column, table.headerPath);
    const hasTextHeader =
      headerReading.outcome === 'found' && typeof headerReading.value === 'string';
    if (!hasTextHeader) {
      // The API sends `header: null` for a column with no title: nothing can name it.
      return;
    }
    const header = cleanUpTextFromASource(headerReading.value as string);
    // Two columns with one header share one value (the API's own rule): the first is read.
    if (!columnPlaceByHeader.has(header)) {
      columnPlaceByHeader.set(header, columnPlace);
    }
  });
  return columnPlaceByHeader;
}

/** Every header a mapping reads, in the order first written: its rules' and its parts'. */
export function listHeadersReadByMapping(mapping: FlexShapeMapping): string[] {
  const headers: string[] = [];
  const allRules = [...mapping.fields, ...(mapping.entryFields ?? [])];
  for (const rule of allRules) {
    for (const reading of listReadingsOfRule(rule)) {
      if (reading.kind === 'column') {
        headers.push(reading.header);
      }
    }
  }
  headers.push(...(mapping.scorePartsFromColumns?.headers ?? []));
  return [...new Set(headers)];
}

/** The headers the answer does not have, of those a mapping reads. */
export function findHeadersMissingFromTable(
  headersRead: string[],
  columnPlaceByHeader: ReadonlyMap<string, number>,
): string[] {
  return headersRead.filter((header) => !columnPlaceByHeader.has(cleanUpTextFromASource(header)));
}

/** One entry's cells, or undefined when there is no list at the layout's cells path. */
export function readCellsOfEntry(table: FlexTableLayout, element: unknown): unknown[] | undefined {
  const cellsReading = readValueAtPath(element, table.cellsPath);
  if (cellsReading.outcome !== 'found' || !Array.isArray(cellsReading.value)) {
    return undefined;
  }
  return cellsReading.value;
}

/**
 * Reads the cell under a header, then its sub-path when there is one. Nothing there when
 * the entry has no cells, the header is missing (named once for the table, not here) or
 * the row is shorter than the columns.
 */
export function readCellUnderHeader(
  cellsOfEntry: unknown[] | undefined,
  columnPlaceByHeader: ReadonlyMap<string, number>,
  columnReading: FlexColumnReading,
): ValueAtPath {
  const columnPlace = columnPlaceByHeader.get(cleanUpTextFromASource(columnReading.header));
  if (
    cellsOfEntry === undefined ||
    columnPlace === undefined ||
    columnPlace >= cellsOfEntry.length
  ) {
    return { outcome: 'nothingThere' };
  }
  const cell = cellsOfEntry[columnPlace];
  if (columnReading.path === undefined) {
    return { outcome: 'found', value: cell };
  }
  return readValueAtPath(cell, columnReading.path);
}
