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

import { convertDataValueIntoFormValue } from './fieldValueConversion';
import { isPlainRecord, readOwnValueOfRecord } from './plainRecord';
import type { SchemaFormDescription, SchemaFormFieldDescription } from './schemaFormDescription';
import type {
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
 */
function buildStartingValueOfField(field: SchemaFormFieldDescription): SchemaFormFieldValue {
  const defaultShown = convertDataValueIntoFormValue(field, field.defaultDataValue);
  if (defaultShown.status === 'shown') {
    return defaultShown.formValue;
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

/** Puts the three parts together, building both records from pairs (never by assignment). */
function assembleSchemaFormValues(
  valuePairs: Array<[string, SchemaFormFieldValue]>,
  kindPairs: Array<[string, SchemaFormFieldKind]>,
  unsupportedValuesAsJson: UnsupportedValueAsJson[],
): SchemaFormValues {
  return {
    values: Object.fromEntries(valuePairs),
    kinds: Object.fromEntries(kindPairs),
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
 * field is `literal`, also a wall-clock one: the number on air is what is on air.
 * - A field the data does not have: cleared when optional; its starting value, and
 *   listed, when required.
 * - A value the control cannot show: the starting value, and listed.
 * - A property the form cannot edit: kept as JSON text when the data has it. When the
 *   whole schema is unsupported, every key of the data is kept that way.
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

  if (description.isWholeDataSchemaUnsupported) {
    for (const [key, value] of Object.entries(dataOnAir)) {
      unsupportedValuesAsJson.push(...writeUnsupportedValueAsJson(key, value));
    }
  }

  for (const field of description.fields) {
    const isOnAir = Object.hasOwn(dataOnAir, field.key);
    const valueOnAir = readOwnValueOfRecord(dataOnAir, field.key);
    if (field.control === 'unsupported') {
      if (isOnAir) {
        unsupportedValuesAsJson.push(...writeUnsupportedValueAsJson(field.key, valueOnAir));
      }
      continue;
    }

    kindPairs.push([field.key, 'literal']);
    const valueShown = convertDataValueIntoFormValue(field, valueOnAir);
    if (valueShown.status === 'shown') {
      valuePairs.push([field.key, valueShown.formValue]);
      continue;
    }
    const isOptionalFieldWithNoValue = !field.isRequired && !isOnAir;
    if (isOptionalFieldWithNoValue) {
      valuePairs.push([field.key, null]);
      continue;
    }
    valuePairs.push([field.key, buildStartingValueOfField(field)]);
    labelsOfFieldsThatCouldNotBeRead.push(field.label);
  }

  return {
    formValues: assembleSchemaFormValues(valuePairs, kindPairs, unsupportedValuesAsJson),
    labelsOfFieldsThatCouldNotBeRead,
  };
}

/**
 * Fills a form from the stored fields of an item. A `literal` shows its value and a
 * `takeTime` shows as "filled by the server at the take" where the form offers that.
 * - A field the item does not store, or stores as a literal null: cleared when optional;
 *   its starting value and starting kind, and listed, when required.
 * - A literal the control cannot show, or a `takeTime` on a field that does not offer
 *   it: the starting value as a literal, and listed.
 * - A property the form cannot edit: its literal value kept as JSON text, for reading
 *   only. When the whole schema is unsupported, every stored literal is kept that way.
 * What could go wrong: a listed field differs from what is stored, so the next save
 * writes what the form shows. The panel's warning must say so.
 */
export function buildSchemaFormValuesFromItemFields(
  description: SchemaFormDescription,
  itemFields: ItemFields,
): SchemaFormValuesReadFromData {
  const valuePairs: Array<[string, SchemaFormFieldValue]> = [];
  const kindPairs: Array<[string, SchemaFormFieldKind]> = [];
  const unsupportedValuesAsJson: UnsupportedValueAsJson[] = [];
  const labelsOfFieldsThatCouldNotBeRead: string[] = [];

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
      continue;
    }

    if (storedField?.kind === 'takeTime' && field.offersTakeTime) {
      valuePairs.push([field.key, buildStartingValueOfField(field)]);
      kindPairs.push([field.key, 'takeTime']);
      continue;
    }
    if (storedField?.kind === 'literal') {
      const valueShown = convertDataValueIntoFormValue(field, storedField.value);
      if (valueShown.status === 'shown') {
        valuePairs.push([field.key, valueShown.formValue]);
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
    valuePairs.push([field.key, buildStartingValueOfField(field)]);
    // A required field the item does not store starts as it does in an empty form, so a
    // missing wall-clock reference becomes "filled at the take" at the next save.
    kindPairs.push([field.key, hasNoStoredValue ? chooseStartingKindOfField(field) : 'literal']);
    labelsOfFieldsThatCouldNotBeRead.push(field.label);
  }

  return {
    formValues: assembleSchemaFormValues(valuePairs, kindPairs, unsupportedValuesAsJson),
    labelsOfFieldsThatCouldNotBeRead,
  };
}
