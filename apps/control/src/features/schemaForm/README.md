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
- Drawing: `SchemaFormFields.tsx`, `SchemaFormFieldRow.tsx` (what it offers in
  `fieldKindsOffered.ts`, its "Como preencher …" in `FieldKindSelect.tsx`),
  `SchemaFormValueControl.tsx`, `UnsupportedValueBox.tsx`, "Fonte" (`BoundFieldControls.tsx`,
  its transforms in `BindingTransformControls.tsx`, what a panel hands it in
  `schemaFormBindingOptions.ts`), "Cadastro"
  (`EntityReferenceControls.tsx`, `entityReferenceFormValue.ts`), an image field's picker
  (`ImageUrlFieldControl.tsx`), a list of texts typed line by line (`TextListField.tsx`,
  `TextListLineRow.tsx`, `textListDragAnnouncements.ts`; BAJAOVRLAY-23);
  `textShownInUntouchedField.ts` for a panel's text; `BindingValueNowLine.tsx` is "Valor agora".
- `bindingChoices.ts` with `bindingPathChoicesKeptPerSchema.ts`: the paths a field may read, worked
  out once per schema object and field.

What redraws when (BAJAOVRLAY-45): `SchemaFormFieldRow` is memoised and reads its own field's state
(`useWatch` of its kind, `useFormState` of its value by exact name), never `form.formState`, so a pick or
a keystroke redraws that row alone; the form-wide watches compute a yes or no (`useWatch` `compute`).
"Valor agora" listens to the panel's `subscribeToValuesNow` by itself and redraws when its text changes,
not its row. A panel keeps this only by handing the same props from draw to draw.
