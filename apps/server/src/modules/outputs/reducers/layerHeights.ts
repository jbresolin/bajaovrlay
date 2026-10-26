import type { Layer } from '@bajaovrlay/shared';

/**
 * The layer of that output already at that height, leaving out the layer being placed
 * (so an edit that keeps its own height is not refused by itself); undefined when the
 * height is free. A zIndex is unique within an output, not across outputs.
 */
export function findLayerAtHeightOfOutput(
  layers: Layer[],
  outputId: string,
  zIndex: number,
  layerIdBeingPlaced: string,
): Layer | undefined {
  return layers.find(
    (layer) =>
      layer.outputId === outputId && layer.zIndex === zIndex && layer.id !== layerIdBeingPlaced,
  );
}
