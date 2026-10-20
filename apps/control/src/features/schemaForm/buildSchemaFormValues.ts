/**
 * The three ways a generated form gets filled: empty (a new item, or a graphic that is
 * not on air), from the data of an instance on air, and from the stored fields of an
 * item. Each answers the whole `SchemaFormValues`, ready for react-hook-form's
 * `defaultValues` or `reset`.
 *
 * A value the form cannot show never stops the form from opening: the field takes its
 * starting value instead and its label is listed, so the panel can warn the operator
 * that saving or taking writes what the form shows.
 */
import type { ItemFields } from '@bajaovrlay/shared';

import {
  canFieldTakeTheWholeClock,
  listClockFieldKeysFilledByTheWholeClock,
} from './bindingChoices';
import {
  buildSchemaFormBindingValueFromBinding,
  emptySchemaFormBindingValue,
} from './bindingFormValue';
import {
  clearBlankOptionalTypedFormValue,
  convertDataValueIntoFormValue,
} from './fieldValueConversion';
import { isPlainRecord, readOwnValueOfRecord } from './plainRecord';
import type { SchemaFormDescription, SchemaFormFieldDescription } from './schemaFormDescription';
import type {
  SchemaFormBindingValue,
  SchemaFormFieldKind,
  SchemaFormFieldValue,
  SchemaFormValues,
  UnsupportedValueAsJson,
} from './schemaFormValues';

/** What filling a form from existing data gives. */
export type SchemaFormValuesReadFromData = {
  formValues: SchemaFormValues;
  /**
   * Labels of the fields shown with their starting value because what was there could
   * not be shown (a required field that is missing, a text where a number belongs, a
   * field kind this editor does not offer), in the order of the form.
   */
  labelsOfFieldsThatCouldNotBeRead: string[];
};

/**
 * What a field holds before anyone typed: the manifest's `default` when the control can
 * show it; otherwise empty text for a required typed field (the operator must fill it),
 * "off" for a required switch (a switch cannot look empty), and cleared for everything
 * optional and for a dropdown with nothing to preselect.
 * An optional text whose default is the empty text starts cleared too: here and in the
 * two fill functions below, a shown value goes through clearBlankOptionalTypedFormValue,
 * so the form never holds '' where emptying the field by hand would leave null.
 */
function buildStartingValueOfField(field: SchemaFormFieldDescription): SchemaFormFieldValue {
  const defaultShown = convertDataValueIntoFormValue(field, field.defaultDataValue);
  if (defaultShown.status === 'shown') {
    return clearBlankOptionalTypedFormValue(field, defaultShown.formValue);
  }
  if (!field.isRequired || field.control === 'select') {
    return null;
  }
  return field.control === 'switch' ? false : '';
}

/**
 * How a field starts in an empty form: "filled by the server at the take" wherever that
 * is offered, typed everywhere else. This keeps João's ruling at gate 2 of BAJAOVRLAY-13:
 * a new item stores a wall-clock reference as `takeTime`, so a clock prepared the evening
 * before counts from the moment it is fired.
 */
function chooseStartingKindOfField(field: SchemaFormFieldDescription): SchemaFormFieldKind {
  return field.offersTakeTime ? 'takeTime' : 'literal';
}

/**
 * Writes a value the form cannot edit as JSON text: a list with that one entry, or an
 * empty list for a value JSON cannot hold (so the caller can simply add what comes back).
 */
function writeUnsupportedValueAsJson(key: string, value: unknown): UnsupportedValueAsJson[] {
  const jsonText = JSON.stringify(value, null, 2);
  // JSON.stringify answers undefined (not text) for a value JSON cannot hold.
  return typeof jsonText === 'string' ? [{ key, jsonText }] : [];
}

/** The fields the form can edit (every control except the read-only JSON box). */
function listFieldsTheFormCanEdit(description: SchemaFormDescription) {
  return description.fields.filter((field) => field.control !== 'unsupported');
}

/**
 * Puts the parts together, building the records from pairs (never by assignment). A field
 * with no binding pair gets the empty "Fonte" (nothing chosen, live), so every editable
 * field has one for the kind selector to switch to.
 */
function assembleSchemaFormValues(
  valuePairs: Array<[string, SchemaFormFieldValue]>,
  kindPairs: Array<[string, SchemaFormFieldKind]>,
  unsupportedValuesAsJson: UnsupportedValueAsJson[],
  bindingPairs: Array<[string, SchemaFormBindingValue]> = [],
): SchemaFormValues {
  const bindingsByKey = new Map(bindingPairs);
  const keysOfEditableFields = valuePairs.map(([fieldKey]) => fieldKey);
  // A list field the form draws read-only has no value, but may hold a binding.
  const keysOfListFieldsWithABinding = bindingPairs
    .map(([fieldKey]) => fieldKey)
    .filter((fieldKey) => !keysOfEditableFields.includes(fieldKey));
  return {
    values: Object.fromEntries(valuePairs),
    kinds: Object.fromEntries(kindPairs),
    bindings: Object.fromEntries(
      [...keysOfEditableFields, ...keysOfListFieldsWithABinding].map((fieldKey) => [
        fieldKey,
        bindingsByKey.get(fieldKey) ?? emptySchemaFormBindingValue,
      ]),
    ),
    unsupportedValuesAsJson,
  };
}

/**
 * The values of a form nobody filled yet: every field at its starting value (the
 * manifest's defaults), a wall-clock field set to "filled by the server at the take",
 * and no value for any property the form cannot edit.
 */
export function buildEmptySchemaFormValues(description: SchemaFormDescription): SchemaFormValues {
  const fieldsTheFormCanEdit = listFieldsTheFormCanEdit(description);
  return assembleSchemaFormValues(
    fieldsTheFormCanEdit.map((field) => [field.key, buildStartingValueOfField(field)]),
    fieldsTheFormCanEdit.map((field) => [field.key, chooseStartingKindOfField(field)]),
    [],
  );
}

/**
 * Fills a form from the data of an instance on air (`instance.resolvedData`). Every
 * field shown is `literal`, also a wall-clock one: the number on air is what is on air.
 * - A field the data does not have: cleared when optional; listed, and started as in an
 *   empty form (starting value and starting kind), when required.
 * - A value the control cannot show: listed, and started as in an empty form. So a
 *   wall-clock field that cannot be read is "filled by the server at the take", and a
 *   take does not send the manifest's default number as the moment the clock counts from.
 * - A property the form cannot edit: kept as JSON text when the data has it.
 * - A key of the data the schema does not declare: kept as JSON text too, after the
 *   others, so a take carries it. When the whole schema is unsupported, that is every key.
 */
export function buildSchemaFormValuesFromDataOnAir(
  description: SchemaFormDescription,
  resolvedData: unknown,
): SchemaFormValuesReadFromData {
  const dataOnAir = isPlainRecord(resolvedData) ? resolvedData : {};
  const valuePairs: Array<[string, SchemaFormFieldValue]> = [];
  const kindPairs: Array<[string, SchemaFormFieldKind]> = [];
  const unsupportedValuesAsJson: UnsupportedValueAsJson[] = [];
  const labelsOfFieldsThatCouldNotBeRead: string[] = [];

  for (const field of description.fields) {
    const isOnAir = Object.hasOwn(dataOnAir, field.key);
    const valueOnAir = readOwnValueOfRecord(dataOnAir, field.key);
    if (field.control === 'unsupported') {
      if (isOnAir) {
        unsupportedValuesAsJson.push(...writeUnsupportedValueAsJson(field.key, valueOnAir));
      }
      continue;
    }

    const valueShown = convertDataValueIntoFormValue(field, valueOnAir);
    if (valueShown.status === 'shown') {
      valuePairs.push([field.key, clearBlankOptionalTypedFormValue(field, valueShown.formValue)]);
      kindPairs.push([field.key, 'literal']);
      continue;
    }
    const isOptionalFieldWithNoValue = !field.isRequired && !isOnAir;
    if (isOptionalFieldWithNoValue) {
      valuePairs.push([field.key, null]);
      kindPairs.push([field.key, 'literal']);
      continue;
    }
    valuePairs.push([field.key, buildStartingValueOfField(field)]);
    kindPairs.push([field.key, chooseStartingKindOfField(field)]);
    labelsOfFieldsThatCouldNotBeRead.push(field.label);
  }

  // Deliberate: a key on air that no field describes is kept like an unsupported value,
  // so the form holds everything on air and nothing is taken off air unseen ("Atualizar"
  // sends only what the operator changed, so it never sends such a key). The server accepts
  // such keys whenever the schema does not say `additionalProperties: false` (an item's
  // typed fields can carry them). They are drawn nowhere and are not listed as problems.
  // When the whole schema is unsupported there are no fields, so this keeps every key of
  // the data.
  const keysTheFieldsDescribe = description.fields.map((field) => field.key);
  for (const [key, value] of Object.entries(dataOnAir)) {
    if (!keysTheFieldsDescribe.includes(key)) {
      unsupportedValuesAsJson.push(...writeUnsupportedValueAsJson(key, value));
    }
  }

  return {
    formValues: assembleSchemaFormValues(valuePairs, kindPairs, unsupportedValuesAsJson),
    labelsOfFieldsThatCouldNotBeRead,
  };
}

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
    storedClockTime?.kind === 'binding' && storedClockTime.path === 'clock';
  return isWholeClockStored ? listClockFieldKeysFilledByTheWholeClock(description.dataSchema) : [];
}

/**
 * Fills a form from the stored fields of an item. A `literal` shows its value, a
 * `takeTime` shows as "filled by the server at the take" where the form offers that, and
 * a `binding` as "Fonte" with its choices, or as "Relógio da fonte" for the whole clock on
 * the time field (its three other clock fields are then the whole clock's, not unreadable).
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
      continue;
    }

    if (storedField?.kind === 'takeTime' && field.offersTakeTime) {
      valuePairs.push([field.key, buildStartingValueOfField(field)]);
      kindPairs.push([field.key, 'takeTime']);
      continue;
    }
    if (storedField?.kind === 'binding') {
      const isWholeClock =
        storedField.path === 'clock' &&
        canFieldTakeTheWholeClock(description.dataSchema, field.key);
      valuePairs.push([field.key, buildStartingValueOfField(field)]);
      kindPairs.push([field.key, isWholeClock ? 'wholeClock' : 'binding']);
      bindingPairs.push([field.key, buildSchemaFormBindingValueFromBinding(storedField)]);
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
    formValues: assembleSchemaFormValues(
      valuePairs,
      kindPairs,
      unsupportedValuesAsJson,
      bindingPairs,
    ),
    labelsOfFieldsThatCouldNotBeRead,
  };
}
