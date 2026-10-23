# apps/control/src/features/schemaForm

The form generated from a graphic's OGraf data schema, so a new graphic costs the control
page no code. It draws fields and builds data; panels own the buttons and the commands.
Start reading at `index.ts` (the public surface), then `describeSchemaFormFromDataSchema.ts`.

- `describeSchemaFormFromDataSchema.ts` reads the manifest's JSON Schema into field
  descriptions (`schemaFormDescription.ts`, `v_baja.role` included); `plainRecord.ts` reads safely.
- `buildSchemaFormValues.ts` fills the form (`schemaFormValues.ts`); `fieldValueConversion.ts`
  turns a value between data and control (`minutesAndSeconds.ts`, `localDateAndTimeText.ts`).
- `suggestedBindingsOfDataSchema.ts` reads a manifest's `v_baja.suggestedBinding` hints into the
  "Fonte" a new item opens with, when exactly one enabled source produces the shape.
- `checkSchemaFormValues.ts` checks the form with `zodSchemaFromDataSchema.ts` (pt-BR messages;
  the server stays the authority); `schemaFormResolver.ts` hands it to react-hook-form.
- `instanceUpdateFromSchemaForm.ts`, `itemFieldsFromSchemaForm.ts`
  build each command's data. `SchemaFormFields.tsx` draws it (`SchemaFormFieldRow.tsx`, `SchemaFormValueControl.tsx`,
  `UnsupportedValueBox.tsx`; `textShownInUntouchedField.ts`: a panel's text in an untouched field).
