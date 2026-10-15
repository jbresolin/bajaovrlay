import type { DeleteMacroCommand } from '@bajaovrlay/shared';

import { refuseEditOfRunningMacro, refuseUnknownMacro } from '../quickFireAndMacroRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * deleteMacro: removes a macro. Refused if it does not exist, or while it is running
 * (a running button with no macro behind it would leave the operator guessing; wait
 * for the run to end, which a ten-second wait at most keeps short).
 */
export function reduceDeleteMacro(
  slices: SlicesChangedByCommands,
  command: DeleteMacroCommand,
): ReducerOutcome {
  const macro = slices.macros.find((candidate) => candidate.id === command.macroId);
  if (macro === undefined) {
    return { status: 'refused', error: refuseUnknownMacro(command.macroId) };
  }
  const isThisMacroRunning = slices.macroRuns.some((run) => run.macroId === macro.id);
  if (isThisMacroRunning) {
    return { status: 'refused', error: refuseEditOfRunningMacro(macro.label) };
  }
  const macrosAfter = slices.macros.filter((candidate) => candidate.id !== macro.id);
  return { status: 'applied', slices: { ...slices, macros: macrosAfter } };
}
