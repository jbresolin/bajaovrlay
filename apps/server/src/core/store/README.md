# apps/server/src/core/store

The in-memory state slices and the single path that changes them. Start reading at
`createStateStore.ts`: `applyCommand` validates → authorises → applies a reducer →
saves (one SQLite transaction) → appends to the event log → tells listeners.

- `reducers/` — one pure reducer per command, plus `reduceCommand.ts` choosing it.
- `authorizeCommand.ts` — the authorisation hook (allows everything until login).
- `commandRefusals.ts` — every refusal, with its code and pt-BR message.
- `loadInitialSlices.ts` — loads slices at boot, or seeds an empty database
  (`seedLayers.ts`, `readRaceClockGraphic.ts`).
- `raceClockManifest.testSupport.ts` — a stand-in race-clock manifest for tests.
