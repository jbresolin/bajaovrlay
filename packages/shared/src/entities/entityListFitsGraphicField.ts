import { readSchemaPropertyOfField } from '../bindings/bindingFitsGraphicField.js';
import { doElementsCarryEveryKeyTheArrayFieldRequires } from '../bindings/listItemKeys.js';
import {
  type EntityListFieldValue,
  type EntityListType,
  EntityListTypeSchema,
} from './entityListFieldValue.js';
import { listKeysEveryItemOfEntityListCarries } from './entityListItems.js';
import { ptBREntities } from './ptBREntities.js';

/** Says whether a value read from a manifest is a plain object, so its fields can be read. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether one field is a list of objects: an `array` whose `items` say `type: object`.
 * A list of texts (the message ticker's messages) is not one: an item of the library is
 * an object, and the operator types such a list line by line.
 */
function isListOfObjects(schemaProperty: Record<string, unknown>): boolean {
  const items = schemaProperty.items;
  return schemaProperty.type === 'array' && isPlainObject(items) && items.type === 'object';
}

/**
 * The entity lists (BAJAOVRLAY-46) one field of a data schema takes, in the editor's order
 * (sponsors, then the schedule): on a list of objects, each list whose items always carry
 * every key the field's `items.required` names, by the rule a source's whole list follows
 * (listItemKeys.ts). Any other field, or one the schema does not declare, takes none.
 */
export function listEntityListTypesThatFitDataSchemaField(
  dataSchema: unknown,
  fieldKey: string,
): EntityListType[] {
  const schemaProperty = readSchemaPropertyOfField(dataSchema, fieldKey);
  if (schemaProperty === undefined || !isListOfObjects(schemaProperty)) {
    return [];
  }
  return EntityListTypeSchema.options.filter((listType) =>
    doElementsCarryEveryKeyTheArrayFieldRequires(
      listKeysEveryItemOfEntityListCarries(listType),
      schemaProperty,
    ),
  );
}

/**
 * Says what is wrong with storing this list on this field, as one pt-BR sentence (the
 * server puts the field's title before it), or undefined when it fits. Whether the list
 * has records is judged at the take, against the library of then.
 */
export function findProblemInEntityListForDataSchemaField(
  list: EntityListFieldValue,
  dataSchema: unknown,
  fieldKey: string,
): string | undefined {
  const listTypesThatFit = listEntityListTypesThatFitDataSchemaField(dataSchema, fieldKey);
  if (listTypesThatFit.includes(list.entityType)) {
    return undefined;
  }
  const listName = ptBREntities.entityListNames[list.entityType];
  return ptBREntities.entityListProblems.listDoesNotFitField(listName);
}
