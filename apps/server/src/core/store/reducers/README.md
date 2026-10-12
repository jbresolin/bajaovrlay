# apps/server/src/core/store/reducers

One pure reducer per command: current slices + a valid command + a context (ids and time
made by the store) in, new slices or a pt-BR refusal out. No I/O, no clock, no random ids.
Start reading at `reduceCommand.ts`, the switch that sends each command to its file.

- On-air commands: `takeGraphic.ts`, `updateInstanceData.ts` (runs `../updateRules/`), `clearLayer.ts`, `clearAll.ts`.
- Rundown and item commands, chosen by `reduceItemOrRundownCommand.ts`: `createItem.ts`,
  `updateItemFields.ts` (both refuse a takeTime field that is not a wall-clock moment, as the take does),
  `deleteItem.ts`, `reorderItems.ts`, `moveCursor.ts`, `takeItem.ts` (calls `takeGraphic.ts`), `takeNext.ts` (calls `takeItem.ts`).
- `itemOrdering.ts` keeps a rundown numbered 0, 1, 2, ...; `rundownCursor.ts` moves "next".
- `reducerTypes.ts` — the slices a command may change, the context and the outcome.
- An unchanged slice is handed back as the very same array: how the store knows what to save.
- Tests: `reduceCommand.test.ts` for the on-air commands, one `<command>.test.ts` for each
  rundown command (their data comes from `rundownSlices.testSupport.ts`).
