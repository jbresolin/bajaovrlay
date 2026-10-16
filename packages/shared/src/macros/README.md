# packages/shared/src/macros

Macros: one button that runs several steps in a row. Start reading at `macroStep.ts`
(a step is `takeItem`, `clearLayer`, `clearAll` or `wait`, whole milliseconds from 1
to 10 000), then `macro.ts` (the `macros` slice) and `macroRun.ts` (the `macroRuns`
slice: the macro running now and its current step; memory only on the server).

One file per operator command (`createMacro.ts`, `updateMacro.ts`, `deleteMacro.ts`,
`runMacro.ts`, `stopMacro.ts` for "Parar"). `macroRunBookkeeping.ts` holds the two
commands only the server sends (`advanceMacroRun`, `endMacroRun`; the runner, and the
watchdog for endMacroRun). All are in the `Command` union
of `../commands/command.ts`; their rules live in the server's reducers, and the runner
is apps/server/src/core/store/macroRunner.ts.

`index.ts` lists every export of this folder; the package's `src/index.ts` re-exports it.
