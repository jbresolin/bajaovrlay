import {
  listLayersOfOutputBottomToTop,
  type ReorderLayersCommand,
  sortLayersBottomToTop,
} from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { refuseLayersNotAPermutation, refuseUnknownOutput } from '../outputRefusals.js';

/**
 * reorderLayers: the drag on "Saídas e camadas". The output's own heights, sorted, are
 * handed out again to its layers in the order sent (bottom to top): the gaps between them
 * stay, no height of another output is touched, and no two layers of the output ever
 * share one. Refused for an output that does not exist and for a list that is not every
 * layer of the output once. The order the output already has changes nothing.
 */
export function reduceReorderLayers(
  slices: SlicesChangedByCommands,
  command: ReorderLayersCommand,
): ReducerOutcome {
  const output = slices.outputs.find((candidate) => candidate.outputId === command.outputId);
  if (output === undefined) {
    return { status: 'refused', error: refuseUnknownOutput(command.outputId) };
  }
  const layersOfTheOutput = listLayersOfOutputBottomToTop(slices.layers, output.outputId);
  const layerIdsOfTheOutput = layersOfTheOutput.map((layer) => layer.id);
  const isEveryLayerOnce =
    command.orderedLayerIds.length === layerIdsOfTheOutput.length &&
    new Set(command.orderedLayerIds).size === command.orderedLayerIds.length &&
    layerIdsOfTheOutput.every((layerId) => command.orderedLayerIds.includes(layerId));
  if (!isEveryLayerOnce) {
    return { status: 'refused', error: refuseLayersNotAPermutation(output) };
  }

  // layersOfTheOutput is bottom to top, so its heights are already in rising order.
  const heightsOfTheOutputBottomToTop = layersOfTheOutput.map((layer) => layer.zIndex);
  const layersAfter = slices.layers.map((layer) => {
    const newPosition = command.orderedLayerIds.indexOf(layer.id);
    if (newPosition === -1) {
      return layer;
    }
    const newHeight = heightsOfTheOutputBottomToTop[newPosition] ?? layer.zIndex;
    return layer.zIndex === newHeight ? layer : { ...layer, zIndex: newHeight };
  });
  const hasAnyLayerMoved = layersAfter.some((layer, index) => layer !== slices.layers[index]);
  if (!hasAnyLayerMoved) {
    return { status: 'applied', slices };
  }
  return { status: 'applied', slices: { ...slices, layers: sortLayersBottomToTop(layersAfter) } };
}
