# apps/server/src/core/store

The in-memory state slices and the single path that changes them. Start at `createStateStore.ts`:
`applyCommand` validates → authorises → applies a reducer → saves (one SQLite transaction) → logs
the event → tells listeners. A command that changes nothing is not saved, logged or broadcast; a
routine data-source poll (one that leaves its source's health as it was) is saved and broadcast
but not logged (decision D11, `isLeftOutOfTheEventLog`).

- `reducers/` — one pure reducer per command, plus `reduceCommand.ts` choosing it; the data-source reducers live in `../../modules/dataSources/`, reached through its `index.ts`.
- `graphicDataPreparation.ts` (null fields out, `takeTimeFieldKeys` stamped; `graphicSchemaProperties.ts` says which fields may be), `updateRules/` (named pure rules an update runs, e.g. the clock's), then `graphicDataValidation.ts` (manifest schema).
- `authorizeCommand.ts` — a renderer may only report instance status, `sistema:macro:<id>` only a step's command and its run's bookkeeping, `sistema:macro-watchdog` only endMacroRun, `sistema:fonte:<sourceId>` only recordDataSourcePoll of its own source, `sistema:gravador` only stopRecording and recordRecordingProgress, other `sistema:` only clearLayer; operators never recordDataSourcePoll, recordRecordingProgress or a stopRecording with a failureMessage; `commandActors.ts`: `role:id` actor names.
- `commandRefusals.ts`, `rundownCommandRefusals.ts`, `quickFireAndMacroRefusals.ts`, `previewRefusals.ts` — every refusal, its code and pt-BR message.
- `loadInitialSlices.ts` — loads or seeds layers and instances at boot (`seedLayers.ts`), dropping what was on the preview output; rebuilds graphics (`discoverBuiltGraphics.ts`, `graphicPlacement.ts`).
- `loadRundownSlices.ts` — loads or seeds rundowns and items (`seedRundowns.ts`), converting older items to their `home` first (`itemHomeMigration.ts`); `loadQuickFireAndMacroSlices.ts` — panels (`seedQuickFirePanels.ts`) and macros; `macroRuns` and `previewClearedLayerIds` are memory only (empty at boot).
- `macroRunner.ts` — sends a running macro's steps through `applyCommand`, signed `sistema:macro:<id>`, and ends a run on "Parar" (stopMacro); `macroRunWatchdog.ts` ends a run still listed at its waits + 30 s; `autoOut.ts` clears
  an item's layer after its delay on air (a preview starts no wait); `resolveItemFields.ts` builds graphic data at the take; `itemTakeTimeFields.ts` refuses a takeTime on a field that is not a wall-clock moment.
- `*.testSupport.ts` — stand-in graphics folders, race-day slices, a store with a macro runner and a race clock item created on a store (`raceClockItemOnTheStore.testSupport.ts`, for a take through the store), for tests.
