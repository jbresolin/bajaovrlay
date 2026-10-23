import {
  type EntityLibrary,
  type EntityType,
  mostRecordsInOneImport,
  ptBREntities,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import { type CsvRow, readCsvText } from './csvText';
import {
  type EntityCsvColumn,
  listCsvColumnsOfEntityType,
  listImageFieldsOfEntityType,
  readKeyFieldOfEntityType,
} from './entityCsvColumns';
import {
  type AnyEntityRecord,
  describeRecordOfType,
  gatherRecordsOfType,
  listRecordsOfType,
  readSchemaOfEntityType,
  type RecordsOfType,
} from './entityRecordsOfType';
import { readLocalDateTimeText } from './localDateTimeText';

const csvTexts = ptBR.entityLibrary.csv;

/** What one line of the file would do: be added, update a stored record, or be refused. */
export type ImportPreviewRowStatus = 'new' | 'update' | 'error';

/**
 * One line of the file in the preview: its line number, what it would do, the record it
 * would send (a valid line) or why not (an error), and how the record is named.
 */
export type ImportPreviewRow = {
  lineNumber: number;
  status: ImportPreviewRowStatus;
  record?: AnyEntityRecord;
  reason?: string;
  recordDescription: string;
};

/** The whole preview: the rows, or the problem that keeps the file from being read at all. */
export type CsvImportPreview = {
  entityType: EntityType;
  rows: ImportPreviewRow[];
  problemOfTheFile?: string;
};

/**
 * Reads a CSV for one tab into the preview "Importar CSV" shows: each line after the
 * header becomes "novo" (a key the library does not have; a person, sponsor or slot with
 * no id gets one from `makeNewId`), "atualiza" (a key it has; the record's images are
 * kept, since a CSV never carries one) or "erro" with the shared schema's pt-BR reason,
 * or "O carro 42 aparece duas vezes." for a key an earlier line already used. A missing
 * required column, a file with only the header, and a file of more lines than one import
 * may carry (mostRecordsInOneImport) are problems of the whole file.
 * Columns it does not know are ignored. Pure: it sends nothing.
 */
export function buildCsvImportPreview(
  entityType: EntityType,
  csvText: string,
  library: EntityLibrary,
  makeNewId: () => string,
): CsvImportPreview {
  const [headerRow, ...lineRows] = readCsvText(csvText);
  const columns = listCsvColumnsOfEntityType(entityType);
  const columnNamesInTheFile = (headerRow?.cells ?? []).map((cell) => cell.trim().toLowerCase());
  const missingColumn = columns.find(
    (column) => column.isRequired && !columnNamesInTheFile.includes(column.columnName),
  );
  if (missingColumn !== undefined) {
    return {
      entityType,
      rows: [],
      problemOfTheFile: csvTexts.missingColumn(missingColumn.columnName),
    };
  }
  if (lineRows.length === 0) {
    return { entityType, rows: [], problemOfTheFile: csvTexts.noRowsAfterTheHeader };
  }
  // The server refuses an import of more records; said here, before a line is read.
  if (lineRows.length > mostRecordsInOneImport) {
    const problemOfTheFile = csvTexts.tooManyLines(lineRows.length, mostRecordsInOneImport);
    return { entityType, rows: [], problemOfTheFile };
  }

  const keyField = readKeyFieldOfEntityType(entityType);
  const storedRecords = listRecordsOfType(library, entityType);
  const keysSeenInTheFile = new Set<unknown>();
  const rows = lineRows.map((lineRow) => {
    const row = readOneLine(
      entityType,
      lineRow,
      columns,
      columnNamesInTheFile,
      storedRecords,
      makeNewId,
    );
    if (row.record === undefined) {
      return row;
    }
    const key = (row.record as Record<string, unknown>)[keyField];
    if (keysSeenInTheFile.has(key)) {
      return {
        ...row,
        status: 'error' as const,
        record: undefined,
        reason: describeRepeatedKey(key),
      };
    }
    keysSeenInTheFile.add(key);
    return row;
  });
  return { entityType, rows };
}

/**
 * The records "Importar" sends: the valid lines' records, gathered under their type, or
 * undefined when no line is valid (the button is off then).
 */
export function listRecordsToImport(preview: CsvImportPreview): RecordsOfType | undefined {
  const validRecords: AnyEntityRecord[] = [];
  for (const row of preview.rows) {
    if (row.status !== 'error' && row.record !== undefined) {
      validRecords.push(row.record);
    }
  }
  if (validRecords.length === 0) {
    return undefined;
  }
  return gatherRecordsOfType(preview.entityType, validRecords);
}

/** One line read into a record and checked, or refused with the schema's reason. */
function readOneLine(
  entityType: EntityType,
  lineRow: CsvRow,
  columns: EntityCsvColumn[],
  columnNamesInTheFile: string[],
  storedRecords: AnyEntityRecord[],
  makeNewId: () => string,
): ImportPreviewRow {
  const keyField = readKeyFieldOfEntityType(entityType);
  const fields: Record<string, unknown> = {};
  for (const column of columns) {
    const cellText = (lineRow.cells[columnNamesInTheFile.indexOf(column.columnName)] ?? '').trim();
    // An empty cell leaves the field out: an optional field has no value, a required one
    // is refused by the schema with its "obrigatório".
    if (cellText !== '') {
      fields[column.recordFieldKey] = readCell(cellText, column);
    }
  }
  const isRecordWithoutItsId = entityType !== 'team' && fields[keyField] === undefined;
  if (isRecordWithoutItsId) {
    fields[keyField] = makeNewId();
  }
  const storedRecord = storedRecords.find(
    (record) => (record as Record<string, unknown>)[keyField] === fields[keyField],
  );
  const storedFields = storedRecord as Record<string, unknown> | undefined;
  // A CSV never carries an image, so an update keeps the record's own.
  for (const imageField of listImageFieldsOfEntityType(entityType)) {
    const storedImage = storedFields?.[imageField];
    if (storedImage !== undefined) {
      fields[imageField] = storedImage;
    }
  }
  // A column the file does not have says nothing about its field (gate 2 of PR #23): an
  // entry list with no "cidade" keeps the city a team has. A column present with an empty
  // cell does clear it.
  for (const column of columns) {
    const isColumnInTheFile = columnNamesInTheFile.includes(column.columnName);
    const storedValue = storedFields?.[column.recordFieldKey];
    if (!isColumnInTheFile && storedValue !== undefined) {
      fields[column.recordFieldKey] = storedValue;
    }
  }

  const check = readSchemaOfEntityType(entityType).safeParse(fields);
  if (!check.success) {
    return {
      lineNumber: lineRow.lineNumber,
      status: 'error',
      reason: check.error.issues[0]?.message,
      recordDescription: lineRow.cells.join(' · '),
    };
  }
  return {
    lineNumber: lineRow.lineNumber,
    status: storedRecord === undefined ? 'new' : 'update',
    record: check.data,
    recordDescription: describeRecordOfType(entityType, check.data),
  };
}

/**
 * A cell as the record field wants it: a whole number ("42"), a moment ("14/11/2026
 * 10:00"), or the text as it is. A cell that does not read is passed on as its text, so
 * the schema refuses it with its own pt-BR sentence ("Número do carro: um número inteiro
 * a partir de 1.").
 */
function readCell(cellText: string, column: EntityCsvColumn): unknown {
  switch (column.cellKind) {
    case 'text':
      return cellText;
    case 'wholeNumber':
      return /^\d+$/.test(cellText) ? Number(cellText) : cellText;
    case 'localDateTime':
      return readLocalDateTimeText(cellText) ?? cellText;
  }
}

/** The reason of a line whose key an earlier line already used. */
function describeRepeatedKey(key: unknown): string {
  return typeof key === 'number'
    ? ptBREntities.sliceProblems.carListedTwice(key)
    : ptBREntities.sliceProblems.idListedTwice(String(key));
}
