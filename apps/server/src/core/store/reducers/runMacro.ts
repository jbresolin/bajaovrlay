import type { RunMacroCommand } from '@bajaovrlay/shared';

import { startMacroRun } from './macroRunStart.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * runMacro: one press of a macro's button. It records the run and runs no step itself: a
 * reducer is pure and a wait takes time, so the steps are sent one by one by the macro
 * runner (../macroRunner.ts), which watches the `macroRuns` slice. Its rules (unknown
 * macro, another macro running, an item filled by an event, Prévia emptied) are those of
 * every start of a run, written once in macroRunStart.ts.
 */
export function reduceRunMacro(
  slices: SlicesChangedByCommands,
  command: RunMacroCommand,
  context: ReducerContext,
): ReducerOutcome {
  return startMacroRun(slices, command.macroId, context);
}
