import type { UndoOnLayerCommand } from '@bajaovrlay/shared';

import { ptBR } from '../../messages/ptBR.js';
import { refuseUnknownLayer } from '../commandRefusals.js';
import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../reducers/reducerTypes.js';
import { putBackWhatLayerShowed } from './putBackWhatLayerShowed.js';
import { findEntriesOfLayer, replaceEntriesOfLayer } from './rememberProgramChanges.js';

/**
 * undoOnLayer, "Desfazer" on a Camadas row (BAJAOVRLAY-30): puts back what the layer's
 * program output showed before its last change (putBackWhatLayerShowed.ts) and forgets
 * that change. Refused when the layer does not exist, when it has nothing to undo, and
 * whenever putting it back is refused (a take of the item refused; an entry naming a
 * deleted item or graphic is forgotten before it can jam the layer, see
 * forgetChangesThatCannotComeBack.ts);
 * nothing changes then, and the change stays remembered.
 */
export function reduceUndoOnLayer(
  slices: SlicesChangedByCommands,
  command: UndoOnLayerCommand,
  context: ReducerContext,
): ReducerOutcome {
  const layer = slices.layers.find((candidate) => candidate.id === command.layerId);
  if (layer === undefined) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }
  const entries = findEntriesOfLayer(slices.programHistory, layer.id);
  const lastChange = entries.at(-1);
  if (lastChange === undefined) {
    return {
      status: 'refused',
      error: {
        code: 'NOTHING_TO_UNDO',
        message: ptBR.programHistoryErrors.nothingToUndoOnLayer(layer.name),
      },
    };
  }

  const putBackOutcome = putBackWhatLayerShowed(slices, layer.id, lastChange.shownBefore, context);
  if (putBackOutcome.status === 'refused') {
    return putBackOutcome;
  }
  const entriesWithoutTheLastChange = entries.slice(0, -1);
  return {
    status: 'applied',
    slices: {
      ...putBackOutcome.slices,
      programHistory: replaceEntriesOfLayer(
        slices.programHistory,
        layer.id,
        entriesWithoutTheLastChange,
      ),
    },
  };
}
