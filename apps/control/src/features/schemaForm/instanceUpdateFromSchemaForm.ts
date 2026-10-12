import { readCheckedFieldsOfValidSchemaForm } from './checkSchemaFormValues';
import { readOwnValueOfRecord } from './plainRecord';
import type { SchemaFormDescription } from './schemaFormDescription';
import type { SchemaFormDirtyFields, SchemaFormValues } from './schemaFormValues';

/** The parts of an `updateInstanceData` command that come from a generated form. */
export type InstanceUpdateFromSchemaForm = {
  /** Only the fields the operator changed; null for one that was cleared. */
  data: Record<string, unknown>;
  /** Changed fields the server fills with the moment it applies the update. */
  takeTimeFieldKeys: string[];
  /** True when the operator changed nothing, so there is no command to send. */
  hasNothingToSend: boolean;
};

/** Answers whether react-hook-form marks a field's value or its kind as changed. */
function isFieldDirty(dirtyFields: SchemaFormDirtyFields, fieldKey: string): boolean {
  const isValueDirty = readOwnValueOfRecord(dirtyFields.values ?? {}, fieldKey) === true;
  const isKindDirty = readOwnValueOfRecord(dirtyFields.kinds ?? {}, fieldKey) === true;
  return isValueDirty || isKindDirty;
}

/**
 * Builds the update of an instance on air from form values that passed the check (it
 * throws otherwise) and react-hook-form's `formState.dirtyFields`. Only what the operator
 * changed since the form was last filled is sent; the server keeps every other field:
 * - a changed field with a value goes into `data`;
 * - a changed field that is now cleared goes as null, which takes it off air;
 * - a changed field now set to "filled by the server" is named in `takeTimeFieldKeys`;
 * - a property the form cannot edit is never sent: it cannot have changed.
 * "Changed" is react-hook-form's meaning: a field put back to the value the form was
 * filled with is not changed, and changing a field's kind changes the field.
 * What could go wrong: the whole form must be valid, not only the changed fields, so a
 * value on air that the rules refuse blocks the update until it is corrected.
 */
export function buildInstanceUpdateFromDirtySchemaFormFields(
  description: SchemaFormDescription,
  formValues: SchemaFormValues,
  dirtyFields: SchemaFormDirtyFields,
): InstanceUpdateFromSchemaForm {
  const checkedFields = readCheckedFieldsOfValidSchemaForm(description, formValues);
  const dataPairs: Array<[string, unknown]> = [];
  const takeTimeFieldKeys: string[] = [];

  for (const checkedField of checkedFields) {
    if (!isFieldDirty(dirtyFields, checkedField.key)) {
      continue;
    }
    switch (checkedField.outcome) {
      case 'value':
        dataPairs.push([checkedField.key, checkedField.value]);
        break;
      case 'cleared':
        dataPairs.push([checkedField.key, null]);
        break;
      case 'takeTime':
        takeTimeFieldKeys.push(checkedField.key);
        break;
    }
  }

  const hasNothingToSend = dataPairs.length === 0 && takeTimeFieldKeys.length === 0;
  return { data: Object.fromEntries(dataPairs), takeTimeFieldKeys, hasNothingToSend };
}
