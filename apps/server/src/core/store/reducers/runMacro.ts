import type { MacroRun, RunMacroCommand } from '@bajaovrlay/shared';

import {
  refuseRunWhileAnotherMacroRuns,
  refuseUnknownMacro,
} from '../quickFireAndMacroRefusals.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * runMacro: records that a macro is running, at step 0, since this command's moment. It
 * runs no step itself: a reducer is pure and a wait takes time, so the steps are sent
 * one by one by the macro runner (../macroRunner.ts), which watches this slice.
 * Refused if the macro does not exist, or while any macro is running, this one
 * included: two runs at once would interleave their steps on the same layers.
 */
export function reduceRunMacro(
  slices: SlicesChangedByCommands,
  command: RunMacroCommand,
  context: ReducerContext,
): ReducerOutcome {
  const macro = slices.macros.find((candidate) => candidate.id === command.macroId);
  if (macro === undefined) {
    return { status: 'refused', error: refuseUnknownMacro(command.macroId) };
  }
  const runInProgress = slices.macroRuns[0];
  if (runInProgress !== undefined) {
    // The running macro is named by its label; by its id if it was deleted meanwhile,
    // which deleteMacro refuses, so only a bug could get there.
    const runningMacro = slices.macros.find((candidate) => candidate.id === runInProgress.macroId);
    const runningMacroLabel = runningMacro?.label ?? runInProgress.macroId;
    return {
      status: 'refused',
      error: refuseRunWhileAnotherMacroRuns(macro.label, runningMacroLabel),
    };
  }

  const newRun: MacroRun = { macroId: macro.id, startedAt: context.now, currentStep: 0 };
  return { status: 'applied', slices: { ...slices, macroRuns: [newRun] } };
}
