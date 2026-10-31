import { z } from 'zod';

import { ptBRTransforms } from './ptBRTransforms.js';
import { quoteValueForReason } from './quoteValueForReason.js';
import {
  giveTransformedValue,
  type JsonValue,
  type MappingTransform,
  refuseTransformValue,
  type TransformResult,
} from './transform.js';

/**
 * The table itself, from the source's value (a JSON key, so always text) to any JSON
 * value, with at least one row: `{ "BOX": "inPit", "PISTA": "running" }`,
 * `{ "RUN": true, "STOP": false }`, `{ "1": "green", "4": "red" }`.
 * z.json() is fine here although the OpenAPI generator cannot describe it (see
 * fieldValue.ts): this schema is only run by checkTransformParameters, never put inside
 * a schema that is published.
 */
const MapValuesTableSchema = z
  .record(z.string(), z.json(), {
    error: ptBRTransforms.parameterReasons.mapValuesTableMustBeObject,
  })
  .refine((table) => Object.keys(table).length > 0, {
    error: ptBRTransforms.parameterReasons.mapValuesTableIsEmpty,
  });

/**
 * The second form (BAJAOVRLAY-53): the table under `table`, and `otherwiseValue`, what a
 * value the table does not list becomes, for a source whose word lists may grow.
 */
const MapValuesTableWithOtherwiseSchema = z.strictObject({
  table: MapValuesTableSchema,
  otherwiseValue: z.json(),
});

/**
 * Says whether second-form parameters hold exactly the keys "table" and "otherwiseValue",
 * so a misspelt or missing "table" gets the sentence showing the form, not the table's own.
 */
function hasExactlyTheKeysOfTheSecondForm(parameters: object): boolean {
  const keys = Object.keys(parameters).sort();
  return keys.length === 2 && keys[0] === 'otherwiseValue' && keys[1] === 'table';
}

/**
 * Says whether parameters are in the second form: an object with the key "otherwiseValue".
 * That key, not "table", decides, so a misspelt "tabela" beside it is refused instead of
 * read as a plain table. What could go wrong: a source whose own word is "otherwiseValue"
 * cannot be listed in a plain table; no source has such a word.
 */
function isTableWithOtherwiseValue(parameters: unknown): parameters is object {
  const isAnObject =
    typeof parameters === 'object' && parameters !== null && !Array.isArray(parameters);
  return isAnObject && Object.hasOwn(parameters, 'otherwiseValue');
}

/**
 * The parameters of mapValues, in either form: the plain table, or `{ table,
 * otherwiseValue }`. The form is chosen first (isTableWithOtherwiseValue), then that one
 * schema runs, so a refusal names what is wrong with that form and not with both.
 */
export const MapValuesParametersSchema = z.unknown().superRefine((parameters, context) => {
  const isSecondFormWithWrongKeys =
    isTableWithOtherwiseValue(parameters) &&
    !hasExactlyTheKeysOfTheSecondForm(parameters);
  if (isSecondFormWithWrongKeys) {
    context.addIssue({
      code: 'custom',
      message: ptBRTransforms.parameterReasons.mapValuesWithOtherwiseNeedsTable,
    });
    return;
  }
  const schemaOfTheForm = isTableWithOtherwiseValue(parameters)
    ? MapValuesTableWithOtherwiseSchema
    : MapValuesTableSchema;
  const parsing = schemaOfTheForm.safeParse(parameters);
  if (parsing.success) {
    return;
  }
  for (const issue of parsing.error.issues) {
    context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
});

/** The table mapValues reads, and the value for anything it does not list, if any. */
export type MapValuesParameters = {
  table: Record<string, JsonValue>;
  otherwiseValue: JsonValue | undefined;
};

/** Reads checked or unchecked parameters into the table and its otherwise value. */
function readMapValuesParameters(parameters: unknown): MapValuesParameters | undefined {
  if (isTableWithOtherwiseValue(parameters)) {
    const parsing = MapValuesTableWithOtherwiseSchema.safeParse(parameters);
    if (!parsing.success) {
      return undefined;
    }
    return { table: parsing.data.table, otherwiseValue: parsing.data.otherwiseValue };
  }
  const parsing = MapValuesTableSchema.safeParse(parameters);
  if (!parsing.success) {
    return undefined;
  }
  return { table: parsing.data, otherwiseValue: undefined };
}

/**
 * The key a source's value is looked up by: text as it is, and a number or boolean by
 * its JSON text, so 1 is looked up as "1" and true as "true". Anything else (null, a
 * list, an object) has no key.
 */
function findTableKeyOfValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  return undefined;
}

/**
 * Looks the source's value up in the table and gives the table's value. A value missing
 * from the table takes the otherwise value when the rule gives one; without one it is
 * refused with a reason naming it, never passed through: a status code the table does not
 * know is exactly what the operator must see before it reaches the air.
 */
function lookUpValueInTable(value: unknown, parameters: unknown): TransformResult {
  // The config schema already checked the table; this is the last guard, because apply
  // must never throw, even when called with parameters nobody checked.
  const readParameters = readMapValuesParameters(parameters);
  if (readParameters === undefined) {
    const transformLabel = ptBRTransforms.transforms.mapValues.label;
    return refuseTransformValue(ptBRTransforms.parameterReasons.invalidParameters(transformLabel));
  }
  const { table, otherwiseValue } = readParameters;

  const quotedValue = quoteValueForReason(value);
  const tableKey = findTableKeyOfValue(value);
  if (tableKey === undefined) {
    return refuseTransformValue(ptBRTransforms.reasons.notATableKey(quotedValue));
  }

  // Object.hasOwn, not `in`: a source sending "constructor" must not find the object's
  // own inherited members.
  const tableValue = Object.hasOwn(table, tableKey) ? table[tableKey] : undefined;
  if (tableValue === undefined && otherwiseValue !== undefined) {
    return giveTransformedValue(otherwiseValue);
  }
  if (tableValue === undefined) {
    return refuseTransformValue(ptBRTransforms.reasons.valueNotInTable(quotedValue));
  }
  return giveTransformedValue(tableValue);
}

/** `{ "BOX": "inPit" }` turns "BOX" into "inPit"; a value not in the table is refused. */
export const mapValuesTransform: MappingTransform = {
  id: 'mapValues',
  family: 'mapping',
  label: ptBRTransforms.transforms.mapValues.label,
  description: ptBRTransforms.transforms.mapValues.description,
  parametersSchema: MapValuesParametersSchema,
  apply: (value, parameters) => lookUpValueInTable(value, parameters),
};
