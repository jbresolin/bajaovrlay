import type { Graphic, OGrafManifest } from '@bajaovrlay/shared';

/** Where a graphic's takes go by default, and how the control page groups it. */
export type GraphicPlacement = Pick<Graphic, 'defaultLayerId' | 'category'>;

/**
 * The placement chosen for a graphic and, when the fullscreen layer was used instead of
 * a layer from the manifest, the reason (in English: it goes to the server log).
 */
export type GraphicPlacementDecision = {
  placement: GraphicPlacement;
  reasonForUsingFullscreen: string | undefined;
};

/**
 * A graphic with no usable default layer goes to the top layer: there it can never
 * replace the logo, the clock or a lower third that is on air. Used at boot, and by
 * deleteLayer for a graphic whose default layer the operator deleted (BAJAOVRLAY-49).
 */
export const layerIdOfUnplacedGraphics = 'fullscreen';

// The category is optional in a manifest; this is the group for graphics without one.
const categoryOfUngroupedGraphics = 'other';

/**
 * Reads the default layer and the category from a manifest's `v_baja` field. A manifest
 * that names no default layer, or one that is not among `existingLayerIds`, is placed
 * on `fullscreen` and the decision says why, so the caller can log a warning. Pure: it
 * reads nothing but its arguments.
 */
export function decideGraphicPlacementFromManifest(
  manifest: OGrafManifest,
  existingLayerIds: string[],
): GraphicPlacementDecision {
  const category = manifest.v_baja?.category ?? categoryOfUngroupedGraphics;
  const declaredDefaultLayerId = manifest.v_baja?.defaultLayerId;

  if (declaredDefaultLayerId === undefined) {
    return {
      placement: { defaultLayerId: layerIdOfUnplacedGraphics, category },
      reasonForUsingFullscreen: 'the manifest declares no v_baja.defaultLayerId',
    };
  }
  const declaredLayerExists = existingLayerIds.includes(declaredDefaultLayerId);
  if (!declaredLayerExists) {
    return {
      placement: { defaultLayerId: layerIdOfUnplacedGraphics, category },
      reasonForUsingFullscreen: 'the layer named by v_baja.defaultLayerId does not exist',
    };
  }
  return {
    placement: { defaultLayerId: declaredDefaultLayerId, category },
    reasonForUsingFullscreen: undefined,
  };
}
