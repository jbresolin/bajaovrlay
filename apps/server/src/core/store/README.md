# apps/server/src/core/store

The in-memory state slices and the single path that changes them. Start reading at
`createStateStore.ts`: `applyCommand` validates → authorises → applies a reducer →
saves (one SQLite transaction) → appends to the event log → tells listeners.

- `reducers/` — one pure reducer per command, plus `reduceCommand.ts` choosing it.
- `graphicDataValidation.ts` — checks a take's or update's data against the manifest's schema.
- `authorizeCommand.ts` — the authorisation hook: a renderer may only report instance
  status, nobody else may. `commandActors.ts` builds and reads the `role:id` actor names.
- `commandRefusals.ts` — every refusal, with its code and pt-BR message.
- `loadInitialSlices.ts` — loads layers and instances at boot, or seeds an empty
  database (`seedLayers.ts`); rebuilds graphics every boot (`discoverBuiltGraphics.ts`),
  each placed by its manifest's `v_baja` field (`graphicPlacement.ts`).
- `*.testSupport.ts` — stand-in graphics folders and race-day slices for tests.
