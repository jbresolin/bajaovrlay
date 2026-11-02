import type { DataShapeKey } from '@bajaovrlay/shared';

import type { MappingOptionsFormValues } from './flexMappingOptionsFormValues';
import { readTypedValueText } from './typedValueText';

/**
 * Turns a mapping block's options (BAJAOVRLAY-53) into the keys of its mapping, as typed
 * and not yet checked. An option left empty gives no key at all, so a mapping that uses
 * none of them is built exactly as before; one partly filled is written as typed, for the
 * shared schema to say what is missing. Each option is offered only on its shape's block,
 * so only those keys are built. Pure.
 */
export function buildMappingOptionsFromFormValues(
  shapeKey: DataShapeKey,
  options: MappingOptionsFormValues,
): Record<string, unknown> {
  const mappingKeys: Record<string, unknown> = {};
  const isAList = shapeKey !== 'session';

  const nestedEntriesPath = options.nestedEntriesPath.trim();
  if (isAList && nestedEntriesPath !== '') {
    mappingKeys.nestedEntriesPath = nestedEntriesPath;
  }
  if (isAList && options.lookups.length > 0) {
    mappingKeys.lookups = options.lookups.map((lookup) => ({
      lookupName: lookup.lookupName.trim(),
      requestId: lookup.requestId,
      listPath: lookup.listPath.trim(),
      keyPath: lookup.keyPath.trim(),
      entryKeyPath: lookup.entryKeyPath.trim(),
    }));
  }
  const table = buildTableLayout(options);
  if (isAList && table !== undefined) {
    mappingKeys.table = table;
  }
  const scorePartsFromColumns = buildScorePartsFromColumns(options);
  if (shapeKey === 'standings' && scorePartsFromColumns !== undefined) {
    mappingKeys.scorePartsFromColumns = scorePartsFromColumns;
  }
  const refuseWhen = buildRefusal(options);
  if (refuseWhen !== undefined) {
    mappingKeys.refuseWhen = refuseWhen;
  }
  if (shapeKey === 'positions' && options.workOutGapsFromLaps) {
    mappingKeys.workOutGapsFromLaps = true;
  }
  if (shapeKey === 'brackets' && options.incompleteConditions.length > 0) {
    mappingKeys.entryIsIncompleteWhen = options.incompleteConditions.map((condition) => ({
      path: condition.path.trim(),
      isOneOf: readCommaSeparatedValues(condition.valuesText),
    }));
  }
  return mappingKeys;
}

/** The table's layout, or undefined when its three paths are all empty. */
function buildTableLayout(options: MappingOptionsFormValues) {
  const columnsPath = options.table.columnsPath.trim();
  const headerPath = options.table.headerPath.trim();
  const cellsPath = options.table.cellsPath.trim();
  if (columnsPath === '' && headerPath === '' && cellsPath === '') {
    return undefined;
  }
  return { columnsPath, headerPath, cellsPath };
}

/** Standings' parts by column: one header per line, blank lines skipped; none when empty. */
function buildScorePartsFromColumns(options: MappingOptionsFormValues) {
  const headers = options.scorePartHeadersText
    .split('\n')
    .map((header) => header.trim())
    .filter((header) => header !== '');
  if (headers.length === 0) {
    return undefined;
  }
  const valuePath = options.scorePartValuePath.trim();
  return valuePath === '' ? { headers } : { headers, valuePath };
}

/**
 * The refusal flag, or undefined when its fields are all empty. With known values typed it
 * refuses by them (`notOneOf`), and by "Valor que recusa" too when that is typed, which
 * the schema then refuses under it: one comparison only. Without known values it refuses
 * by "Valor que recusa", an empty one meaning the empty text, as before.
 */
function buildRefusal(options: MappingOptionsFormValues) {
  const path = options.refuseWhen.path.trim();
  const message = options.refuseWhen.message.trim();
  const equalsText = options.refuseWhen.equalsText;
  const notOneOfText = options.refuseWhen.notOneOfText;
  const isEveryFieldEmpty =
    path === '' && equalsText.trim() === '' && notOneOfText.trim() === '' && message === '';
  if (isEveryFieldEmpty) {
    return undefined;
  }
  if (notOneOfText.trim() === '') {
    return { path, equals: readTypedValueText(equalsText), message };
  }
  const notOneOf = readCommaSeparatedValues(notOneOfText);
  return equalsText.trim() === ''
    ? { path, notOneOf, message }
    : { path, equals: readTypedValueText(equalsText), notOneOf, message };
}

/** Reads "pending, unknown" as its typed values, empty pieces skipped. */
function readCommaSeparatedValues(valuesText: string) {
  return valuesText
    .split(',')
    .filter((piece) => piece.trim() !== '')
    .map((piece) => readTypedValueText(piece));
}
