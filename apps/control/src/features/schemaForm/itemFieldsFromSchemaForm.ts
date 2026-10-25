/**
 * A generated form as the field values an item stores (`ItemFields`): for a new item,
 * for a change to a stored one, and for "Atualizar no ar" from the item editor.
 */
import { areJsonValuesEqual, type FieldValue, type ItemFields } from '@bajaovrlay/shared';

import { readCheckedFieldsOfValidSchemaForm } from './checkSchemaFormValues';
import { convertDataValueIntoFormValue, readDataValueFromFormValue } from './fieldValueConversion';
import { readOwnValueOfRecord } from './plainRecord';
import type { SchemaFormDescription, SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

/**
 * Builds the fields of a new item (`createItem.fields`) from form values that passed the
 * check (it throws otherwise):
 * - a field with a value is stored as a literal;
 * - a cleared field is left out;
 * - a field set to "filled by the server at the take" is stored as `{ kind: 'takeTime' }`,
 *   so every take of the item gets its own moment;
 * - a field set to "Fonte" or "Relógio da fonte" is stored as its binding, and the three
 *   clock fields the whole clock fills are left out;
 * - a field set to "Evento" is stored as its event field (BAJAOVRLAY-44);
 * - a field set to "Cadastro" is stored as its entity reference, and a list field set to
 *   "Lista dos cadastros" as its entity list (BAJAOVRLAY-46);
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
    if (checkedField.outcome === 'binding') {
      fieldPairs.push([checkedField.key, checkedField.binding]);
    }
    if (checkedField.outcome === 'eventField') {
      fieldPairs.push([checkedField.key, checkedField.eventField]);
    }
    if (checkedField.outcome === 'entity') {
      fieldPairs.push([checkedField.key, checkedField.reference]);
    }
    if (checkedField.outcome === 'entityList') {
      fieldPairs.push([checkedField.key, checkedField.list]);
    }
  }
  return Object.fromEntries(fieldPairs);
}

/**
 * Whether the item stores nothing for a field, as the form sees it: no such field, a
 * literal null, or a literal the field's control shows and then reads back as blank (a
 * text that is empty or only spaces). The last one is why an untouched blank text is not
 * rewritten as null at the first save of anything else.
 */
function isStoredFieldNothingToTheForm(
  field: SchemaFormFieldDescription | undefined,
  storedField: FieldValue | undefined,
): boolean {
  if (storedField === undefined) {
    return true;
  }
  if (storedField.kind !== 'literal') {
    return false;
  }
  if (storedField.value === null) {
    return true;
  }
  if (field === undefined) {
    return false;
  }
  const storedValueShown = convertDataValueIntoFormValue(field, storedField.value);
  if (storedValueShown.status !== 'shown') {
    return false;
  }
  return readDataValueFromFormValue(field, storedValueShown.formValue).status === 'blank';
}

/**
 * Builds, for `updateItemFields.fields`, only the fields in which the form differs from
 * what the item stores (that command merges key by key, so the rest is left out):
 * - a value differs unless the item stores the very same value as a literal;
 * - "filled by the server at the take" differs unless the item already stores that;
 * - a binding differs unless the item stores the very same binding, and so do an event
 *   field and an entity reference;
 * - a clock field the whole clock fills is treated as cleared: a null where the item
 *   stores a value, so the save keeps no value beside the whole clock (the server refuses
 *   one);
 * - a cleared field is sent as `{ kind: 'literal', value: null }`, because the command
 *   cannot remove a key, and only when the item stores something there (the server
 *   strips the null at the take). An item that has no such field, or stores a text that
 *   is empty or only spaces there, is left alone.
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
      case 'binding': {
        const isStoredAsTheSameBinding =
          storedField?.kind === 'binding' && areJsonValuesEqual(storedField, checkedField.binding);
        if (!isStoredAsTheSameBinding) {
          changedFieldPairs.push([checkedField.key, checkedField.binding]);
        }
        break;
      }
      case 'eventField': {
        const isStoredAsTheSameEventField =
          storedField?.kind === 'eventField' && storedField.path === checkedField.eventField.path;
        if (!isStoredAsTheSameEventField) {
          changedFieldPairs.push([checkedField.key, checkedField.eventField]);
        }
        break;
      }
      case 'entity': {
        const isStoredAsTheSameReference =
          storedField?.kind === 'entity' && areJsonValuesEqual(storedField, checkedField.reference);
        if (!isStoredAsTheSameReference) {
          changedFieldPairs.push([checkedField.key, checkedField.reference]);
        }
        break;
      }
      case 'entityList': {
        const isStoredAsTheSameList =
          storedField?.kind === 'entityList' &&
          storedField.entityType === checkedField.list.entityType;
        if (!isStoredAsTheSameList) {
          changedFieldPairs.push([checkedField.key, checkedField.list]);
        }
        break;
      }
      case 'filledByTheWholeClock':
      case 'cleared': {
        const fieldOfTheForm = description.fields.find((field) => field.key === checkedField.key);
        const isStoredWithNothing = isStoredFieldNothingToTheForm(fieldOfTheForm, storedField);
        if (!isStoredWithNothing) {
          changedFieldPairs.push([checkedField.key, { kind: 'literal', value: null }]);
        }
        break;
      }
    }
  }
  // A list field switched from "Fonte" or "Lista dos cadastros" back to "Valor como está"
  // has no value of its own to keep (the binding or the list was all it held), so it is
  // cleared rather than left reading. Only back to "as it is": a switch from one reading
  // kind to the other already pushed the new binding or list above, which a null pushed
  // after it would overwrite (gate 2 of PR #28).
  for (const field of description.fields) {
    const storedField = readOwnValueOfRecord(storedItemFields, field.key);
    const kindNow = readOwnValueOfRecord(formValues.kinds, field.key);
    const isStoredReadingSomething =
      storedField?.kind === 'binding' || storedField?.kind === 'entityList';
    const isNowAsItIs = kindNow === undefined || kindNow === 'literal';
    const isListFieldUnbound =
      field.control === 'unsupported' && isStoredReadingSomething && isNowAsItIs;
    if (isListFieldUnbound) {
      changedFieldPairs.push([field.key, { kind: 'literal', value: null }]);
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
 * So is every key in `keysReadFromASource` (fieldsReadFromASource.ts): the item stores
 * the binding, and the source's value goes on air at the next take. The three clock
 * fields the whole clock fills are among them; sent as null, the server refused them every
 * time (gate 2 of PR #18).
 * An empty answer means there is nothing to update on air.
 */
export function buildInstanceUpdateDataFromChangedItemFields(
  changedItemFields: ItemFields,
  keysReadFromASource: string[],
): Record<string, unknown> {
  const dataPairs: Array<[string, unknown]> = [];
  for (const [fieldKey, changedField] of Object.entries(changedItemFields)) {
    if (keysReadFromASource.includes(fieldKey)) {
      continue;
    }
    if (changedField.kind === 'literal') {
      dataPairs.push([fieldKey, changedField.value]);
    }
  }
  return Object.fromEntries(dataPairs);
}
