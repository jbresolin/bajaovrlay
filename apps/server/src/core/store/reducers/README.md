# apps/server/src/core/store/reducers

One pure reducer per command: slices + a valid command + a context (ids and time made by the store) in, new
slices or a pt-BR refusal out; no I/O, no clock, no random ids. Start reading at `reduceCommand.ts`, the switch.

- On air: `takeGraphic.ts`, `updateInstanceData.ts` (runs `../updateRules/`), `clearLayer.ts`, `clearAll.ts`. Preview:
  `previewItem.ts` (`auto` replaces other `auto` previews), `previewGraphic.ts`, `stopPreview.ts`, `takePreview.ts`.
- Rundown and items, via `reduceItemOrRundownCommand.ts`: `createItem.ts`, `updateItemFields.ts` (both refuse a takeTime
  field that is not a wall-clock moment), `deleteItem.ts`, `reorderItems.ts`, `moveCursor.ts`, `takeItem.ts`, `takeNext.ts`.
- Panels, moves and macros, via `reduceQuickFireOrMacroCommand.ts`: the panel commands, `moveItemToHome.ts`, the macro
  commands, `runMacro.ts` (records the run only) and `macroRunBookkeeping.ts` (the runner's two commands).
- Shared: `putItemOnOutput.ts` (the one path takeItem and previewItem share, ending in `takeGraphic.ts`), `itemOrdering.ts`
  (each home numbered 0, 1, 2, ...), `itemHomeExistence.ts`, `rundownCursor.ts` (moves "next"), `reducerTypes.ts`.
- An unchanged slice comes back as the very same array (how the store knows what to save).
  Tests: `reduceCommand.test.ts` for the on-air commands, a `<command>.test.ts` for every other one.
