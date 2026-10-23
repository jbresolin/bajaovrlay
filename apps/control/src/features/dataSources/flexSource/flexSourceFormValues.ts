import {
  type DataShapeKey,
  type FlexFieldRule,
  type FlexShapeMapping,
  type HttpJsonConfig,
  type HttpJsonDataSource,
  type HttpJsonHeader,
  type JsonValue,
  listMappableFieldsOfShape,
  type MappableFieldLevel,
} from '@bajaovrlay/shared';

import { writeNumberAsFieldText } from '../numberFieldText';
import { defaultPollIntervalMs, type LabelAndPollIntervalFormValues } from '../sourceFormReading';
import { writeTypedValueText } from './typedValueText';

/**
 * What the flex HTTP/JSON form holds, and how it is filled: from a stored source
 * ("Editar"), from an imported config, or empty ("+ Fonte"). Every field is text as an
 * input holds it; flexSourceFormReading.ts turns it into a config and checks it with the
 * shared HttpJsonConfigSchema.
 */

/** The shapes the form can map. Brackets are a draft shape whose mapping is not built. */
export type MappableShapeKey = Exclude<DataShapeKey, 'brackets'>;

/** The shapes the form offers, in the order of its "+ Sessão / + Posições / + Pontuação / + Incidentes". */
export const mappableShapeKeys: readonly MappableShapeKey[] = [
  'session',
  'positions',
  'standings',
  'incidents',
];

/** Whether a header or parameter's value is typed here or read from a server variable. */
export type ValueKind = 'value' | 'environment';

/** One header or query parameter row. */
export type NameAndValueFormValues = {
  name: string;
  valueKind: ValueKind;
  /** The value itself, or the BAJAOVRLAY_SOURCE_ variable's name, by valueKind. */
  valueText: string;
};

/** One request block. */
export type FlexRequestFormValues = {
  requestId: string;
  url: string;
  headers: NameAndValueFormValues[];
  queryParameters: NameAndValueFormValues[];
};

/** Where a field's value comes from; "none" leaves the field out of the config. */
export type FieldRuleSourceKind = 'none' | 'path' | 'constant' | 'listOrder' | 'pollMoment';

/** The "Sem transformação" choice of the transform dropdown. */
export const noTransformId = 'none';

/** One row of a mapValues table: the source's value and what it becomes, as typed. */
export type ValueTableRowFormValues = { sourceValue: string; canonicalValueText: string };

/** One canonical field's row of a mapping block. */
export type FieldRuleFormValues = {
  targetField: string;
  level: MappableFieldLevel;
  sourceKind: FieldRuleSourceKind;
  /** The path for "Caminho", the value for "Valor fixo"; unused by the other two. */
  pathOrConstantText: string;
  /** A registry id, or noTransformId. */
  transformId: string;
  /** The table of mapValues; unused by the other transforms. */
  valueTableRows: ValueTableRowFormValues[];
  /**
   * The rule's place in its list (fields or entryFields) of the config the form was
   * filled from, or null for a row that had no rule there. Not shown: it keeps the rules
   * in the order they were written, so "Editar" with only a rename sends no config and
   * "Exportar" right after "Importar" gives back the same text.
   */
  placeInConfig: number | null;
};

/** One mapping block: one shape, the request it reads, and a row per mappable field. */
export type FlexMappingFormValues = {
  shapeKey: MappableShapeKey;
  requestId: string;
  /** "Caminho da lista", for positions and standings; unused by the session. */
  entriesPath: string;
  fieldRules: FieldRuleFormValues[];
};

/** The requests and mappings: the part of the form a config import fills. */
export type FlexConfigFormValues = {
  requests: FlexRequestFormValues[];
  mappings: FlexMappingFormValues[];
};

/** Everything the flex form holds. */
export type FlexSourceFormValues = LabelAndPollIntervalFormValues & FlexConfigFormValues;

const millisecondsPerSecond = 1_000;

/** An empty request block, as "+ Requisição" adds it. */
export function buildEmptyRequestFormValues(): FlexRequestFormValues {
  return { requestId: '', url: '', headers: [], queryParameters: [] };
}

/** An empty header or parameter row: a typed value. */
export function buildEmptyNameAndValueFormValues(): NameAndValueFormValues {
  return { name: '', valueKind: 'value', valueText: '' };
}

/** An empty value table row. */
export function buildEmptyValueTableRowFormValues(): ValueTableRowFormValues {
  return { sourceValue: '', canonicalValueText: '' };
}

/**
 * A new mapping block for a shape: one "Não mapeado" row per mappable field, in the
 * order listMappableFieldsOfShape gives (required first), reading `requestId`.
 */
export function buildEmptyMappingFormValues(
  shapeKey: MappableShapeKey,
  requestId: string,
): FlexMappingFormValues {
  const fieldRules = listMappableFieldsOfShape(shapeKey).map((field) =>
    buildFieldRuleFormValues(field.targetField, field.level, undefined),
  );
  return { shapeKey, requestId, entriesPath: '', fieldRules };
}

/** Fills the whole form from a stored flex source, or empty with one request for a new one. */
export function buildFlexSourceFormValues(source: HttpJsonDataSource | null): FlexSourceFormValues {
  const pollIntervalMs = source?.pollIntervalMs ?? defaultPollIntervalMs;
  const configFormValues =
    source === null
      ? { requests: [buildEmptyRequestFormValues()], mappings: [] }
      : buildFlexConfigFormValues(source.config);
  return {
    label: source?.label ?? '',
    pollIntervalSeconds: writeNumberAsFieldText(pollIntervalMs / millisecondsPerSecond),
    ...configFormValues,
  };
}

/** Fills the requests and mappings from a config (stored, or imported and checked). */
export function buildFlexConfigFormValues(config: HttpJsonConfig): FlexConfigFormValues {
  const requests = config.requests.map((request) => ({
    requestId: request.requestId,
    url: request.url,
    headers: request.headers.map(buildNameAndValueFormValues),
    queryParameters: request.queryParameters.map(buildNameAndValueFormValues),
  }));
  const mappings = config.mappings
    .filter((mapping) => mapping.shapeKey !== 'brackets')
    .map(buildMappingFormValues);
  return { requests, mappings };
}

/** A header or parameter row from the config: a typed value or a variable's name. */
function buildNameAndValueFormValues(nameAndValue: HttpJsonHeader): NameAndValueFormValues {
  if (nameAndValue.valueFromEnvironment !== undefined) {
    return {
      name: nameAndValue.name,
      valueKind: 'environment',
      valueText: nameAndValue.valueFromEnvironment,
    };
  }
  return { name: nameAndValue.name, valueKind: 'value', valueText: nameAndValue.value ?? '' };
}

/**
 * A mapping block from the config: every mappable field's row, in the form's order,
 * filled where a rule names it and noting that rule's place in the config.
 */
function buildMappingFormValues(mapping: FlexShapeMapping): FlexMappingFormValues {
  // The schema refused brackets before the config got here; filtered out above too.
  const shapeKey = mapping.shapeKey as MappableShapeKey;
  const fieldRules = listMappableFieldsOfShape(shapeKey).map((field) => {
    const rulesOfLevel = field.level === 'entry' ? (mapping.entryFields ?? []) : mapping.fields;
    const placeOfRule = rulesOfLevel.findIndex(
      (candidate) => candidate.targetField === field.targetField,
    );
    if (placeOfRule === -1) {
      return buildFieldRuleFormValues(field.targetField, field.level, undefined);
    }
    const row = buildFieldRuleFormValues(field.targetField, field.level, rulesOfLevel[placeOfRule]);
    return { ...row, placeInConfig: placeOfRule };
  });
  return {
    shapeKey,
    requestId: mapping.requestId,
    entriesPath: mapping.entriesPath ?? '',
    fieldRules,
  };
}

/** One field's row from its rule, or a "Não mapeado" row when no rule names the field. */
function buildFieldRuleFormValues(
  targetField: string,
  level: MappableFieldLevel,
  rule: FlexFieldRule | undefined,
): FieldRuleFormValues {
  const emptyRow: FieldRuleFormValues = {
    targetField,
    level,
    sourceKind: 'none',
    pathOrConstantText: '',
    transformId: noTransformId,
    valueTableRows: [],
    placeInConfig: null,
  };
  if (rule === undefined) {
    return emptyRow;
  }
  if (rule.fromPath !== undefined) {
    return {
      ...emptyRow,
      sourceKind: 'path',
      pathOrConstantText: rule.fromPath,
      transformId: rule.transformId ?? noTransformId,
      valueTableRows: buildValueTableRows(rule.transformId, rule.transformParameters),
    };
  }
  if (rule.constantValue !== undefined) {
    return {
      ...emptyRow,
      sourceKind: 'constant',
      pathOrConstantText: writeTypedValueText(rule.constantValue),
    };
  }
  if (rule.fromListOrder !== undefined) {
    return { ...emptyRow, sourceKind: 'listOrder' };
  }
  return { ...emptyRow, sourceKind: 'pollMoment' };
}

/** The rows of a mapValues table, in the config's order; none for any other transform. */
function buildValueTableRows(
  transformId: string | undefined,
  transformParameters: unknown,
): ValueTableRowFormValues[] {
  const isAValueTable =
    transformId === 'mapValues' &&
    typeof transformParameters === 'object' &&
    transformParameters !== null;
  if (!isAValueTable) {
    return [];
  }
  const tableRows = Object.entries(transformParameters as Record<string, JsonValue>);
  return tableRows.map(([sourceValue, canonicalValue]) => ({
    sourceValue,
    canonicalValueText: writeTypedValueText(canonicalValue),
  }));
}
