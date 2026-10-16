import type { StopPreviewCommand } from '@bajaovrlay/shared';

import { refuseUnknownLayer } from '../commandRefusals.js';
import {
  removeEveryPreviewClearedMarker,
  removePreviewClearedMarkerOfLayer,
} from './previewClearedMarkers.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * stopPreview: throws away what Prévia shows, of the named layer or (with
 * `layerId: null`) of every layer: the preview instances and the "will be cleared"
 * markers alike ("Descartar", "Descartar tudo"). The program output is never touched.
 * Stopping where nothing is previewed or marked is fine and changes nothing; a layer
 * that does not exist is refused, as clearLayer refuses it.
 */
export function reduceStopPreview(
  slices: SlicesChangedByCommands,
  command: StopPreviewCommand,
): ReducerOutcome {
  const layerIdToStop = command.layerId;
  const isForEveryLayer = layerIdToStop === null;
  if (!isForEveryLayer) {
    const layerExists = slices.layers.some((layer) => layer.id === layerIdToStop);
    if (!layerExists) {
      return { status: 'refused', error: refuseUnknownLayer(layerIdToStop) };
    }
  }

  const instancesKept = slices.instances.filter((instance) => {
    const isOnThePreviewOutput = instance.target === 'preview';
    const isOnALayerToStop = isForEveryLayer || instance.layerId === layerIdToStop;
    return !(isOnThePreviewOutput && isOnALayerToStop);
  });
  const markersKept = isForEveryLayer
    ? removeEveryPreviewClearedMarker(slices.previewClearedLayerIds)
    : removePreviewClearedMarkerOfLayer(slices.previewClearedLayerIds, layerIdToStop);

  // Nothing was previewed or marked there: hand back the same slices, so nothing is
  // saved, logged or broadcast ("Descartar" pressed twice leaves no trace).
  const hasRemovedAnInstance = instancesKept.length !== slices.instances.length;
  const hasRemovedAMarker = markersKept !== slices.previewClearedLayerIds;
  if (!hasRemovedAnInstance && !hasRemovedAMarker) {
    return { status: 'applied', slices };
  }
  return {
    status: 'applied',
    slices: {
      ...slices,
      instances: hasRemovedAnInstance ? instancesKept : slices.instances,
      previewClearedLayerIds: markersKept,
    },
  };
}
