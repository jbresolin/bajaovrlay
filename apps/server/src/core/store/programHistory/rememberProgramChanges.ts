import {
  type LayerProgramHistory,
  type ProgramHistory,
  type ProgramHistoryEntry,
  programHistoryLimitPerLayer,
} from '@bajaovrlay/shared';

import type { SlicesChangedByCommands } from '../reducers/reducerTypes.js';
import { describeWhatProgramShows, findInstanceOnProgramOfLayer } from './whatProgramShowed.js';

/**
 * The programHistory after one command: for each layer whose program output now shows
 * another instance (or none, or one where it showed none), what it showed before, under
 * one new change number shared by every layer the command touched. Run by reduceCommand
 * after every accepted command but an undo, so a take, a clear, "Tomar tudo", a macro
 * step, an auto-out and an event shown are all remembered without any reducer having to
 * remember. A layer that was deleted loses its history. Hands back the very same array
 * when nothing changed, so the store neither saves nor broadcasts it.
 * Deliberate: an edit on air, a refresh of bound fields and "Próximo" keep the instance,
 * so they are not changes to undo; an undo replaces what is on air without remembering
 * it, so there is no redo.
 */
export function rememberProgramChanges(
  slicesBefore: SlicesChangedByCommands,
  slicesAfter: SlicesChangedByCommands,
  changedAt: string,
): ProgramHistory {
  const historyAfterTheCommand = slicesAfter.programHistory;
  const isProgramUntouched =
    slicesBefore.instances === slicesAfter.instances && slicesBefore.layers === slicesAfter.layers;
  if (isProgramUntouched) {
    return historyAfterTheCommand;
  }

  const changeNumber = findNewestChangeNumber(historyAfterTheCommand) + 1;
  let historyByLayer = keepHistoriesOfLayersStillThere(
    historyAfterTheCommand,
    slicesAfter.layers.map((layer) => layer.id),
  );
  for (const layer of slicesAfter.layers) {
    const instanceBefore = findInstanceOnProgramOfLayer(slicesBefore.instances, layer.id);
    const instanceAfter = findInstanceOnProgramOfLayer(slicesAfter.instances, layer.id);
    const isSameInstance = instanceBefore?.id === instanceAfter?.id;
    if (isSameInstance) {
      continue;
    }
    const shownBefore = describeWhatProgramShows(instanceBefore, slicesBefore.items);
    // An instance taken by hand before BAJAOVRLAY-37 names no item, so it can never come
    // back. The layer forgets everything older too: an undo must never skip over it and
    // bring back something that was not on air just before.
    if (shownBefore === undefined) {
      historyByLayer = replaceEntriesOfLayer(historyByLayer, layer.id, []);
      continue;
    }
    const newEntry: ProgramHistoryEntry = { changeNumber, changedAt, shownBefore };
    const entriesBefore = findEntriesOfLayer(historyByLayer, layer.id);
    const entriesWithTheNewOne = [...entriesBefore, newEntry];
    const entriesWithinTheLimit = entriesWithTheNewOne.slice(-programHistoryLimitPerLayer);
    historyByLayer = replaceEntriesOfLayer(historyByLayer, layer.id, entriesWithinTheLimit);
  }
  return historyByLayer;
}

/** The highest change number any layer remembers, 0 when none remembers anything. */
export function findNewestChangeNumber(programHistory: ProgramHistory): number {
  let newestChangeNumber = 0;
  for (const layerHistory of programHistory) {
    const newestOfLayer = layerHistory.entries.at(-1)?.changeNumber ?? 0;
    newestChangeNumber = Math.max(newestChangeNumber, newestOfLayer);
  }
  return newestChangeNumber;
}

/** A layer's remembered changes, oldest first; empty when it remembers none. */
export function findEntriesOfLayer(
  programHistory: ProgramHistory,
  layerId: string,
): ProgramHistoryEntry[] {
  const layerHistory = programHistory.find((candidate) => candidate.layerId === layerId);
  return layerHistory?.entries ?? [];
}

/**
 * The history with one layer's entries replaced. A layer left with no entry is taken out,
 * so the slice lists only layers with something to undo; a layer not there yet is added.
 */
export function replaceEntriesOfLayer(
  programHistory: ProgramHistory,
  layerId: string,
  entries: ProgramHistoryEntry[],
): ProgramHistory {
  const otherLayers = programHistory.filter((layerHistory) => layerHistory.layerId !== layerId);
  const isAlreadyListed = otherLayers.length !== programHistory.length;
  if (entries.length === 0) {
    // Hand back the same array when there was nothing to take out, so nothing is saved.
    return isAlreadyListed ? otherLayers : programHistory;
  }
  const historyOfTheLayer: LayerProgramHistory = { layerId, entries };
  if (!isAlreadyListed) {
    return [...programHistory, historyOfTheLayer];
  }
  return programHistory.map((layerHistory) =>
    layerHistory.layerId === layerId ? historyOfTheLayer : layerHistory,
  );
}

/** The history without the layers that no longer exist; the same array if none went. */
function keepHistoriesOfLayersStillThere(
  programHistory: ProgramHistory,
  layerIdsNow: string[],
): ProgramHistory {
  const historiesKept = programHistory.filter((layerHistory) =>
    layerIdsNow.includes(layerHistory.layerId),
  );
  return historiesKept.length === programHistory.length ? programHistory : historiesKept;
}
