import { type CreateLayerCommand, type Layer, sortLayersBottomToTop } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import {
  refuseHeightTaken,
  refuseLayerAlreadyThere,
  refuseUnknownOutput,
} from '../outputRefusals.js';
import { findLayerAtHeightOfOutput } from './layerHeights.js';

/**
 * createLayer: adds a layer to an output, with the id the page made, in its z-order place.
 * Refused, in this order, for an id another layer has, an output that does not exist,
 * and a height another layer of that output has (named). Renderers connected to that
 * output rebuild their containers from the slice, so the layer is there at once.
 */
export function reduceCreateLayer(
  slices: SlicesChangedByCommands,
  command: CreateLayerCommand,
): ReducerOutcome {
  const layerWithThatId = slices.layers.find((layer) => layer.id === command.layerId);
  if (layerWithThatId !== undefined) {
    return { status: 'refused', error: refuseLayerAlreadyThere(layerWithThatId) };
  }
  const output = slices.outputs.find((candidate) => candidate.outputId === command.outputId);
  if (output === undefined) {
    return { status: 'refused', error: refuseUnknownOutput(command.outputId) };
  }
  const layerAtThatHeight = findLayerAtHeightOfOutput(
    slices.layers,
    output.outputId,
    command.zIndex,
    command.layerId,
  );
  if (layerAtThatHeight !== undefined) {
    return {
      status: 'refused',
      error: refuseHeightTaken(command.zIndex, output, layerAtThatHeight, command.name),
    };
  }

  const newLayer: Layer = {
    id: command.layerId,
    outputId: output.outputId,
    name: command.name,
    zIndex: command.zIndex,
    replacePolicy: command.replacePolicy,
    persistent: command.persistent,
  };
  return {
    status: 'applied',
    slices: { ...slices, layers: sortLayersBottomToTop([...slices.layers, newLayer]) },
  };
}
