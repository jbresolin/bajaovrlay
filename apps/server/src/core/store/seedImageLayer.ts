import type { Layer } from '@bajaovrlay/shared';

import { addTheSeededLayerUnlessItsHeightIsTaken, imageLayerId } from './seedLayers.js';

/** The name the image layer's seed is recorded under in `seeds_done`. */
export const imageLayerSeedName = 'imageLayer';

/** The layers after the image layer's seed, and what the boot must do. */
export type ImageLayerSeedOutcome = {
  layers: Layer[];
  /** False when the seed was already done here: nothing changed, nothing to write. */
  isSeedApplied: boolean;
  /** Set when the layer could not be added: the operator's own layer holds its height. */
  zIndexTakenByTheOperator: number | undefined;
};

/**
 * Adds the "Imagem" layer (BAJAOVRLAY-84, z 60 on program) once per database: nothing when
 * `seeds_done` already names the seed, so a layer the operator deleted never comes back.
 * Only the layer: the image graphic has no seeded item, since there is no picture to put
 * in one; the operator makes items of it like any other graphic. When the operator's own
 * layer holds z 60, nothing is added and the seed counts as applied all the same, so the
 * boot records it, warns once and never tries again.
 */
export function addImageLayerOnce(options: {
  seedNamesDone: string[];
  layers: Layer[];
}): ImageLayerSeedOutcome {
  if (options.seedNamesDone.includes(imageLayerSeedName)) {
    return { layers: options.layers, isSeedApplied: false, zIndexTakenByTheOperator: undefined };
  }
  const layerAddition = addTheSeededLayerUnlessItsHeightIsTaken(options.layers, imageLayerId);
  return {
    layers: layerAddition.layers,
    isSeedApplied: true,
    zIndexTakenByTheOperator: layerAddition.zIndexTakenByTheOperator,
  };
}
