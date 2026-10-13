import type { StopPreviewCommand } from '@bajaovrlay/shared';

import { refuseUnknownLayer } from '../commandRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * stopPreview: removes what is on the preview output, of the named layer or (with
 * `layerId: null`) of every layer. The program output is never touched. Stopping where
 * nothing is previewed is fine and changes nothing; a layer that does not exist is
 * refused, as clearLayer refuses it.
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
  // Nothing was previewed there: hand back the same slices, so nothing is saved, logged
  // or broadcast ("Descartar" pressed twice leaves no trace).
  const hasRemovedAnything = instancesKept.length !== slices.instances.length;
  if (!hasRemovedAnything) {
    return { status: 'applied', slices };
  }
  return { status: 'applied', slices: { ...slices, instances: instancesKept } };
}
