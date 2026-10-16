import type { StopMacroCommand } from '@bajaovrlay/shared';

import { refuseUnknownMacro } from '../quickFireAndMacroRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * stopMacro: marks the macro's run `isStopRequested: true`. It ends nothing itself: the
 * macro runner (../macroRunner.ts) sees the mark, sends no step after the one in
 * progress, cuts a wait short and ends the run with endMacroRun.
 * Refused only for an unknown macro. A macro that is not running, or a run already
 * marked, hands back the same slices (answered ok, no trace): a page that has not yet
 * seen the run end must not show the operator an error for a run that is already over.
 */
export function reduceStopMacro(
  slices: SlicesChangedByCommands,
  command: StopMacroCommand,
): ReducerOutcome {
  const isKnownMacro = slices.macros.some((candidate) => candidate.id === command.macroId);
  if (!isKnownMacro) {
    return { status: 'refused', error: refuseUnknownMacro(command.macroId) };
  }
  const run = slices.macroRuns.find((candidate) => candidate.macroId === command.macroId);
  if (run === undefined || run.isStopRequested) {
    return { status: 'applied', slices };
  }

  const runsAfter = slices.macroRuns.map((candidate) =>
    candidate.macroId === command.macroId ? { ...candidate, isStopRequested: true } : candidate,
  );
  return { status: 'applied', slices: { ...slices, macroRuns: runsAfter } };
}
