import {
  type AlternativeFormValues,
  type FieldRuleFormValues,
  noTransformId,
  type ReadingFormValues,
  type ValueTableRowFormValues,
} from './flexFieldRuleFormValues';
import { readTypedValueText } from './typedValueText';

/**
 * Turns one row of a mapping block into its rule, as typed and not yet checked: the shared
 * schema then judges it (flexSourceFormReading.ts). Split from flexConfigFromFormValues.ts
 * by BAJAOVRLAY-53, which added the outer element, lookups, columns and alternatives. Paths,
 * lookup names and headers are trimmed: a space typed around them is never meant. Pure.
 */

/** Builds the rule of one row, or undefined for a row left "Não mapeado". */
export function buildRuleFromFormValues(row: FieldRuleFormValues): unknown {
  const targetField = row.targetField;
  switch (row.sourceKind) {
    case 'none':
      return undefined;
    case 'constant':
      return { targetField, constantValue: readTypedValueText(row.pathOrConstantText) };
    case 'listOrder':
      return { targetField, fromListOrder: true };
    case 'pollMoment':
      return { targetField, fromPollMoment: true };
    case 'alternatives':
      return addTransformOfRow(
        { targetField, firstOf: row.alternatives.map(buildAlternativeFromFormValues) },
        row,
      );
    case 'path':
    case 'parent':
    case 'lookup':
    case 'column':
      return addTransformOfRow(
        { targetField, ...buildReadingFromFormValues(row.sourceKind, row) },
        row,
      );
  }
}

/** Builds one alternative of "Alternativas": a reading, or a fixed value. */
function buildAlternativeFromFormValues(alternative: AlternativeFormValues): unknown {
  if (alternative.sourceKind === 'constant') {
    return { constantValue: readTypedValueText(alternative.pathOrConstantText) };
  }
  return buildReadingFromFormValues(alternative.sourceKind, alternative);
}

/** The key of one reading: `fromPath`, `fromParent`, `fromLookup` or `fromColumn`. */
function buildReadingFromFormValues(
  sourceKind: 'path' | 'parent' | 'lookup' | 'column',
  reading: ReadingFormValues,
): Record<string, unknown> {
  const path = reading.pathOrConstantText.trim();
  switch (sourceKind) {
    case 'path':
      return { fromPath: path };
    case 'parent':
      return { fromParent: path };
    case 'lookup':
      return { fromLookup: { lookup: reading.lookupName.trim(), path } };
    case 'column': {
      // The sub-path is optional: without one the whole cell is read.
      const header = reading.columnHeader.trim();
      const fromColumn = path === '' ? { header } : { header, path };
      return { fromColumn };
    }
  }
}

/** Adds the row's transform to a rule that reads the data, with mapValues' table if chosen. */
function addTransformOfRow(
  rule: Record<string, unknown>,
  row: FieldRuleFormValues,
): Record<string, unknown> {
  if (row.transformId === noTransformId) {
    return rule;
  }
  if (row.transformId !== 'mapValues') {
    return { ...rule, transformId: row.transformId };
  }
  return {
    ...rule,
    transformId: row.transformId,
    transformParameters: buildValueTableParameters(row),
  };
}

/**
 * mapValues' parameters: the plain table when "Senão" is empty, exactly as before
 * BAJAOVRLAY-53, or `{ table, otherwiseValue }` when it holds a value.
 */
function buildValueTableParameters(row: FieldRuleFormValues): unknown {
  const table = buildValueTable(row.valueTableRows);
  if (row.otherwiseValueText.trim() === '') {
    return table;
  }
  return { table, otherwiseValue: readTypedValueText(row.otherwiseValueText) };
}

/**
 * Builds the mapValues table from its rows. A row left wholly empty is skipped (the
 * operator pressed "+ Linha" once too often); a later row with the same source value wins,
 * as it would in a JSON object.
 */
function buildValueTable(rows: ValueTableRowFormValues[]): Record<string, unknown> {
  const table: Record<string, unknown> = {};
  for (const row of rows) {
    const isRowEmpty = row.sourceValue === '' && row.canonicalValueText.trim() === '';
    if (isRowEmpty) {
      continue;
    }
    table[row.sourceValue] = readTypedValueText(row.canonicalValueText);
  }
  return table;
}
