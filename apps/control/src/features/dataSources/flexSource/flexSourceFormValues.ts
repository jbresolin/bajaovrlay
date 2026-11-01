import {
  type DataShapeKey,
  type FlexShapeMapping,
  type HttpJsonConfig,
  type HttpJsonDataSource,
  type HttpJsonHeader,
  listMappableFieldsOfShape,
} from '@bajaovrlay/shared';

import { writeNumberAsFieldText } from '../numberFieldText';
import { defaultPollIntervalMs, type LabelAndPollIntervalFormValues } from '../sourceFormReading';
import { buildFieldRuleFormValues, type FieldRuleFormValues } from './flexFieldRuleFormValues';
import {
  buildEmptyMappingOptionsFormValues,
  buildMappingOptionsFormValues,
  type MappingOptionsFormValues,
} from './flexMappingOptionsFormValues';

/**
 * What the flex HTTP/JSON form holds, and how it is filled: from a stored source
 * ("Editar"), from an imported config, or empty ("+ Fonte"). Every field is text as an
 * input holds it; flexSourceFormReading.ts turns it into a config and checks it with the
 * shared HttpJsonConfigSchema.
 */

/**
 * The shapes the form offers, every canonical shape (brackets too since BAJAOVRLAY-25), in
 * the order of its "+ Sessão / + Posições / + Pontuação / + Incidentes / + Chaves".
 */
export const mappableShapeKeys: readonly DataShapeKey[] = [
  'session',
  'positions',
  'standings',
  'incidents',
  'brackets',
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
  /** "Atualizar a cada (s)": seconds as typed; empty fetches the request at every poll. */
  refreshEverySeconds: string;
};

/**
 * One mapping block: one shape, the request it reads, a row per mappable field, and the
 * options of BAJAOVRLAY-53 (flexMappingOptionsFormValues.ts).
 */
export type FlexMappingFormValues = MappingOptionsFormValues & {
  shapeKey: DataShapeKey;
  requestId: string;
  /** "Caminho da lista", for every list shape; unused by the session. */
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
  return { requestId: '', url: '', headers: [], queryParameters: [], refreshEverySeconds: '' };
}

/** An empty header or parameter row: a typed value. */
export function buildEmptyNameAndValueFormValues(): NameAndValueFormValues {
  return { name: '', valueKind: 'value', valueText: '' };
}

/**
 * A new mapping block for a shape: one "Não mapeado" row per mappable field, in the
 * order listMappableFieldsOfShape gives (required first), reading `requestId`.
 */
export function buildEmptyMappingFormValues(
  shapeKey: DataShapeKey,
  requestId: string,
): FlexMappingFormValues {
  const fieldRules = listMappableFieldsOfShape(shapeKey).map((field) =>
    buildFieldRuleFormValues(field.targetField, field.level, undefined),
  );
  return {
    shapeKey,
    requestId,
    entriesPath: '',
    fieldRules,
    ...buildEmptyMappingOptionsFormValues(),
  };
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
    refreshEverySeconds:
      request.refreshEveryMs === undefined
        ? ''
        : writeNumberAsFieldText(request.refreshEveryMs / millisecondsPerSecond),
  }));
  const mappings = config.mappings.map(buildMappingFormValues);
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
  const shapeKey = mapping.shapeKey;
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
    ...buildMappingOptionsFormValues(mapping),
  };
}
