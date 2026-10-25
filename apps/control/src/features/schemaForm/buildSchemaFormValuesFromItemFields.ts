/**
 * The third way a generated form gets filled: from the stored fields of an item, when the
 * operator opens an item of the rundown. A literal shows its value; a binding, a takeTime,
 * an event field and a library reference show as their kind with its choices. The
 * starting values and the assembly are buildSchemaFormValues.ts's, so an empty form and a
 * field that could not be read start the same way.
 *
 * A value the form cannot show never stops the form from opening: the field takes its
 * starting value instead and its label is listed, so the panel can warn the operator
 * that saving writes what the form shows.
 */
import { type EntityListType, type ItemFields, wholeClockBindingPath } from '@bajaovrlay/shared';

import {
  canFieldTakeTheWholeClock,
  listClockFieldKeysFilledByTheWholeClock,
} from './bindingChoices';
import { buildSchemaFormBindingValueFromBinding } from './bindingFormValue';
import {
  assembleSchemaFormValues,
  buildStartingValueOfField,
  chooseStartingKindOfField,
  type SchemaFormValuesReadFromData,
  writeUnsupportedValueAsJson,
} from './buildSchemaFormValues';
import {
  buildSchemaFormEntityReferenceValueFromReference,
  type SchemaFormEntityReferenceValue,
} from './entityReferenceFormValue';
import {
  clearBlankOptionalTypedFormValue,
  convertDataValueIntoFormValue,
} from './fieldValueConversion';
import { readOwnValueOfRecord } from './plainRecord';
import type { SchemaFormDescription } from './schemaFormDescription';
import type {
  SchemaFormBindingValue,
  SchemaFormFieldKind,
  SchemaFormFieldValue,
  UnsupportedValueAsJson,
} from './schemaFormValues';

/**
 * The three clock fields an item's stored whole clock fills (none when the item stores
 * no whole clock). The item stores nothing, or a literal null, on them; the form must not
 * read that as "missing".
 */
function listKeysFilledByAStoredWholeClock(
  description: SchemaFormDescription,
  itemFields: ItemFields,
): string[] {
  const clockTimeField = description.fields.find((field) =>
    canFieldTakeTheWholeClock(description.dataSchema, field.key),
  );
  const storedClockTime =
    clockTimeField === undefined ? undefined : readOwnValueOfRecord(itemFields, clockTimeField.key);
  const isWholeClockStored =
    storedClockTime?.kind === 'binding' && storedClockTime.path === wholeClockBindingPath;
  return isWholeClockStored ? listClockFieldKeysFilledByTheWholeClock(description.dataSchema) : [];
}

/**
 * Fills a form from the stored fields of an item. A `literal` shows its value, a
 * `takeTime` shows as "filled by the server at the take" where the form offers that, a
 * `binding` as "Fonte" with its choices, or as "Relógio da fonte" for the whole clock on
 * the time field (its three other clock fields are then the whole clock's, not
 * unreadable), an `entity` reference as "Cadastro" with its choices, and an `entityList`
 * on a list field as "Lista dos cadastros" with its kind (BAJAOVRLAY-46).
 * - A field the item does not store, or stores as a literal null: cleared when optional;
 *   listed, and started as in an empty form (starting value and kind), when required.
 * - A literal the control cannot show, or a `takeTime` on a field that does not offer
 *   it: listed, and started as in an empty form. Only a wall-clock field starts as
 *   "filled by the server" there; every other field starts as a typed value.
 * - A property the form cannot edit: its literal value kept as JSON text, for reading
 *   only. When the whole schema is unsupported, every stored literal is kept that way.
 * - A stored field the schema does not declare is not kept here (unlike data on air): a
 *   save sends only the fields that changed and the server merges them key by key, so
 *   the stored field stays where it is.
 * What could go wrong: a listed field differs from what is stored, so the next save
 * writes what the form shows. The panel's warning must say so.
 */
export function buildSchemaFormValuesFromItemFields(
  description: SchemaFormDescription,
  itemFields: ItemFields,
): SchemaFormValuesReadFromData {
  const valuePairs: Array<[string, SchemaFormFieldValue]> = [];
  const kindPairs: Array<[string, SchemaFormFieldKind]> = [];
  const bindingPairs: Array<[string, SchemaFormBindingValue]> = [];
  const eventPathPairs: Array<[string, string]> = [];
  const entityReferencePairs: Array<[string, SchemaFormEntityReferenceValue]> = [];
  const entityListPairs: Array<[string, EntityListType]> = [];
  const unsupportedValuesAsJson: UnsupportedValueAsJson[] = [];
  const labelsOfFieldsThatCouldNotBeRead: string[] = [];
  const keysFilledByAStoredWholeClock = listKeysFilledByAStoredWholeClock(description, itemFields);

  if (description.isWholeDataSchemaUnsupported) {
    for (const [key, storedField] of Object.entries(itemFields)) {
      if (storedField.kind === 'literal') {
        unsupportedValuesAsJson.push(...writeUnsupportedValueAsJson(key, storedField.value));
      }
    }
  }

  for (const field of description.fields) {
    const storedField = readOwnValueOfRecord(itemFields, field.key);
    if (field.control === 'unsupported') {
      if (storedField?.kind === 'literal') {
        unsupportedValuesAsJson.push(...writeUnsupportedValueAsJson(field.key, storedField.value));
      }
      // A list field bound to a source (a tower's cars) shows its "Fonte" choices.
      if (storedField?.kind === 'binding') {
        kindPairs.push([field.key, 'binding']);
        bindingPairs.push([field.key, buildSchemaFormBindingValueFromBinding(storedField)]);
      }
      // A list field reading every sponsor or slot shows "Lista dos cadastros" (BAJAOVRLAY-46).
      if (storedField?.kind === 'entityList') {
        kindPairs.push([field.key, 'entityList']);
        entityListPairs.push([field.key, storedField.entityType]);
      }
      continue;
    }

    if (storedField?.kind === 'takeTime' && field.offersTakeTime) {
      valuePairs.push([field.key, buildStartingValueOfField(field)]);
      kindPairs.push([field.key, 'takeTime']);
      continue;
    }
    if (storedField?.kind === 'binding') {
      const isWholeClock =
        storedField.path === wholeClockBindingPath &&
        canFieldTakeTheWholeClock(description.dataSchema, field.key);
      valuePairs.push([field.key, buildStartingValueOfField(field)]);
      kindPairs.push([field.key, isWholeClock ? 'wholeClock' : 'binding']);
      bindingPairs.push([field.key, buildSchemaFormBindingValueFromBinding(storedField)]);
      continue;
    }
    // A field filled by the event the item shows (BAJAOVRLAY-44): "Evento" and its path.
    if (storedField?.kind === 'eventField') {
      valuePairs.push([field.key, buildStartingValueOfField(field)]);
      kindPairs.push([field.key, 'eventField']);
      eventPathPairs.push([field.key, storedField.path]);
      continue;
    }
    // A field read from the entity library shows as "Cadastro" with its choices.
    if (storedField?.kind === 'entity') {
      valuePairs.push([field.key, buildStartingValueOfField(field)]);
      kindPairs.push([field.key, 'entity']);
      entityReferencePairs.push([
        field.key,
        buildSchemaFormEntityReferenceValueFromReference(storedField),
      ]);
      continue;
    }
    if (keysFilledByAStoredWholeClock.includes(field.key)) {
      valuePairs.push([field.key, buildStartingValueOfField(field)]);
      kindPairs.push([field.key, chooseStartingKindOfField(field)]);
      continue;
    }
    if (storedField?.kind === 'literal') {
      const valueShown = convertDataValueIntoFormValue(field, storedField.value);
      if (valueShown.status === 'shown') {
        valuePairs.push([field.key, clearBlankOptionalTypedFormValue(field, valueShown.formValue)]);
        kindPairs.push([field.key, 'literal']);
        continue;
      }
    }

    const hasNoStoredValue =
      storedField === undefined || (storedField.kind === 'literal' && storedField.value === null);
    if (hasNoStoredValue && !field.isRequired) {
      valuePairs.push([field.key, null]);
      kindPairs.push([field.key, 'literal']);
      continue;
    }
    // A field that could not be read starts as it does in an empty form, so a missing or
    // unreadable wall-clock reference becomes "filled at the take" at the next save.
    valuePairs.push([field.key, buildStartingValueOfField(field)]);
    kindPairs.push([field.key, chooseStartingKindOfField(field)]);
    labelsOfFieldsThatCouldNotBeRead.push(field.label);
  }

  return {
    formValues: {
      ...assembleSchemaFormValues(
        valuePairs,
        kindPairs,
        unsupportedValuesAsJson,
        bindingPairs,
        entityReferencePairs,
      ),
      eventPaths: Object.fromEntries(eventPathPairs),
      // Only a form that holds a list of Cadastros carries the key (schemaFormValues.ts).
      ...(entityListPairs.length > 0 ? { entityLists: Object.fromEntries(entityListPairs) } : {}),
    },
    labelsOfFieldsThatCouldNotBeRead,
  };
}
