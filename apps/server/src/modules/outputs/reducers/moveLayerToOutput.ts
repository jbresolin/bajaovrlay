import { type MoveLayerToOutputCommand, sortLayersBottomToTop } from '@bajaovrlay/shared';

import { refuseUnknownLayer } from '../../../core/store/commandRefusals.js';
import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { describeWhatIsOnTheLayer } from '../layerUses.js';
import { refuseHeightTaken, refuseLayerNotEmpty, refuseUnknownOutput } from '../outputRefusals.js';
import { findLayerAtHeightOfOutput } from './layerHeights.js';

/**
 * moveLayerToOutput: moves a layer to another output, keeping its id, name and height,
 * so every item, button and macro step that names it now draws on that output. Refused,
 * in this order, for a layer or output that does not exist, while anything is on the
 * layer (on air, in preview, marked "vai limpar": it would jump from one OBS source to
 * another), and when the other output has a layer at that height (named). A move to the
 * output the layer is on changes nothing.
 */
export function reduceMoveLayerToOutput(
  slices: SlicesChangedByCommands,
  command: MoveLayerToOutputCommand,
): ReducerOutcome {
  const layer = slices.layers.find((candidate) => candidate.id === command.layerId);
  if (layer === undefined) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }
  const targetOutput = slices.outputs.find((candidate) => candidate.outputId === command.outputId);
  if (targetOutput === undefined) {
    return { status: 'refused', error: refuseUnknownOutput(command.outputId) };
  }
  if (layer.outputId === targetOutput.outputId) {
    return { status: 'applied', slices };
  }
  const whatIsOnTheLayer = describeWhatIsOnTheLayer(slices, layer.id);
  if (whatIsOnTheLayer.length > 0) {
    return { status: 'refused', error: refuseLayerNotEmpty(layer, 'move', whatIsOnTheLayer) };
  }
  const layerAtThatHeight = findLayerAtHeightOfOutput(
    slices.layers,
    targetOutput.outputId,
    layer.zIndex,
    layer.id,
  );
  if (layerAtThatHeight !== undefined) {
    return {
      status: 'refused',
      error: refuseHeightTaken(layer.zIndex, targetOutput, layerAtThatHeight, layer.name),
    };
  }

  const layersAfter = slices.layers.map((candidate) =>
    candidate === layer ? { ...candidate, outputId: targetOutput.outputId } : candidate,
  );
  return { status: 'applied', slices: { ...slices, layers: sortLayersBottomToTop(layersAfter) } };
}
