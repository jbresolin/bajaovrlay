# apps/server/src/core/store/reducers

One pure reducer per command: slices + a valid command + a context (ids and time made by the store) in, new
slices or a pt-BR refusal out; no I/O, no clock, no random ids. Start reading at `reduceCommand.ts`, the switch.

- On-air commands: `takeGraphic.ts`, `updateInstanceData.ts` (runs `../updateRules/`), `clearLayer.ts`, `clearAll.ts`.
- Preview: `previewItem.ts` (origin `auto` removes the other `auto` previews), `previewGraphic.ts`,
  `stopPreview.ts`, `takePreview.ts` (sends the previewed data as it is, stamping only its `takeTimeFieldKeys`).
- Rundown and item commands, chosen by `reduceItemOrRundownCommand.ts`: `createItem.ts`, `updateItemFields.ts`
  (both refuse a takeTime field that is not a wall-clock moment), `deleteItem.ts`, `reorderItems.ts`,
  `moveCursor.ts`, `takeItem.ts`, `takeNext.ts` (calls `takeItem.ts`).
- `putItemOnOutput.ts` — the one path takeItem and previewItem share; every take ends in `takeGraphic.ts`.
- `itemOrdering.ts` numbers a rundown 0, 1, 2, ...; `rundownCursor.ts` moves "next"; `reducerTypes.ts`.
- An unchanged slice is handed back as the very same array: how the store knows what to save.
- Tests: `reduceCommand.test.ts` for the on-air commands, a `<command>.test.ts` for every other one.
