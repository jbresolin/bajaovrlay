import type { DeleteMacroCommand } from '@bajaovrlay/shared';

import { ptBR } from '../../messages/ptBR.js';
import { refuseEditOfRunningMacro, refuseUnknownMacro } from '../quickFireAndMacroRefusals.js';
import { dropTheStopOfMacro } from './macroStops.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * deleteMacro: removes a macro. Refused if it does not exist, or while it is running
 * (a running button with no macro behind it would leave the operator guessing; wait
 * for the run to end, which a ten-second wait at most keeps short). Refused too while a
 * trigger names it (BAJAOVRLAY-48), listing the triggers as a layer's delete lists what
 * uses the layer: a trigger left naming no macro would fire into nothing on race day.
 * Where its last run stopped short goes with it.
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
  const namesOfTriggersNamingIt = slices.triggers
    .filter((trigger) => trigger.macroId === macro.id)
    .map((trigger) => trigger.name);
  if (namesOfTriggersNamingIt.length > 0) {
    return {
      status: 'refused',
      error: {
        code: 'MACRO_USED_BY_TRIGGER',
        message: ptBR.triggers.macroUsedByTriggers(macro.label, namesOfTriggersNamingIt),
      },
    };
  }
  const macrosAfter = slices.macros.filter((candidate) => candidate.id !== macro.id);
  const macroStopsAfter = dropTheStopOfMacro(slices.macroStops, macro.id);
  return {
    status: 'applied',
    slices: { ...slices, macros: macrosAfter, macroStops: macroStopsAfter },
  };
}
