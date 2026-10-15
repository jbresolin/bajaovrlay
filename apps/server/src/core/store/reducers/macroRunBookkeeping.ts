// The reducers of the two commands only the macro runner sends: advanceMacroRun and
// endMacroRun. Neither is ever refused: the runner sends them for a run it started, and
// one about a macro that is not running (late, after a restart) changes nothing and is
// answered ok, leaving no trace, as a late reportInstanceStatus does.
import type { AdvanceMacroRunCommand, EndMacroRunCommand } from '@bajaovrlay/shared';

import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * advanceMacroRun: sets the step a running macro is at. The step it is already at, or a
 * macro that is not running, hands back the same slices.
 */
export function reduceAdvanceMacroRun(
  slices: SlicesChangedByCommands,
  command: AdvanceMacroRunCommand,
): ReducerOutcome {
  const run = slices.macroRuns.find((candidate) => candidate.macroId === command.macroId);
  if (run === undefined || run.currentStep === command.currentStep) {
    return { status: 'applied', slices };
  }
  const runsAfter = slices.macroRuns.map((candidate) =>
    candidate.macroId === command.macroId
      ? { ...candidate, currentStep: command.currentStep }
      : candidate,
  );
  return { status: 'applied', slices: { ...slices, macroRuns: runsAfter } };
}

/**
 * endMacroRun: removes a macro's run, whatever its outcome. A macro that is not running
 * hands back the same slices.
 */
export function reduceEndMacroRun(
  slices: SlicesChangedByCommands,
  command: EndMacroRunCommand,
): ReducerOutcome {
  const isRunning = slices.macroRuns.some((candidate) => candidate.macroId === command.macroId);
  if (!isRunning) {
    return { status: 'applied', slices };
  }
  const runsAfter = slices.macroRuns.filter((candidate) => candidate.macroId !== command.macroId);
  return { status: 'applied', slices: { ...slices, macroRuns: runsAfter } };
}
