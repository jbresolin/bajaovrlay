# apps/server/src/core/store

The in-memory state slices and the single path that changes them. Start at `createStateStore.ts`:
`applyCommand` validates → authorises → applies a reducer → saves (one SQLite transaction) → logs
the event → tells listeners. A command that changes nothing is not saved, logged or broadcast.

- `reducers/` — one pure reducer per command, plus `reduceCommand.ts` choosing it.
- `graphicDataValidation.ts` — checks a take's or update's data against the manifest's schema.
- `authorizeCommand.ts` — a renderer may only report instance status, nobody else may; `commandActors.ts`: `role:id` actor names.
- `commandRefusals.ts`, `rundownCommandRefusals.ts` — every refusal, its code and pt-BR message.
- `loadInitialSlices.ts` — loads or seeds layers and instances at boot (`seedLayers.ts`); rebuilds
  graphics (`discoverBuiltGraphics.ts`), placed by `v_baja` (`graphicPlacement.ts`).
- `*.testSupport.ts` — stand-in graphics folders and race-day slices for tests.
- `loadRundownSlices.ts` — loads or seeds rundowns and items (`seedRundowns.ts`); `autoOut.ts` clears
  an item's layer after its delay; `resolveItemFields.ts` builds graphic data at the take.
