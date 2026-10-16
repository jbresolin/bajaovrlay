import type { Instance } from '@bajaovrlay/shared';

import {
  decideLayerOperations,
  decideRebuildOperations,
  type LayerOperations,
} from './instanceReconciler.js';
import type { SlicesDelivery } from './serverConnection.js';

/** Decides, delivery after delivery, what the stage must do; see createOperationsPerDelivery. */
export type OperationsPerDelivery = {
  /** What to do on each layer for this delivery, compared with the delivery before it. */
  decideOperationsForDelivery: (delivery: SlicesDelivery) => LayerOperations[];
};

/**
 * Follows the deliveries of the server connection for a page that draws `drawnOutput`:
 * it remembers what the last delivery listed (both outputs, and the layers marked "will
 * be cleared" in preview) and asks the reconciler about the difference. A full snapshot
 * (hello) means the page may have missed anything, so it is a rebuild without animations.
 * What could go wrong: the reconciler sees each delivery as one moment, so slices of one
 * state change must arrive in one delivery (the server's `slices` message); split, the
 * moment between them is drawn.
 */
export function createOperationsPerDelivery(
  drawnOutput: Instance['target'],
): OperationsPerDelivery {
  let instancesOfLastDelivery: Instance[] = [];
  let previewClearedLayerIdsOfLastDelivery: string[] = [];

  function decideOperationsForDelivery({
    slices,
    isFullSnapshot,
  }: SlicesDelivery): LayerOperations[] {
    const change = {
      previousInstances: instancesOfLastDelivery,
      previousPreviewClearedLayerIds: previewClearedLayerIdsOfLastDelivery,
      nextInstances: slices.instances,
      nextPreviewClearedLayerIds: slices.previewClearedLayerIds,
      drawnOutput,
    };
    const layerOperations = isFullSnapshot
      ? decideRebuildOperations(change)
      : decideLayerOperations({ ...change, layers: slices.layers });
    instancesOfLastDelivery = slices.instances;
    previewClearedLayerIdsOfLastDelivery = slices.previewClearedLayerIds;
    return layerOperations;
  }

  return { decideOperationsForDelivery };
}
