import type {
  FlexAlternativeSource,
  FlexFieldRule,
  JsonValue,
  MappableFieldLevel,
} from '@bajaovrlay/shared';

import { writeTypedValueText } from './typedValueText';

/**
 * What one canonical field's row of the flex form holds, and how it is filled from a rule
 * of a stored or imported config. Every field is text as an input holds it;
 * flexConfigFromFormValues.ts turns a row back into a rule. Split from
 * flexSourceFormValues.ts by BAJAOVRLAY-53, which added the outer element, lookups,
 * columns and alternatives.
 */

/**
 * Where a field's value comes from; "none" leaves the field out of the config. "parent",
 * "lookup", "column" and "alternatives" are the readings of BAJAOVRLAY-53.
 */
export type FieldRuleSourceKind =
  | 'none'
  | 'path'
  | 'constant'
  | 'listOrder'
  | 'pollMoment'
  | 'parent'
  | 'lookup'
  | 'column'
  | 'alternatives';

/** Where one alternative of "Alternativas" reads; a fixed value only as the last one. */
export type AlternativeSourceKind = 'path' | 'parent' | 'lookup' | 'column' | 'constant';

/** The "Sem transformação" choice of the transform dropdown. */
export const noTransformId = 'none';

/** One row of a mapValues table: the source's value and what it becomes, as typed. */
export type ValueTableRowFormValues = { sourceValue: string; canonicalValueText: string };

/**
 * What a reading holds, a rule's or an alternative's: the path (for "Caminho", "Item de
 * fora", "Consulta", or the sub-path of "Coluna") or the fixed value, the lookup's name
 * and the column's header. A field unused by the kind is kept empty.
 */
export type ReadingFormValues = {
  pathOrConstantText: string;
  lookupName: string;
  columnHeader: string;
};

/** One alternative of "Alternativas", in its order. */
export type AlternativeFormValues = ReadingFormValues & { sourceKind: AlternativeSourceKind };

/** One canonical field's row of a mapping block. */
export type FieldRuleFormValues = ReadingFormValues & {
  targetField: string;
  level: MappableFieldLevel;
  sourceKind: FieldRuleSourceKind;
  /** The alternatives of "Alternativas", in order; unused by the other kinds. */
  alternatives: AlternativeFormValues[];
  /** A registry id, or noTransformId. */
  transformId: string;
  /** The table of mapValues; unused by the other transforms. */
  valueTableRows: ValueTableRowFormValues[];
  /** mapValues' "Senão", typed; empty means a plain table with no otherwise value. */
  otherwiseValueText: string;
  /**
   * The rule's place in its list (fields or entryFields) of the config the form was
   * filled from, or null for a row that had no rule there. Not shown: it keeps the rules
   * in the order they were written, so "Editar" with only a rename sends no config and
   * "Exportar" right after "Importar" gives back the same text.
   */
  placeInConfig: number | null;
};

/** An empty value table row. */
export function buildEmptyValueTableRowFormValues(): ValueTableRowFormValues {
  return { sourceValue: '', canonicalValueText: '' };
}

/** An empty alternative, read by path, as "+ Alternativa" adds it. */
export function buildEmptyAlternativeFormValues(): AlternativeFormValues {
  return { sourceKind: 'path', pathOrConstantText: '', lookupName: '', columnHeader: '' };
}

/** One field's row from its rule, or a "Não mapeado" row when no rule names the field. */
export function buildFieldRuleFormValues(
  targetField: string,
  level: MappableFieldLevel,
  rule: FlexFieldRule | undefined,
): FieldRuleFormValues {
  const emptyRow: FieldRuleFormValues = {
    targetField,
    level,
    sourceKind: 'none',
    pathOrConstantText: '',
    lookupName: '',
    columnHeader: '',
    alternatives: [],
    transformId: noTransformId,
    valueTableRows: [],
    otherwiseValueText: '',
    placeInConfig: null,
  };
  if (rule === undefined) {
    return emptyRow;
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
  if (rule.fromPollMoment !== undefined) {
    return { ...emptyRow, sourceKind: 'pollMoment' };
  }

  // Every other kind reads the data, so it may carry a transform (and mapValues' table).
  const rowWithTransform: FieldRuleFormValues = {
    ...emptyRow,
    transformId: rule.transformId ?? noTransformId,
    ...buildValueTableFormValues(rule.transformId, rule.transformParameters),
  };
  if (rule.firstOf !== undefined) {
    const alternatives = rule.firstOf.map(buildAlternativeFormValues);
    return { ...rowWithTransform, sourceKind: 'alternatives', alternatives };
  }
  const reading = buildAlternativeFormValues(rule);
  return { ...rowWithTransform, ...reading };
}

/**
 * One reading, of an alternative or of a rule, as the form holds it: its kind and its
 * path, lookup name or column header. A rule's own reading is never a fixed value here,
 * since buildFieldRuleFormValues handles that first.
 */
function buildAlternativeFormValues(source: FlexAlternativeSource): AlternativeFormValues {
  const emptyReading = { pathOrConstantText: '', lookupName: '', columnHeader: '' };
  if (source.fromParent !== undefined) {
    return { ...emptyReading, sourceKind: 'parent', pathOrConstantText: source.fromParent };
  }
  if (source.fromLookup !== undefined) {
    return {
      ...emptyReading,
      sourceKind: 'lookup',
      lookupName: source.fromLookup.lookup,
      pathOrConstantText: source.fromLookup.path,
    };
  }
  if (source.fromColumn !== undefined) {
    return {
      ...emptyReading,
      sourceKind: 'column',
      columnHeader: source.fromColumn.header,
      pathOrConstantText: source.fromColumn.path ?? '',
    };
  }
  if (source.constantValue !== undefined) {
    return {
      ...emptyReading,
      sourceKind: 'constant',
      pathOrConstantText: writeTypedValueText(source.constantValue),
    };
  }
  return { ...emptyReading, sourceKind: 'path', pathOrConstantText: source.fromPath ?? '' };
}

/**
 * The rows and "Senão" of a mapValues table, in the config's order, from either form of
 * its parameters: the plain table, or `{ table, otherwiseValue }` (BAJAOVRLAY-53). None
 * for any other transform.
 */
function buildValueTableFormValues(
  transformId: string | undefined,
  transformParameters: unknown,
): { valueTableRows: ValueTableRowFormValues[]; otherwiseValueText: string } {
  const isAnObject = typeof transformParameters === 'object' && transformParameters !== null;
  if (transformId !== 'mapValues' || !isAnObject) {
    return { valueTableRows: [], otherwiseValueText: '' };
  }
  const parameters = transformParameters as Record<string, JsonValue>;
  const hasAnOtherwiseValue = Object.hasOwn(parameters, 'otherwiseValue');
  const table = hasAnOtherwiseValue ? (parameters.table as Record<string, JsonValue>) : parameters;
  const valueTableRows = Object.entries(table).map(([sourceValue, canonicalValue]) => ({
    sourceValue,
    canonicalValueText: writeTypedValueText(canonicalValue),
  }));
  const otherwiseValue = parameters.otherwiseValue;
  const otherwiseValueText =
    hasAnOtherwiseValue && otherwiseValue !== undefined ? writeTypedValueText(otherwiseValue) : '';
  return { valueTableRows, otherwiseValueText };
}
