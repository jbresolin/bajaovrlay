import type { FlexShapeMapping } from '@bajaovrlay/shared';

import { writeTypedValueText } from './typedValueText';

/**
 * What a mapping block holds beside its rows (BAJAOVRLAY-53): the list inside each item,
 * the lookups, the table's layout, standings' parts by column, a results table's cells as
 * text (BAJAOVRLAY-83), the refusal flag, the gaps
 * switch and the incomplete-match conditions; and how they are filled from a mapping.
 * Every field is text as an input holds it, and an option left empty is left out of the
 * config, so a mapping that uses none of them reads and exports exactly as before.
 */

/** One lookup's row: a list joined by key, from another request. */
export type LookupFormValues = {
  lookupName: string;
  requestId: string;
  listPath: string;
  keyPath: string;
  entryKeyPath: string;
};

/** Where a table answer keeps its columns, headers and cells; all empty means no table. */
export type TableLayoutFormValues = { columnsPath: string; headerPath: string; cellsPath: string };

/**
 * "Recusar a resposta quando": all empty means no refusal. The value is typed; the known
 * values ("Valores conhecidos", `notOneOf`) are typed and separated by commas, as an
 * incomplete-match condition's are.
 */
export type RefusalFormValues = {
  path: string;
  equalsText: string;
  notOneOfText: string;
  message: string;
};

/**
 * One "Disputa incompleta quando" row: a path on the match and the values that mark it
 * incomplete, typed and separated by commas ("pending, unknown"). Commas rather than one
 * value per line, because a slot type or a status word never holds a comma, and one input
 * per row is the plainer form to read.
 */
export type IncompleteConditionFormValues = { path: string; valuesText: string };

/** Everything a mapping block holds beside its request, list path and rows. */
export type MappingOptionsFormValues = {
  /** "Lista dentro de cada item"; empty for a flat list. */
  nestedEntriesPath: string;
  lookups: LookupFormValues[];
  table: TableLayoutFormValues;
  /** Standings' parts by column: one header per line; empty means none. */
  scorePartHeadersText: string;
  /** The path inside each part's cell ("raw"); empty reads the whole cell. */
  scorePartValuePath: string;
  /**
   * The results table's cells as text (BAJAOVRLAY-83): the paths tried in each cell,
   * separated by commas ("display, raw"); empty means the option is not used.
   */
  cellValuePathsText: string;
  /** The path on each column that leaves it out ("kind"); empty leaves none out. */
  leaveOutColumnsPath: string;
  /** The values at that path that leave a column out, typed, separated by commas. */
  leaveOutColumnsValuesText: string;
  refuseWhen: RefusalFormValues;
  workOutGapsFromLaps: boolean;
  incompleteConditions: IncompleteConditionFormValues[];
};

/** An empty lookup row, reading `requestId`, as "+ Consulta" adds it. */
export function buildEmptyLookupFormValues(requestId: string): LookupFormValues {
  return { lookupName: '', requestId, listPath: '', keyPath: '', entryKeyPath: '' };
}

/** An empty "Disputa incompleta quando" row. */
export function buildEmptyIncompleteConditionFormValues(): IncompleteConditionFormValues {
  return { path: '', valuesText: '' };
}

/** The options of a new block: none used. */
export function buildEmptyMappingOptionsFormValues(): MappingOptionsFormValues {
  return {
    nestedEntriesPath: '',
    lookups: [],
    table: { columnsPath: '', headerPath: '', cellsPath: '' },
    scorePartHeadersText: '',
    scorePartValuePath: '',
    cellValuePathsText: '',
    leaveOutColumnsPath: '',
    leaveOutColumnsValuesText: '',
    refuseWhen: { path: '', equalsText: '', notOneOfText: '', message: '' },
    workOutGapsFromLaps: false,
    incompleteConditions: [],
  };
}

/** The options of a block filled from a mapping of the config. */
export function buildMappingOptionsFormValues(mapping: FlexShapeMapping): MappingOptionsFormValues {
  const options = buildEmptyMappingOptionsFormValues();
  const lookups = (mapping.lookups ?? []).map((lookup) => ({ ...lookup }));
  const table = mapping.table === undefined ? options.table : { ...mapping.table };
  const refuseWhen =
    mapping.refuseWhen === undefined
      ? options.refuseWhen
      : {
          path: mapping.refuseWhen.path,
          // `equals: null` is a comparison too, so the key's presence decides.
          equalsText: Object.hasOwn(mapping.refuseWhen, 'equals')
            ? writeTypedValueText(mapping.refuseWhen.equals ?? null)
            : '',
          notOneOfText: (mapping.refuseWhen.notOneOf ?? []).map(writeTypedValueText).join(', '),
          message: mapping.refuseWhen.message,
        };
  const incompleteConditions = (mapping.entryIsIncompleteWhen ?? []).map((condition) => ({
    path: condition.path,
    valuesText: condition.isOneOf.map(writeTypedValueText).join(', '),
  }));
  return {
    nestedEntriesPath: mapping.nestedEntriesPath ?? '',
    lookups,
    table,
    scorePartHeadersText: (mapping.scorePartsFromColumns?.headers ?? []).join('\n'),
    scorePartValuePath: mapping.scorePartsFromColumns?.valuePath ?? '',
    cellValuePathsText: (mapping.cellsAsTextFromColumns?.valuePaths ?? []).join(', '),
    leaveOutColumnsPath: mapping.cellsAsTextFromColumns?.leaveOutColumnsWhen?.path ?? '',
    leaveOutColumnsValuesText: (mapping.cellsAsTextFromColumns?.leaveOutColumnsWhen?.isOneOf ?? [])
      .map(writeTypedValueText)
      .join(', '),
    refuseWhen,
    workOutGapsFromLaps: mapping.workOutGapsFromLaps === true,
    incompleteConditions,
  };
}
