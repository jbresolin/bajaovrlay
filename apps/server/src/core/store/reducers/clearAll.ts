import { removeEveryPreviewClearedMarker } from './previewMarkersAndDiscards.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * clearAll: the panic button. Removes every instance on every layer and output,
 * including layers marked persistent: when the operator asks for a clean screen, the
 * screen must be clean. Every "will be cleared" marker goes too, because both outputs
 * are now empty and there is nothing left for a marker to promise.
 */
export function reduceClearAll(slices: SlicesChangedByCommands): ReducerOutcome {
  // Nothing on air and nothing marked: hand back the same arrays, so nothing is saved or
  // broadcast.
  const isAlreadyClean =
    slices.instances.length === 0 && slices.previewClearedLayerIds.length === 0;
  if (isAlreadyClean) {
    return { status: 'applied', slices };
  }
  return {
    status: 'applied',
    slices: {
      ...slices,
      instances: slices.instances.length === 0 ? slices.instances : [],
      previewClearedLayerIds: removeEveryPreviewClearedMarker(slices.previewClearedLayerIds),
    },
  };
}
