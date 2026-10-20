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
export type {
  // Which control draws a property: text, select, dateTime, number, duration, switch, unsupported.
  SchemaFormControl,
  // A graphic's whole data schema as the form reads it: its fields, or "unsupported as a whole".
  SchemaFormDescription,
  // Everything the form needs to draw, check and send one property (label, control, limits).
  SchemaFormFieldDescription,
  // One choice of a dropdown: the value the graphic receives and the words the operator reads.
  SchemaFormSelectOption,
} from './schemaFormDescription';
export type {
  // A binding as the form holds it: source, path, car number, live or frozen, transform.
  SchemaFormBindingValue,
  // Which fields the operator changed: the part of react-hook-form's `dirtyFields` read here.
  SchemaFormDirtyFields,
  // How a field gets its value: typed, the take's moment, a source, or the source's whole clock.
  SchemaFormFieldKind,
  // What one control holds: text, true/false, or null for a cleared field.
  SchemaFormFieldValue,
  // Everything react-hook-form holds for a generated form: values, kinds and kept JSON texts.
  SchemaFormValues,
  // A value the form cannot edit (or a key the schema does not declare), kept as JSON text.
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
export type {
  // One field of a form that passed the check: its value, "cleared", or "filled at the take".
  CheckedSchemaFormField,
  // The result of checking a form: every field as data, or one pt-BR message per wrong field.
  SchemaFormCheck,
  // The pt-BR message for one wrong field, with that field's key.
  SchemaFormFieldMessage,
} from './checkSchemaFormValues';
// Checks a form's values without react-hook-form (the resolver below wraps it).
export { checkSchemaFormValues } from './checkSchemaFormValues';
// Builds the `resolver` option of `useForm<SchemaFormValues>()` for one description.
export { buildSchemaFormResolver } from './schemaFormResolver';
// Builds the Zod schema of a graphic's data from its JSON Schema, with pt-BR messages.
export { buildZodSchemaFromDataSchema } from './zodSchemaFromDataSchema';

// The parts of an updateInstanceData that come from a form, and "is there nothing to send?".
export type { InstanceUpdateFromSchemaForm } from './instanceUpdateFromSchemaForm';
// Builds an on-air update from a checked form: only the changed fields, null for a cleared one.
export {
  // Whether a source choice changed since the form opened (it reaches the air at the take).
  hasSourceChoiceChangedSinceOpened,
  // The keys the form reads from a source now, which "Atualizar no ar" leaves out.
  listFieldKeysReadFromASource,
} from './fieldsReadFromASource';
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
// What a panel hands the form so fields can read a data source ("Fonte", "Relógio da fonte").
export type { SchemaFormBindingOptions } from './BoundFieldControls';
// The line saying what a bound field would get now, or why it would get nothing.
export { describeBindingValueNow } from './bindingValueNowText';
// A text a panel has one untouched field show in place of the value the form holds.
export type { TextShownInUntouchedField } from './textShownInUntouchedField';
// Writes milliseconds as mm:ss ("12:34"), the way a duration field shows them.
export { formatMillisecondsAsMinutesAndSeconds } from './minutesAndSeconds';
