import { type Layer, sortLayersBottomToTop, type UpdateLayerCommand } from '@bajaovrlay/shared';

import { refuseUnknownLayer } from '../../../core/store/commandRefusals.js';
import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { refuseHeightTaken, refuseUnknownOutput } from '../outputRefusals.js';
import { findLayerAtHeightOfOutput } from './layerHeights.js';

/**
 * updateLayer: changes what the command carries (name, height, replace policy,
 * persistence) and keeps the rest. Allowed with a graphic on the layer: the renderers
 * restack their containers, and the graphic stays on air. Refused for a layer that does
 * not exist and for a height another layer of the same output has (named). Values the
 * layer already has change nothing.
 */
export function reduceUpdateLayer(
  slices: SlicesChangedByCommands,
  command: UpdateLayerCommand,
): ReducerOutcome {
  const layer = slices.layers.find((candidate) => candidate.id === command.layerId);
  if (layer === undefined) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }
  const updatedLayer: Layer = {
    ...layer,
    name: command.name ?? layer.name,
    zIndex: command.zIndex ?? layer.zIndex,
    replacePolicy: command.replacePolicy ?? layer.replacePolicy,
    persistent: command.persistent ?? layer.persistent,
  };
  const isAnythingChanged =
    updatedLayer.name !== layer.name ||
    updatedLayer.zIndex !== layer.zIndex ||
    updatedLayer.replacePolicy !== layer.replacePolicy ||
    updatedLayer.persistent !== layer.persistent;
  if (!isAnythingChanged) {
    return { status: 'applied', slices };
  }

  const layerAtThatHeight = findLayerAtHeightOfOutput(
    slices.layers,
    layer.outputId,
    updatedLayer.zIndex,
    layer.id,
  );
  if (layerAtThatHeight !== undefined) {
    // The layer's output exists: deleteOutput refuses an output that still has layers.
    const output = slices.outputs.find((candidate) => candidate.outputId === layer.outputId);
    if (output === undefined) {
      return { status: 'refused', error: refuseUnknownOutput(layer.outputId) };
    }
    return {
      status: 'refused',
      error: refuseHeightTaken(updatedLayer.zIndex, output, layerAtThatHeight, updatedLayer.name),
    };
  }

  const layersAfter = slices.layers.map((candidate) =>
    candidate === layer ? updatedLayer : candidate,
  );
  return { status: 'applied', slices: { ...slices, layers: sortLayersBottomToTop(layersAfter) } };
}
