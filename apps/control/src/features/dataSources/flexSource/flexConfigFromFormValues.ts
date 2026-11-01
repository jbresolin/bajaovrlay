import { readNumberFromFieldText } from '../numberFieldText';
import { buildMappingOptionsFromFormValues } from './flexMappingOptionsFromFormValues';
import { buildRuleFromFormValues } from './flexRuleFromFormValues';
import type {
  FlexConfigFormValues,
  FlexMappingFormValues,
  FlexRequestFormValues,
  NameAndValueFormValues,
} from './flexSourceFormValues';

const millisecondsPerSecond = 1_000;

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
 * address are trimmed: a space typed around them is never meant. "Atualizar a cada (s)"
 * becomes `refreshEveryMs` when filled (seconds to whole ms; text that is no number stays
 * NaN, which the schema refuses with its range), and no key at all when empty.
 */
export function buildRequestFromFormValues(requestValues: FlexRequestFormValues) {
  const request = {
    requestId: requestValues.requestId.trim(),
    url: requestValues.url.trim(),
    headers: requestValues.headers.map(buildNameAndValue),
    queryParameters: requestValues.queryParameters.map(buildNameAndValue),
  };
  if (requestValues.refreshEverySeconds.trim() === '') {
    return request;
  }
  const refreshEverySeconds = readNumberFromFieldText(requestValues.refreshEverySeconds);
  return { ...request, refreshEveryMs: Math.round(refreshEverySeconds * millisecondsPerSecond) };
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

/** A rule built from one row, with the row it came from and its place in the config. */
type RuleOfRow = { rule: unknown; rowIndex: number; placeInConfig: number | null };

/**
 * Builds one shape's mapping, and the form row of each of its rules. The rules keep the
 * order of the config the form was filled from; a rule mapped since comes after them.
 */
function buildMappingFromFormValues(mappingValues: FlexMappingFormValues): {
  mapping: unknown;
  formRows: { fields: number[]; entryFields: number[] };
} {
  const sessionLevelRules: RuleOfRow[] = [];
  const entryLevelRules: RuleOfRow[] = [];
  mappingValues.fieldRules.forEach((row, rowIndex) => {
    const rule = buildRuleFromFormValues(row);
    if (rule === undefined) {
      return;
    }
    const ruleOfRow = { rule, rowIndex, placeInConfig: row.placeInConfig };
    if (row.level === 'entry') {
      entryLevelRules.push(ruleOfRow);
    } else {
      sessionLevelRules.push(ruleOfRow);
    }
  });
  const fieldsInOrder = putRulesInConfigOrder(sessionLevelRules);
  const entryFieldsInOrder = putRulesInConfigOrder(entryLevelRules);
  const fields = fieldsInOrder.map((ruleOfRow) => ruleOfRow.rule);
  const entryFields = entryFieldsInOrder.map((ruleOfRow) => ruleOfRow.rule);
  const formRows = {
    fields: fieldsInOrder.map((ruleOfRow) => ruleOfRow.rowIndex),
    entryFields: entryFieldsInOrder.map((ruleOfRow) => ruleOfRow.rowIndex),
  };

  const requestId = mappingValues.requestId;
  const shapeKey = mappingValues.shapeKey;
  const options = buildMappingOptionsFromFormValues(shapeKey, mappingValues);
  if (shapeKey === 'session') {
    return { mapping: { shapeKey, requestId, ...options, fields }, formRows };
  }
  // An empty "Caminho da lista" is left out, so the schema says the list needs its path.
  const entriesPath = mappingValues.entriesPath.trim();
  if (entriesPath === '') {
    return { mapping: { shapeKey, requestId, ...options, fields, entryFields }, formRows };
  }
  const mapping = { shapeKey, requestId, entriesPath, ...options, fields, entryFields };
  return { mapping, formRows };
}

/**
 * Sorts one level's rules into the config's order: rules that were in the config by their
 * place there, then rules with no place (mapped in the form) in the form's row order.
 */
function putRulesInConfigOrder(rulesOfLevel: RuleOfRow[]): RuleOfRow[] {
  const rulesFromTheConfig = rulesOfLevel.filter((ruleOfRow) => ruleOfRow.placeInConfig !== null);
  const rulesMappedInTheForm = rulesOfLevel.filter((ruleOfRow) => ruleOfRow.placeInConfig === null);
  const sortedRulesFromTheConfig = [...rulesFromTheConfig].sort(
    (first, second) => (first.placeInConfig ?? 0) - (second.placeInConfig ?? 0),
  );
  return [...sortedRulesFromTheConfig, ...rulesMappedInTheForm];
}
