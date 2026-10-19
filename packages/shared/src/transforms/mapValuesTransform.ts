import { z } from 'zod';

import { ptBRTransforms } from './ptBRTransforms.js';
import { quoteValueForReason } from './quoteValueForReason.js';
import {
  giveTransformedValue,
  type JsonValue,
  refuseTransformValue,
  type Transform,
  type TransformResult,
} from './transform.js';

/**
 * The parameters of mapValues: the table itself, from the source's value (a JSON key,
 * so always text) to any JSON value, with at least one row.
 * `{ "BOX": "inPit", "PISTA": "running" }`, `{ "RUN": true, "STOP": false }`,
 * `{ "1": "green", "4": "red" }`.
 * z.json() is fine here although the OpenAPI generator cannot describe it (see
 * fieldValue.ts): this schema is only run by checkTransformParameters, never put inside
 * a schema that is published.
 */
export const MapValuesParametersSchema = z
  .record(z.string(), z.json(), {
    error: ptBRTransforms.parameterReasons.mapValuesTableMustBeObject,
  })
  .refine((table) => Object.keys(table).length > 0, {
    error: ptBRTransforms.parameterReasons.mapValuesTableIsEmpty,
  });

/** The table mapValues reads, after its schema passed. */
export type MapValuesParameters = Record<string, JsonValue>;

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
 * from the table is refused with a reason naming it, never passed through: a status code
 * the table does not know is exactly what the operator must see before it reaches the air.
 */
function lookUpValueInTable(value: unknown, parameters: unknown): TransformResult {
  // The config schema already checked the table; this is the last guard, because apply
  // must never throw, even when called with parameters nobody checked.
  const parsedParameters = MapValuesParametersSchema.safeParse(parameters);
  if (!parsedParameters.success) {
    const transformLabel = ptBRTransforms.transforms.mapValues.label;
    return refuseTransformValue(ptBRTransforms.parameterReasons.invalidParameters(transformLabel));
  }
  const table: MapValuesParameters = parsedParameters.data;

  const quotedValue = quoteValueForReason(value);
  const tableKey = findTableKeyOfValue(value);
  if (tableKey === undefined) {
    return refuseTransformValue(ptBRTransforms.reasons.notATableKey(quotedValue));
  }

  // Object.hasOwn, not `in`: a source sending "constructor" must not find the object's
  // own inherited members.
  const tableValue = Object.hasOwn(table, tableKey) ? table[tableKey] : undefined;
  if (tableValue === undefined) {
    return refuseTransformValue(ptBRTransforms.reasons.valueNotInTable(quotedValue));
  }
  return giveTransformedValue(tableValue);
}

/** `{ "BOX": "inPit" }` turns "BOX" into "inPit"; a value not in the table is refused. */
export const mapValuesTransform: Transform = {
  id: 'mapValues',
  label: ptBRTransforms.transforms.mapValues.label,
  description: ptBRTransforms.transforms.mapValues.description,
  parametersSchema: MapValuesParametersSchema,
  apply: (value, parameters) => lookUpValueInTable(value, parameters),
};
