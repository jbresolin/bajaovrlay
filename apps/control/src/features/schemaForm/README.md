# apps/control/src/features/schemaForm

The form generated from a graphic's OGraf data schema, so a new graphic costs the control
page no code. It draws fields and builds data; panels own the buttons and the commands.
Start at `index.ts` (the public surface), then `describeSchemaFormFromDataSchema.ts`, which
reads the manifest's JSON Schema into field descriptions (`schemaFormDescription.ts`).

- Filling: `buildSchemaFormValues.ts` (empty, from the air) and
  `buildSchemaFormValuesFromItemFields.ts` (from a stored item) (`schemaFormValues.ts`;
  `fieldValueConversion.ts`, `minutesAndSeconds.ts`, `localDateAndTimeText.ts`);
  `suggestedBindingsOfDataSchema.ts`.
- Checking: `checkSchemaFormValues.ts` with `zodSchemaFromDataSchema.ts` (pt-BR messages; the
  server stays the authority) through `schemaFormResolver.ts`.
- Building: `instanceUpdateFromSchemaForm.ts`, `itemFieldsFromSchemaForm.ts`.
- Drawing: `SchemaFormFields.tsx`, `SchemaFormFieldRow.tsx`, `SchemaFormValueControl.tsx`,
  `UnsupportedValueBox.tsx`, "Fonte" (`BoundFieldControls.tsx`), "Cadastro"
  (`EntityReferenceControls.tsx`, `entityReferenceFormValue.ts`), an image field's picker
  (`ImageUrlFieldControl.tsx`), a list of texts typed line by line (`TextListField.tsx`,
  `TextListLineRow.tsx`, `textListDragAnnouncements.ts`; BAJAOVRLAY-23);
  `textShownInUntouchedField.ts` for a panel's text.
