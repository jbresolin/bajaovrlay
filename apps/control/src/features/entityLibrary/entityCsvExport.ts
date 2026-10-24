import type { EntityLibrary, EntityType } from '@bajaovrlay/shared';

import { writeCsvText } from './csvText';
import { type EntityCsvColumn, listCsvColumnsOfEntityType } from './entityCsvColumns';
import { exampleLinesOfEachTab } from './entityCsvExamples';
import { listRecordsOfTypeInOrder } from './entityOrdering';
import type { AnyEntityRecord } from './entityRecordsOfType';
import { writeLocalDateTimeText } from './localDateTimeText';

/**
 * "Exportar CSV": a tab's records in the tab's order, with the columns the import reads
 * (entityCsvColumns.ts) and no image, as a pt-BR spreadsheet opens it. Imported again,
 * every line is "atualiza" with the same record, its images kept by the import.
 */
export function writeRecordsAsCsv(entityType: EntityType, library: EntityLibrary): string {
  const columns = listCsvColumnsOfEntityType(entityType);
  const records = listRecordsOfTypeInOrder(library, entityType);
  const lines = records.map((record) => columns.map((column) => writeCell(record, column)));
  return writeCsvText(
    columns.map((column) => column.columnName),
    lines,
  );
}

/** "Baixar exemplo": the tab's header and its example lines. */
export function writeExampleCsvOfEntityType(entityType: EntityType): string {
  const columns = listCsvColumnsOfEntityType(entityType);
  return writeCsvText(
    columns.map((column) => column.columnName),
    exampleLinesOfEachTab[entityType],
  );
}

/** One record field as its cell: a moment as "14/11/2026 10:00", a missing value empty. */
function writeCell(record: AnyEntityRecord, column: EntityCsvColumn): string {
  const value = (record as Record<string, unknown>)[column.recordFieldKey];
  if (value === undefined) {
    return '';
  }
  if (column.cellKind === 'localDateTime' && typeof value === 'number') {
    return writeLocalDateTimeText(value);
  }
  return String(value);
}
