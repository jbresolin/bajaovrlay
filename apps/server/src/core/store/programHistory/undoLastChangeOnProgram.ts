import type { ProgramHistory } from '@bajaovrlay/shared';

import { ptBR } from '../../messages/ptBR.js';
import { buildContextForInstanceOnLayer } from '../reducers/instanceIdForEachLayer.js';
import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../reducers/reducerTypes.js';
import { putBackWhatLayerShowed } from './putBackWhatLayerShowed.js';
import { findNewestChangeNumber, replaceEntriesOfLayer } from './rememberProgramChanges.js';

/**
 * undoLastChangeOnProgram, "Desfazer última" and Ctrl+Z (BAJAOVRLAY-30): undoes the newest
 * change of program. Every layer whose last remembered change carries the newest change
 * number is put back (putBackWhatLayerShowed.ts) in this one command, so a "Limpar tudo"
 * comes back whole, in one broadcast, and each of those changes is forgotten. Each layer's
 * new instance gets an id of its own (instanceIdForEachLayer.ts).
 * Refused when no layer has anything to undo; and if one layer cannot be put back (a take
 * of its item refused), the whole undo is refused with that layer's reason and nothing
 * changes, so half a "Limpar tudo" never comes back.
 */
export function reduceUndoLastChangeOnProgram(
  slices: SlicesChangedByCommands,
  context: ReducerContext,
): ReducerOutcome {
  const newestChangeNumber = findNewestChangeNumber(slices.programHistory);
  if (newestChangeNumber === 0) {
    return {
      status: 'refused',
      error: { code: 'NOTHING_TO_UNDO', message: ptBR.programHistoryErrors.nothingToUndoAnywhere },
    };
  }
  const layerHistoriesOfTheNewestChange = slices.programHistory.filter(
    (layerHistory) => layerHistory.entries.at(-1)?.changeNumber === newestChangeNumber,
  );

  let slicesSoFar = slices;
  let programHistoryAfter: ProgramHistory = slices.programHistory;
  for (const layerHistory of layerHistoriesOfTheNewestChange) {
    const lastChange = layerHistory.entries.at(-1);
    if (lastChange === undefined) {
      continue;
    }
    const putBackOutcome = putBackWhatLayerShowed(
      slicesSoFar,
      layerHistory.layerId,
      lastChange.shownBefore,
      buildContextForInstanceOnLayer(context, layerHistory.layerId),
    );
    if (putBackOutcome.status === 'refused') {
      return putBackOutcome;
    }
    slicesSoFar = putBackOutcome.slices;
    programHistoryAfter = replaceEntriesOfLayer(
      programHistoryAfter,
      layerHistory.layerId,
      layerHistory.entries.slice(0, -1),
    );
  }
  return { status: 'applied', slices: { ...slicesSoFar, programHistory: programHistoryAfter } };
}
