/**
 * A generated form as the field values an item stores (`ItemFields`): for a new item,
 * for a change to a stored one, and for "Atualizar no ar" from the item editor.
 */
import type { FieldValue, ItemFields } from '@bajaovrlay/shared';

import { readCheckedFieldsOfValidSchemaForm } from './checkSchemaFormValues';
import { readOwnValueOfRecord } from './plainRecord';
import type { SchemaFormDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

/**
 * Builds the fields of a new item (`createItem.fields`) from form values that passed the
 * check (it throws otherwise):
 * - a field with a value is stored as a literal;
 * - a cleared field is left out;
 * - a field set to "filled by the server at the take" is stored as `{ kind: 'takeTime' }`,
 *   so every take of the item gets its own moment;
 * - a property the form cannot edit is stored as a literal exactly as it was where the
 *   form was filled from (a new, empty form has none).
 */
export function buildItemFieldsFromSchemaForm(
  description: SchemaFormDescription,
  formValues: SchemaFormValues,
): ItemFields {
  const checkedFields = readCheckedFieldsOfValidSchemaForm(description, formValues);
  const fieldPairs: Array<[string, FieldValue]> = [];

  for (const unsupportedValue of formValues.unsupportedValuesAsJson) {
    const valueAsItWas: unknown = JSON.parse(unsupportedValue.jsonText);
    fieldPairs.push([unsupportedValue.key, { kind: 'literal', value: valueAsItWas }]);
  }
  for (const checkedField of checkedFields) {
    if (checkedField.outcome === 'value') {
      fieldPairs.push([checkedField.key, { kind: 'literal', value: checkedField.value }]);
    }
    if (checkedField.outcome === 'takeTime') {
      fieldPairs.push([checkedField.key, { kind: 'takeTime' }]);
    }
  }
  return Object.fromEntries(fieldPairs);
}

/**
 * Builds, for `updateItemFields.fields`, only the fields in which the form differs from
 * what the item stores (that command merges key by key, so the rest is left out):
 * - a value differs unless the item stores the very same value as a literal;
 * - "filled by the server at the take" differs unless the item already stores that;
 * - a cleared field is sent as `{ kind: 'literal', value: null }`, because the command
 *   cannot remove a key, and only when the item stores something there (the server
 *   strips the null at the take). An item that has no such field is left alone.
 * - a property the form cannot edit is never sent.
 * An empty answer means there is nothing to save in the fields.
 * What could go wrong: values are compared as data, not as shown. A stored time with a
 * part of a second (90 500 ms, possible only through the API) shows as "1:30", reads back
 * as 90 000 and so counts as different: the first save of anything rewrites it in whole
 * seconds. The same happens to a stored date written with another offset or with
 * milliseconds.
 */
export function buildChangedItemFieldsFromSchemaForm(
  description: SchemaFormDescription,
  formValues: SchemaFormValues,
  storedItemFields: ItemFields,
): ItemFields {
  const checkedFields = readCheckedFieldsOfValidSchemaForm(description, formValues);
  const changedFieldPairs: Array<[string, FieldValue]> = [];

  for (const checkedField of checkedFields) {
    const storedField = readOwnValueOfRecord(storedItemFields, checkedField.key);
    switch (checkedField.outcome) {
      case 'value': {
        const isStoredAsTheSameValue =
          storedField?.kind === 'literal' && storedField.value === checkedField.value;
        if (!isStoredAsTheSameValue) {
          changedFieldPairs.push([
            checkedField.key,
            { kind: 'literal', value: checkedField.value },
          ]);
        }
        break;
      }
      case 'takeTime': {
        const isStoredAsTakeTime = storedField?.kind === 'takeTime';
        if (!isStoredAsTakeTime) {
          changedFieldPairs.push([checkedField.key, { kind: 'takeTime' }]);
        }
        break;
      }
      case 'cleared': {
        const isStoredWithNothing =
          storedField === undefined ||
          (storedField.kind === 'literal' && storedField.value === null);
        if (!isStoredWithNothing) {
          changedFieldPairs.push([checkedField.key, { kind: 'literal', value: null }]);
        }
        break;
      }
    }
  }
  return Object.fromEntries(changedFieldPairs);
}

/**
 * Builds the `data` of the `updateInstanceData` that "Atualizar no ar" sends from the
 * item editor, from the changed fields buildChangedItemFieldsFromSchemaForm answered:
 * each changed literal as its value, a cleared one as null (which takes it off air).
 * A field changed to "filled by the server at the take" is left out: the brief sends the
 * changed literals only, so the moment already on air stays until the item is taken again.
 * An empty answer means there is nothing to update on air.
 */
export function buildInstanceUpdateDataFromChangedItemFields(
  changedItemFields: ItemFields,
): Record<string, unknown> {
  const dataPairs: Array<[string, unknown]> = [];
  for (const [fieldKey, changedField] of Object.entries(changedItemFields)) {
    if (changedField.kind === 'literal') {
      dataPairs.push([fieldKey, changedField.value]);
    }
  }
  return Object.fromEntries(dataPairs);
}
