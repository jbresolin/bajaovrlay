# apps/server/src/core/store/reducers

One pure reducer per command: slices + a valid command + a context (ids and time made by the store) in, new
slices or a pt-BR refusal out; no I/O, no clock, no random ids. Start reading at `reduceCommand.ts`, the switch.

- On air: `updateInstanceData.ts` (runs `../updateRules/`), `clearLayer.ts`, `clearAll.ts`. Preview: `previewItem.ts`,
  `stopPreview.ts`, `takePreview.ts`, `previewClearLayer.ts` (the "will be cleared" marker), `takeAllPreviews.ts`
  ("Tomar tudo", one change), `previewMacro.ts` (a macro's end state on preview).
- Rundown and items, via `reduceItemOrRundownCommand.ts`: `createItem.ts`, `updateItemFields.ts`, `deleteItem.ts`,
  `reorderItems.ts`, `moveCursor.ts`, `takeItem.ts`, `takeNext.ts`, `saveOnAirChangesIntoItem.ts` ("Salvar no item").
- Panels, moves and macros, via `reduceQuickFireOrMacroCommand.ts`: the panel commands, `moveItemToHome.ts`, the macro
  commands, `runMacro.ts` (records the run only) and `macroRunBookkeeping.ts` (the runner's two commands).
- Shared: `putGraphicOnOutput.ts` (the internal take step every take and preview ends in; it needs an item id, since
  everything on air comes from an item), `putItemOnOutput.ts` (takeItem and previewItem), `previewPromotion.ts` (preview or marker to program),
  `previewMarkersAndDiscards.ts` (add or remove "vai limpar" marks, empty Prévia), `instanceIdForEachLayer.ts`, `itemOrdering.ts`, `itemHomeExistence.ts`, `rundownCursor.ts`.
- An unchanged slice comes back as the very same array (how the store knows what to save). Tests: `reduceCommand.test.ts` (on air), a `<command>.test.ts` for every other one.
