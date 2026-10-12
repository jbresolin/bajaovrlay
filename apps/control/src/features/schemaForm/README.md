# apps/control/src/features/schemaForm

The form generated from a graphic's OGraf data schema, so a new graphic costs the control
page no code. It draws fields and builds data; panels own the buttons and the commands.
Start reading at `index.ts` (the public surface), then `describeSchemaFormFromDataSchema.ts`.

- `describeSchemaFormFromDataSchema.ts` reads the manifest's JSON Schema into field
  descriptions (`schemaFormDescription.ts`); `plainRecord.ts` reads untrusted objects safely.
- `buildSchemaFormValues.ts` fills the form (`schemaFormValues.ts`); `fieldValueConversion.ts`
  turns a value between data and control (`minutesAndSeconds.ts`, `localDateAndTimeText.ts`).
- `checkSchemaFormValues.ts` checks the form with `zodSchemaFromDataSchema.ts` (pt-BR messages;
  the server stays the authority); `schemaFormResolver.ts` hands it to react-hook-form.
- `takeDataFromSchemaForm.ts`, `instanceUpdateFromSchemaForm.ts`, `itemFieldsFromSchemaForm.ts`
  turn a checked form into each command's data. `SchemaFormFields.tsx` draws the form with
  `SchemaFormFieldRow.tsx`, `SchemaFormValueControl.tsx` and `UnsupportedValueBox.tsx`.
