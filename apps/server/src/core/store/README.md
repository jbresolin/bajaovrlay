# apps/server/src/core/store

The in-memory state slices and the single path that changes them. Start reading at
`createStateStore.ts`: `applyCommand` validates → authorises → applies a reducer → saves
(one SQLite transaction) → appends to the event log → tells listeners. An accepted command
that changes nothing stops after the reducer: nothing is saved, logged or broadcast.

- `reducers/` — one pure reducer per command, plus `reduceCommand.ts` choosing it.
- `graphicDataValidation.ts` — checks a take's or update's data against the manifest's schema.
- `authorizeCommand.ts` — the authorisation hook: a renderer may only report instance
  status, nobody else may. `commandActors.ts` builds and reads the `role:id` actor names.
- `commandRefusals.ts` — every refusal, with its code and pt-BR message.
- `loadInitialSlices.ts` — loads or seeds layers and instances at boot (`seedLayers.ts`);
  rebuilds graphics (`discoverBuiltGraphics.ts`), placed by `v_baja` (`graphicPlacement.ts`).
- `*.testSupport.ts` — stand-in graphics folders and race-day slices for tests.
