// Everything about macros that @bajaovrlay/shared exports. The package's own index.ts
// re-exports this file with one line; other packages import from '@bajaovrlay/shared',
// never from here.

// One step of a macro (takeItem, clearLayer, clearAll, wait), and the longest wait.
export { longestMacroWaitMs, type MacroStep, MacroStepSchema } from './macroStep.js';
// The `macros` slice: a label, a colour and the steps, in order.
export { type Macro, MacroSchema } from './macro.js';
// The `macroRuns` slice: the macro running now, since when, and at which step.
export { type MacroRun, MacroRunSchema } from './macroRun.js';
// createMacro: add a macro.
export { type CreateMacroCommand, CreateMacroCommandSchema } from './createMacro.js';
// updateMacro: change a macro's label, colour or whole list of steps.
export { type UpdateMacroCommand, UpdateMacroCommandSchema } from './updateMacro.js';
// deleteMacro: remove a macro that is not running.
export { type DeleteMacroCommand, DeleteMacroCommandSchema } from './deleteMacro.js';
// runMacro: one press of a macro's button.
export { type RunMacroCommand, RunMacroCommandSchema } from './runMacro.js';
// stopMacro: the operator's "Parar", ending a run after the step in progress.
export { type StopMacroCommand, StopMacroCommandSchema } from './stopMacro.js';
// advanceMacroRun and endMacroRun: the server's runner moving a run on and ending it.
export {
  type AdvanceMacroRunCommand,
  AdvanceMacroRunCommandSchema,
  type EndMacroRunCommand,
  EndMacroRunCommandSchema,
} from './macroRunBookkeeping.js';
