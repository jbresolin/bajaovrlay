import type { Graphic, Instance, Item, Layer } from '@bajaovrlay/shared';

/** One line under the "Prévia" monitor: a layer that holds a preview, and what it holds. */
export type PreviewedLayer = {
  layerId: string;
  /** The layer's name as the layer panel shows it, or its id when the layer is unknown. */
  layerName: string;
  /** What is previewed, in the words the operator knows it by. */
  previewLabel: string;
};

/** The slices the lines are read from. */
export type SlicesForPreviewedLayers = {
  layers: Layer[];
  graphics: Graphic[];
  items: Item[];
  instances: Instance[];
};

// Where a preview on a layer the server no longer lists is sorted: after every known layer.
const zIndexOfUnknownLayer = Number.POSITIVE_INFINITY;

/**
 * Lists the layers that hold a preview, in the layer panel's order (lowest z-index
 * first). The server keeps at most one preview per layer, so there is one line per
 * preview instance.
 *
 * A preview is named by the label of the rundown item it was made from. A preview made
 * by hand in "Edição rápida" has no item, and one whose item was deleted since has an
 * item id nobody can look up; both are named by the graphic's name, or by the graphic's
 * id when the server no longer lists the graphic. The label is read from the `items`
 * slice as it is now, so a renamed item shows its new name although the preview still
 * holds the data it was made with.
 */
export function listPreviewedLayers(slices: SlicesForPreviewedLayers): PreviewedLayer[] {
  const previewInstances = slices.instances.filter((instance) => instance.target === 'preview');

  const linesWithTheirZIndex = previewInstances.map((previewInstance) => {
    const layer = slices.layers.find((candidate) => candidate.id === previewInstance.layerId);
    const itemPreviewed = slices.items.find((candidate) => candidate.id === previewInstance.itemId);
    const graphic = slices.graphics.find((candidate) => candidate.id === previewInstance.graphicId);
    const graphicNameOrItsId = graphic?.manifest.name ?? previewInstance.graphicId;
    const previewedLayer: PreviewedLayer = {
      layerId: previewInstance.layerId,
      layerName: layer?.name ?? previewInstance.layerId,
      previewLabel: itemPreviewed?.label ?? graphicNameOrItsId,
    };
    return { previewedLayer, zIndex: layer?.zIndex ?? zIndexOfUnknownLayer };
  });

  // `sort` keeps lines of equal z-index in the order the server listed them.
  linesWithTheirZIndex.sort((oneLine, otherLine) => oneLine.zIndex - otherLine.zIndex);
  return linesWithTheirZIndex.map((line) => line.previewedLayer);
}
