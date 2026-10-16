import { isDeepStrictEqual } from 'node:util';

import type { Macro, UpdateMacroCommand } from '@bajaovrlay/shared';

import { refuseEditOfRunningMacro, refuseUnknownMacro } from '../quickFireAndMacroRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * updateMacro: changes what the command carries (label, colour, steps); `steps` replaces
 * the whole list. Refused if the macro does not exist, or while it is running: the runner
 * works from the steps it had at the press, and an edit mid-run would make the button
 * say one thing while the screen does another. An update that leaves the macro as it was
 * (compared by content) hands back the same slices, so it leaves no trace.
 */
export function reduceUpdateMacro(
  slices: SlicesChangedByCommands,
  command: UpdateMacroCommand,
): ReducerOutcome {
  const macro = slices.macros.find((candidate) => candidate.id === command.macroId);
  if (macro === undefined) {
    return { status: 'refused', error: refuseUnknownMacro(command.macroId) };
  }
  const isThisMacroRunning = slices.macroRuns.some((run) => run.macroId === macro.id);
  if (isThisMacroRunning) {
    return { status: 'refused', error: refuseEditOfRunningMacro(macro.label) };
  }

  const updatedMacro: Macro = {
    id: macro.id,
    label: command.label ?? macro.label,
    color: command.color ?? macro.color,
    steps: command.steps ?? macro.steps,
  };
  if (isDeepStrictEqual(updatedMacro, macro)) {
    return { status: 'applied', slices };
  }
  const macrosAfter = slices.macros.map((candidate) =>
    candidate.id === macro.id ? updatedMacro : candidate,
  );
  return { status: 'applied', slices: { ...slices, macros: macrosAfter } };
}
