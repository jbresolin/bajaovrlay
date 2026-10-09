import type { ClearLayerCommand } from '@bajaovrlay/shared';

import { refuseUnknownLayer } from '../commandRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * clearLayer: removes every instance on the layer, on both outputs. Clearing an empty
 * layer is fine; clearing a layer that does not exist is refused.
 */
export function reduceClearLayer(
  slices: SlicesChangedByCommands,
  command: ClearLayerCommand,
): ReducerOutcome {
  const layerExists = slices.layers.some((layer) => layer.id === command.layerId);
  if (!layerExists) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }

  // Instances are removed at once rather than marked `stopping`: nothing in M0 would
  // ever move them on from `stopping`, because the renderer does not acknowledge yet.
  const instancesOnOtherLayers = slices.instances.filter(
    (instance) => instance.layerId !== command.layerId,
  );
  return { status: 'applied', slices: { ...slices, instances: instancesOnOtherLayers } };
}
