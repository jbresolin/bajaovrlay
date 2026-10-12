# apps/control/src/features/items

The item editor: preparing a new item for a rundown and changing a stored one, for any
graphic. Start reading at `ItemEditorPanel.tsx`; the rundown (features/rundown) opens it.

- `ItemEditorPanel.tsx` — the panel and its buttons: "Salvar item" (`createItem`, or
  `updateItemFields` with only what changed) and "Atualizar no ar" (then `updateInstanceData`).
- `ItemEditorFormFields.tsx`, `FormFieldRow.tsx`, `itemEditorForm.ts`, `itemColorChip.ts`,
  `itemEditorFormResolver.ts` — the fields every item has, their pt-BR rules and drawing.
- `ItemGraphicFieldsForm.tsx`, `graphicFieldsOfItemEditor.ts` — the fields of the chosen
  graphic, generated from its manifest by features/schemaForm. Nothing here knows a graphic.
- `itemCommandsFromEditor.ts` — the three commands, built without drawing anything;
  `itemsTheServerMayStore.ts`, `storedItemAfterAcceptedSave.ts` — what the next save compares with.
- `itemInstanceOnAir.ts` finds the item's instance on program; `useAskToBeClosedOnce.ts`
  keeps a closed editor from closing twice or sending anything more.
