# apps/control/src/features/items

The item editor: preparing a new item for a rundown and changing a stored one. Start
reading at `ItemEditorPanel.tsx`; the rundown (features/rundown) opens it.

- `ItemEditorPanel.tsx` — the panel and "Salvar item": `createItem` for a new item,
  `updateItemFields` with only what changed for a stored one.
- `ItemEditorFormFields.tsx` draws the fields every item has; `itemColorChip.ts` gives
  each colour its chip; `itemEditorForm.ts` holds their values and rules (pt-BR), which
  `itemEditorFormResolver.ts` hands to react-hook-form.
- `raceClockItemFields.ts` — the race clock form to stored literals and back, and how a
  prepared clock behaves when taken later. The race clock fields themselves are the
  take panel's (features/playout), imported, not copied.
- `itemCommandsFromForm.ts` — the two commands, built without drawing anything.
  Only the race clock has fields here; BAJAOVRLAY-14 generates them for every graphic.
