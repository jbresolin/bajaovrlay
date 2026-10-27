import { type DeleteLayerCommand, type Graphic, programOutputId } from '@bajaovrlay/shared';

import { refuseUnknownLayer } from '../../../core/store/commandRefusals.js';
import { layerIdOfUnplacedGraphics } from '../../../core/store/graphicPlacement.js';
import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { describeUsesOfTheLayer, describeWhatIsOnTheLayer } from '../layerUses.js';
import {
  refuseChangeOfTheFallbackLayer,
  refuseLayerInUse,
  refuseLayerNotEmpty,
} from '../outputRefusals.js';

/**
 * deleteLayer: removes a layer nothing uses. Refused, in this order, for a layer that
 * does not exist, for the fullscreen layer (the fallback of every graphic, kept as program
 * is; gate 2 of PR #32), while anything is on it (on air, in preview, marked "vai
 * limpar"), and while items, quick-fire buttons, macro steps or event rules name it,
 * every one listed (layerUses.ts). A graphic whose default layer it was is not a use: it
 * falls back to the fullscreen layer, as at boot (graphicPlacement.ts), and the outcome
 * names it so the store logs a warning.
 */
export function reduceDeleteLayer(
  slices: SlicesChangedByCommands,
  command: DeleteLayerCommand,
): ReducerOutcome {
  const layer = slices.layers.find((candidate) => candidate.id === command.layerId);
  if (layer === undefined) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }
  if (layer.id === layerIdOfUnplacedGraphics) {
    const program = slices.outputs.find((output) => output.outputId === programOutputId);
    return { status: 'refused', error: refuseChangeOfTheFallbackLayer(layer, program) };
  }
  const whatIsOnTheLayer = describeWhatIsOnTheLayer(slices, layer.id);
  if (whatIsOnTheLayer.length > 0) {
    return { status: 'refused', error: refuseLayerNotEmpty(layer, 'delete', whatIsOnTheLayer) };
  }
  const usesOfTheLayer = describeUsesOfTheLayer(slices, layer);
  if (usesOfTheLayer.length > 0) {
    return { status: 'refused', error: refuseLayerInUse(layer, usesOfTheLayer) };
  }

  const layersKept = slices.layers.filter((candidate) => candidate !== layer);
  const graphicsToPlaceAgain = slices.graphics.filter(
    (graphic) => graphic.defaultLayerId === layer.id,
  );
  if (graphicsToPlaceAgain.length === 0) {
    return { status: 'applied', slices: { ...slices, layers: layersKept } };
  }
  const graphicsAfter = slices.graphics.map((graphic): Graphic =>
    graphic.defaultLayerId === layer.id
      ? { ...graphic, defaultLayerId: layerIdOfUnplacedGraphics }
      : graphic,
  );
  return {
    status: 'applied',
    slices: { ...slices, layers: layersKept, graphics: graphicsAfter },
    graphicsPlacedOnTheFallbackLayer: graphicsToPlaceAgain.map((graphic) => graphic.id),
  };
}
