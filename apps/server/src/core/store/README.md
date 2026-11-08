# apps/server/src/core/store

The in-memory state slices and the single path that changes them. Start at `createStateStore.ts`:
`applyCommand` validates → authorises → applies a reducer → saves (one SQLite transaction) → logs
the event → tells listeners. The `dataSnapshots` slice is saved one row per source, and listeners are
told which sources' snapshots changed (`dataSnapshotChanges.ts`), so the hub sends only those. A command that changes nothing is not saved, logged or broadcast; a
routine data-source poll (one that leaves its source's health as it was) is saved and broadcast
but not logged (decision D11, `isLeftOutOfTheEventLog`); recordBackup is the other way round,
changing no slice and logged all the same (`isLoggedWithoutAChange`, BAJAOVRLAY-33). `eventLogReaders.ts`
reads older rows and the newest accepted row of one command back from the database.

- `reducers/` — one pure reducer per command, plus `reduceCommand.ts` choosing it; the data-source reducers live in `../../modules/dataSources/`, reached through its `index.ts`.
- `programHistory/` — undo on program (BAJAOVRLAY-30): `rememberProgramChanges.ts`, run by `reduceCommand.ts` after every command but an undo, writes what each layer showed before, and `forgetChangesThatCannotComeBack.ts` drops what names a deleted item or a graphic gone; `undoOnLayer.ts` and `undoLastChangeOnProgram.ts` put it back (`putBackWhatLayerShowed.ts`, through the take's own steps).
- `graphicDataPreparation.ts` (null fields out, `takeTimeFieldKeys` stamped; `graphicSchemaProperties.ts` says which fields may be), `updateRules/` (named pure rules an update runs, e.g. the clock's), then `graphicDataValidation.ts` (manifest schema).
- `authorizeCommand.ts` — a renderer may only report instance status, `sistema:macro:<id>` only a step's command and its run's bookkeeping, `sistema:macro-watchdog` only endMacroRun, `sistema:fonte:<sourceId>` only recordDataSourcePoll of its own source, `sistema:gravador` only stopRecording and recordRecordingProgress, `sistema:gatilhos` only fireTrigger, `sistema:backup` only recordBackup, other `sistema:` only clearLayer; operators never recordDataSourcePoll, recordRecordingProgress, a stopRecording with a failureMessage or a takeItem with a triggerFill; `commandActors.ts`: `role:id` actor names.
- `automationAndTheDataRole.ts` — the second authorise check, against the slices: Dados (BAJAOVRLAY-29) may not set a trigger or an event rule to auto, switch an auto trigger on, change an auto trigger's macro or `when`, an auto rule's item or times, or the steps of a macro an auto trigger runs (gate 2 of PR #51). `stateStoreOptions.ts`: what a store is given.
- `commandEventLogPayload.ts` — what an event-log row stores as a command's name and payload (a poll's shapes left out).
- `commandRefusals.ts`, `rundownCommandRefusals.ts`, `quickFireAndMacroRefusals.ts`, `previewRefusals.ts` — every refusal, its code and pt-BR message.
- `loadInitialSlices.ts` — loads or seeds layers and instances at boot (`seedLayers.ts`), dropping what was on the preview output; rebuilds graphics (`discoverBuiltGraphics.ts`, `graphicPlacement.ts`).
- `loadRundownSlices.ts` — loads or seeds rundowns and items (`seedRundowns.ts`), converting older items to their `home` first (`itemHomeMigration.ts`); `loadQuickFireAndMacroSlices.ts` — panels (`seedQuickFirePanels.ts`) and macros; `macroRuns` and `previewClearedLayerIds` are memory only (empty at boot).
- `macroRunner.ts` — sends a running macro's steps through `applyCommand`, signed `sistema:macro:<id>` (a take step's trigger fields with the run's trigger data; `reducers/macroRunStart.ts` is the one start of a run, `itemTriggerFields.ts` lays the data over an item's fields), and ends a run on "Parar" (stopMacro); `macroRunWatchdog.ts` ends a run still listed at its waits + 30 s; `autoOut.ts` clears
  an item's layer after its delay on air (a preview starts no wait); `resolveItemFields.ts` builds graphic data at the take; `itemTakeTimeFields.ts` refuses a takeTime on a field that is not a wall-clock moment.
- `*.testSupport.ts` — stand-in graphics folders, race-day slices, a store with a macro runner and a race clock item created on a store (`raceClockItemOnTheStore.testSupport.ts`, for a take through the store), for tests.
