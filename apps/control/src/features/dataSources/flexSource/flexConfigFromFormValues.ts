import {
  type FieldRuleFormValues,
  type FlexConfigFormValues,
  type FlexMappingFormValues,
  type FlexRequestFormValues,
  type NameAndValueFormValues,
  noTransformId,
  type ValueTableRowFormValues,
} from './flexSourceFormValues';
import { readTypedValueText } from './typedValueText';

/**
 * Turns the requests and mappings the flex form holds into a config, as typed and not yet
 * checked: flexSourceFormReading.ts runs the shared HttpJsonConfigSchema on it. A row left
 * "Não mapeado" gives no rule. Pure.
 */

/**
 * Which form row each rule of the config came from, per mapping: `fields[2]` is the
 * row index (in the mapping's fieldRules) of the config's third top-level rule. The
 * schema names a refused rule by its place in the config; this finds its row in the form.
 */
export type FormRowsOfRules = { fields: number[]; entryFields: number[] }[];

/** The config built from the form, and where each of its rules came from. */
export type FlexConfigAsTyped = {
  config: { requests: unknown[]; mappings: unknown[] };
  formRowsOfRules: FormRowsOfRules;
};

/** Builds the config from the form's requests and mappings. */
export function buildFlexConfigFromFormValues(values: FlexConfigFormValues): FlexConfigAsTyped {
  const requests = values.requests.map(buildRequestFromFormValues);
  const mappings: unknown[] = [];
  const formRowsOfRules: FormRowsOfRules = [];
  for (const mappingValues of values.mappings) {
    const { mapping, formRows } = buildMappingFromFormValues(mappingValues);
    mappings.push(mapping);
    formRowsOfRules.push(formRows);
  }
  return { config: { requests, mappings }, formRowsOfRules };
}

/**
 * Builds one request from its block, as "Buscar da fonte" sends it too. The name and the
 * address are trimmed: a space typed around them is never meant.
 */
export function buildRequestFromFormValues(requestValues: FlexRequestFormValues) {
  return {
    requestId: requestValues.requestId.trim(),
    url: requestValues.url.trim(),
    headers: requestValues.headers.map(buildNameAndValue),
    queryParameters: requestValues.queryParameters.map(buildNameAndValue),
  };
}

/**
 * Builds a header or parameter: `value` exactly as typed (a space may belong to it), or
 * `valueFromEnvironment` with the variable's name trimmed.
 */
function buildNameAndValue(row: NameAndValueFormValues) {
  const name = row.name.trim();
  if (row.valueKind === 'environment') {
    return { name, valueFromEnvironment: row.valueText.trim() };
  }
  return { name, value: row.valueText };
}

/** Builds one shape's mapping, and the form row of each of its rules. */
function buildMappingFromFormValues(mappingValues: FlexMappingFormValues): {
  mapping: unknown;
  formRows: { fields: number[]; entryFields: number[] };
} {
  const fields: unknown[] = [];
  const entryFields: unknown[] = [];
  const formRows = { fields: [] as number[], entryFields: [] as number[] };

  mappingValues.fieldRules.forEach((row, rowIndex) => {
    const rule = buildRuleFromFormValues(row);
    if (rule === undefined) {
      return;
    }
    if (row.level === 'entry') {
      entryFields.push(rule);
      formRows.entryFields.push(rowIndex);
    } else {
      fields.push(rule);
      formRows.fields.push(rowIndex);
    }
  });

  const requestId = mappingValues.requestId;
  if (mappingValues.shapeKey === 'session') {
    return { mapping: { shapeKey: 'session', requestId, fields }, formRows };
  }
  // An empty "Caminho da lista" is left out, so the schema says the list needs its path.
  const entriesPath = mappingValues.entriesPath.trim();
  if (entriesPath === '') {
    return {
      mapping: { shapeKey: mappingValues.shapeKey, requestId, fields, entryFields },
      formRows,
    };
  }
  const mapping = { shapeKey: mappingValues.shapeKey, requestId, entriesPath, fields, entryFields };
  return { mapping, formRows };
}

/** Builds the rule of one row, or undefined for a row left "Não mapeado". */
function buildRuleFromFormValues(row: FieldRuleFormValues): unknown {
  const targetField = row.targetField;
  switch (row.sourceKind) {
    case 'none':
      return undefined;
    case 'path':
      return buildPathRule(row);
    case 'constant':
      return { targetField, constantValue: readTypedValueText(row.pathOrConstantText) };
    case 'listOrder':
      return { targetField, fromListOrder: true };
    case 'pollMoment':
      return { targetField, fromPollMoment: true };
  }
}

/** Builds a "Caminho" rule, with its transform and, for mapValues, the table. */
function buildPathRule(row: FieldRuleFormValues) {
  const fromPath = row.pathOrConstantText.trim();
  if (row.transformId === noTransformId) {
    return { targetField: row.targetField, fromPath };
  }
  if (row.transformId !== 'mapValues') {
    return { targetField: row.targetField, fromPath, transformId: row.transformId };
  }
  return {
    targetField: row.targetField,
    fromPath,
    transformId: row.transformId,
    transformParameters: buildValueTable(row.valueTableRows),
  };
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
