# apps/server/src/core/store

The in-memory state slices and the single path that changes them. Start at `createStateStore.ts`:
`applyCommand` validates → authorises → applies a reducer → saves (one SQLite transaction) → logs
the event → tells listeners. A command that changes nothing is not saved, logged or broadcast.

- `reducers/` — one pure reducer per command, plus `reduceCommand.ts` choosing it.
- `graphicDataPreparation.ts` (null fields out, `takeTimeFieldKeys` stamped; `graphicSchemaProperties.ts` says which fields may be), `updateRules/` (named pure rules an update runs, e.g. the clock's), then `graphicDataValidation.ts` (manifest schema).
- `authorizeCommand.ts` — a renderer may only report instance status, `sistema:` only clearLayer; `commandActors.ts`: `role:id` actor names.
- `commandRefusals.ts`, `rundownCommandRefusals.ts` — every refusal, its code and pt-BR message.
- `loadInitialSlices.ts` — loads or seeds layers and instances at boot (`seedLayers.ts`), dropping what
  was on the preview output; rebuilds graphics (`discoverBuiltGraphics.ts`, `graphicPlacement.ts`).
- `*.testSupport.ts` — stand-in graphics folders and race-day slices for tests.
- `loadRundownSlices.ts` — loads or seeds rundowns and items (`seedRundowns.ts`); `autoOut.ts` clears
  an item's layer after its delay on air (a preview starts no wait); `resolveItemFields.ts` builds graphic data at the take; `itemTakeTimeFields.ts` refuses a takeTime on a field that is not a wall-clock moment.
