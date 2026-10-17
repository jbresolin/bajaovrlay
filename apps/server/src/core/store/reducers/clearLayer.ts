import type { ClearLayerCommand } from '@bajaovrlay/shared';

import { refuseUnknownLayer } from '../commandRefusals.js';
import { removePreviewClearedMarkerOfLayer } from './previewMarkersAndDiscards.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * clearLayer: removes every instance on the layer, on both outputs, and takes the
 * layer's "will be cleared" marker off: the layer is now as the marker promised, and
 * Prévia goes back to showing program there. With `target: 'program'` (what the
 * auto-out sends) only the program instance goes and the layer's preview stays; the
 * marker goes all the same, since the program is now empty as it promised. Clearing an
 * empty layer is fine; clearing a layer that does not exist is refused.
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
  const isProgramOnly = command.target === 'program';
  const instancesKept = slices.instances.filter((instance) => {
    const isOnThisLayer = instance.layerId === command.layerId;
    const isOnAClearedOutput = !isProgramOnly || instance.target === 'program';
    return !(isOnThisLayer && isOnAClearedOutput);
  });
  const markersAfter = removePreviewClearedMarkerOfLayer(
    slices.previewClearedLayerIds,
    command.layerId,
  );
  // Nothing was on the layer: hand back the same arrays, so nothing is saved or broadcast.
  const hasRemovedAnInstance = instancesKept.length !== slices.instances.length;
  const hasRemovedTheMarker = markersAfter !== slices.previewClearedLayerIds;
  if (!hasRemovedAnInstance && !hasRemovedTheMarker) {
    return { status: 'applied', slices };
  }
  return {
    status: 'applied',
    slices: {
      ...slices,
      instances: hasRemovedAnInstance ? instancesKept : slices.instances,
      previewClearedLayerIds: markersAfter,
    },
  };
}
