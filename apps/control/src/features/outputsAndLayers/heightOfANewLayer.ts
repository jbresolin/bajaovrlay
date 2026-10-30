import type { Layer } from '@bajaovrlay/shared';

/** The gap the seed leaves between two layers, so one can be slotted in later. */
const gapBetweenLayers = 10;

/**
 * The zIndex "Adicionar camada" gives a new layer: ten above the output's top layer, or
 * 10 for an output with none. A new layer goes on top of its output; the operator drags
 * it down if it belongs lower. Ten keeps the seed's gaps, so the height is never one the
 * output already uses.
 */
export function findHeightOfANewLayer(layersOfTheOutput: Layer[]): number {
  const heights = layersOfTheOutput.map((layer) => layer.zIndex);
  if (heights.length === 0) {
    return gapBetweenLayers;
  }
  return Math.max(...heights) + gapBetweenLayers;
}
