# apps/server/src/core/store

The in-memory state slices and the single path that changes them. Start reading at
`createStateStore.ts`: `applyCommand` validates → authorises → applies a reducer →
saves (one SQLite transaction) → appends to the event log → tells listeners.

- `reducers/` — one pure reducer per command, plus `reduceCommand.ts` choosing it.
- `authorizeCommand.ts` — the authorisation hook (allows everything until login).
- `commandRefusals.ts` — every refusal, with its code and pt-BR message.
- `loadInitialSlices.ts` — loads layers and instances at boot, or seeds an empty
  database (`seedLayers.ts`); rebuilds graphics every boot (`discoverBuiltGraphics.ts`).
- `builtGraphicsFolder.testSupport.ts` — stand-in graphics folders for tests.
- Rundowns and items: `loadRundownSlices.ts` loads or seeds them (`seedRundowns.ts`);
  `resolveItemFields.ts` turns an item's fields into graphic data at the take; `autoOut.ts`
  clears an item's layer after its delay; `rundownCommandRefusals.ts` holds their refusals.
