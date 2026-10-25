/**
 * Two of the three ways a generated form gets filled: empty (a new item, or a graphic
 * that is not on air) and from the data of an instance on air; the third, from the stored
 * fields of an item, is buildSchemaFormValuesFromItemFields.ts, which builds on the
 * starting values and the assembly exported here. Each answers the whole
 * `SchemaFormValues`, ready for react-hook-form's `defaultValues` or `reset`.
 *
 * A value the form cannot show never stops the form from opening: the field takes its
 * starting value instead and its label is listed, so the panel can warn the operator
 * that saving or taking writes what the form shows.
 */
import type { BindingFieldValue } from '@bajaovrlay/shared';

import {
  buildSchemaFormBindingValueFromBinding,
  emptySchemaFormBindingValue,
} from './bindingFormValue';
import type { SchemaFormEntityReferenceValue } from './entityReferenceFormValue';
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
 * "off" for a required switch (a switch cannot look empty), one empty line for a required
 * list of texts (a box to type the first message in), and cleared for everything
 * optional and for a dropdown with nothing to preselect.
 * An optional text whose default is the empty text starts cleared too: here and in the
 * two fill functions below, a shown value goes through clearBlankOptionalTypedFormValue,
 * so the form never holds '' where emptying the field by hand would leave null.
 */
export function buildStartingValueOfField(field: SchemaFormFieldDescription): SchemaFormFieldValue {
  const defaultShown = convertDataValueIntoFormValue(field, field.defaultDataValue);
  if (defaultShown.status === 'shown') {
    return clearBlankOptionalTypedFormValue(field, defaultShown.formValue);
  }
  if (!field.isRequired || field.control === 'select') {
    return null;
  }
  if (field.control === 'textList') {
    return [{ text: '' }];
  }
  return field.control === 'switch' ? false : '';
}

/**
 * How a field starts in an empty form: "filled by the server at the take" wherever that
 * is offered, typed everywhere else. This keeps João's ruling at gate 2 of BAJAOVRLAY-13:
 * a new item stores a wall-clock reference as `takeTime`, so a clock prepared the evening
 * before counts from the moment it is fired.
 */
export function chooseStartingKindOfField(field: SchemaFormFieldDescription): SchemaFormFieldKind {
  return field.offersTakeTime ? 'takeTime' : 'literal';
}

/**
 * Writes a value the form cannot edit as JSON text: a list with that one entry, or an
 * empty list for a value JSON cannot hold (so the caller can simply add what comes back).
 */
export function writeUnsupportedValueAsJson(key: string, value: unknown): UnsupportedValueAsJson[] {
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
export function assembleSchemaFormValues(
  valuePairs: Array<[string, SchemaFormFieldValue]>,
  kindPairs: Array<[string, SchemaFormFieldKind]>,
  unsupportedValuesAsJson: UnsupportedValueAsJson[],
  bindingPairs: Array<[string, SchemaFormBindingValue]> = [],
  entityReferencePairs: Array<[string, SchemaFormEntityReferenceValue]> = [],
): SchemaFormValues {
  const bindingsByKey = new Map(bindingPairs);
  const keysOfEditableFields = valuePairs.map(([fieldKey]) => fieldKey);
  // A list field the form draws read-only has no value, but may hold a binding.
  const keysOfListFieldsWithABinding = bindingPairs
    .map(([fieldKey]) => fieldKey)
    .filter((fieldKey) => !keysOfEditableFields.includes(fieldKey));
  const formValues: SchemaFormValues = {
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
  // Only a form that holds a "Cadastro" choice carries the record (schemaFormValues.ts).
  if (entityReferencePairs.length > 0) {
    formValues.entityReferences = Object.fromEntries(entityReferencePairs);
  }
  return formValues;
}

/**
 * The values of a form nobody filled yet: every field at its starting value (the
 * manifest's defaults), a wall-clock field set to "filled by the server at the take",
 * and no value for any property the form cannot edit.
 * `bindingsSuggestedByTheManifest` (suggestedBindingsOfDataSchema.ts, by field key) sets
 * those fields to "Fonte" with the binding's choices instead, a list field included; a
 * key no field has is ignored.
 */
export function buildEmptySchemaFormValues(
  description: SchemaFormDescription,
  bindingsSuggestedByTheManifest: Record<string, BindingFieldValue> = {},
): SchemaFormValues {
  const fieldsTheFormCanEdit = listFieldsTheFormCanEdit(description);
  const kindPairs: Array<[string, SchemaFormFieldKind]> = [];
  const bindingPairs: Array<[string, SchemaFormBindingValue]> = [];
  for (const field of description.fields) {
    const suggestedBinding = readOwnValueOfRecord(bindingsSuggestedByTheManifest, field.key);
    if (suggestedBinding !== undefined) {
      kindPairs.push([field.key, 'binding']);
      bindingPairs.push([field.key, buildSchemaFormBindingValueFromBinding(suggestedBinding)]);
      continue;
    }
    if (field.control !== 'unsupported') {
      kindPairs.push([field.key, chooseStartingKindOfField(field)]);
    }
  }
  return assembleSchemaFormValues(
    fieldsTheFormCanEdit.map((field) => [field.key, buildStartingValueOfField(field)]),
    kindPairs,
    [],
    bindingPairs,
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
