/**
 * The public surface of the generated form. Other features import from here only.
 *
 * The usual road through it, for a panel:
 *   1. `describeSchemaFormFromDataSchema(graphic.manifest.schema)` once per graphic;
 *   2. one of the three `build…SchemaFormValues…` functions for `useForm`'s
 *      `defaultValues` or `reset`, and `buildSchemaFormResolver` for its `resolver`;
 *   3. `<SchemaFormFields>` to draw the fields;
 *   4. after the form passed its check, one of the `build…FromSchemaForm` functions for
 *      the data of the command.
 */

// Reads a manifest's data schema (typed as anything) into the form's field descriptions.
export { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
// What is known about a graphic's data schema, and about each of its properties.
export type {
  SchemaFormControl,
  SchemaFormDescription,
  SchemaFormFieldDescription,
  SchemaFormSelectOption,
} from './schemaFormDescription';

// What react-hook-form holds for a generated form, and which of its fields were changed.
export type {
  SchemaFormDirtyFields,
  SchemaFormFieldKind,
  SchemaFormFieldValue,
  SchemaFormValues,
  UnsupportedValueAsJson,
} from './schemaFormValues';

// A form filled from existing data, with the labels of the fields that could not be shown.
export type { SchemaFormValuesReadFromData } from './buildSchemaFormValues';
export {
  // The values of a form nobody filled: the manifest's defaults, wall-clock fields as takeTime.
  buildEmptySchemaFormValues,
  // The values of a form showing the resolvedData of an instance on air.
  buildSchemaFormValuesFromDataOnAir,
  // The values of a form showing the stored fields of an item.
  buildSchemaFormValuesFromItemFields,
} from './buildSchemaFormValues';

// The result of checking a form: every field as data, or one pt-BR message per wrong field.
export type {
  CheckedSchemaFormField,
  SchemaFormCheck,
  SchemaFormFieldMessage,
} from './checkSchemaFormValues';
// Checks a form's values without react-hook-form (the resolver below wraps it).
export { checkSchemaFormValues } from './checkSchemaFormValues';
// Builds the `resolver` option of `useForm<SchemaFormValues>()` for one description.
export { buildSchemaFormResolver } from './schemaFormResolver';
// Builds the Zod schema of a graphic's data from its JSON Schema, with pt-BR messages.
export { buildZodSchemaFromDataSchema } from './zodSchemaFromDataSchema';

// The `data` and `takeTimeFieldKeys` of a takeGraphic built from a checked form.
export type { TakeDataFromSchemaForm } from './takeDataFromSchemaForm';
export { buildTakeDataFromSchemaForm } from './takeDataFromSchemaForm';
// The `data` and `takeTimeFieldKeys` of an updateInstanceData: only the changed fields.
export type { InstanceUpdateFromSchemaForm } from './instanceUpdateFromSchemaForm';
export { buildInstanceUpdateFromDirtySchemaFormFields } from './instanceUpdateFromSchemaForm';
export {
  // Of a stored item, only the fields in which the form differs (updateItemFields.fields).
  buildChangedItemFieldsFromSchemaForm,
  // The `data` "Atualizar no ar" sends: the changed literal fields, null for a cleared one.
  buildInstanceUpdateDataFromChangedItemFields,
  // Every field of a new item (createItem.fields).
  buildItemFieldsFromSchemaForm,
} from './itemFieldsFromSchemaForm';

// Draws the fields of a generated form for a react-hook-form `form`.
export { SchemaFormFields } from './SchemaFormFields';
