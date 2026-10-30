import type { Graphic, Instance, Item, Layer, Output } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/**
 * One line under the "Prévia" monitor: a layer that holds a preview, or a layer marked
 * "will be cleared", and what the take will do to it.
 */
export type PreviewedLayer = {
  /**
   * The React key of the line: `preview:<layer id>:<instance id>` or `mark:<layer id>`.
   * The layer id alone would collide if a layer ever had both, which the server never
   * makes but a page must survive; the instance id makes a new preview a new line.
   */
  lineKey: string;
  layerId: string;
  /**
   * The layer's name as the layer panel shows it, or its id when the layer is unknown;
   * with more than one output it starts with the output's name ("PiP · Legenda").
   */
  layerName: string;
  /** What is previewed, in the words the operator knows it by; empty for a marked layer. */
  previewLabel: string;
  /** true for a layer the next take clears (previewClearedLayerIds): Prévia shows it empty. */
  isMarkedToBeCleared: boolean;
};

/** The slices the lines are read from. */
export type SlicesForPreviewedLayers = {
  outputs: Output[];
  layers: Layer[];
  graphics: Graphic[];
  items: Item[];
  instances: Instance[];
  previewClearedLayerIds: string[];
};

// Where a preview on a layer the server no longer lists is sorted: after every known layer.
const zIndexOfUnknownLayer = Number.POSITIVE_INFINITY;

/**
 * Lists the layers that hold a preview or are marked to be cleared, in the layer panel's
 * order (lowest z-index first). The server keeps at most one preview per layer and never
 * a preview and a mark on the same layer, so there is one line per preview instance and
 * one per mark.
 *
 * A preview is named by the label of the rundown item it was made from. A preview made
 * by hand in "Edição rápida" has no item, and one whose item was deleted since has an
 * item id nobody can look up; both are named by the graphic's name, or by the graphic's
 * id when the server no longer lists the graphic. The label is read from the `items`
 * slice as it is now, so a renamed item shows its new name although the preview still
 * holds the data it was made with. With more than one output (BAJAOVRLAY-49) each line's
 * name starts with its output's: "Tomar tudo" takes every output's previews, and two
 * outputs may each have a "Legenda" (gate 2 of PR #32).
 */
export function listPreviewedLayers(slices: SlicesForPreviewedLayers): PreviewedLayer[] {
  const isMoreThanOneOutput = slices.outputs.length > 1;
  // The name of the line of a layer: the layer's name, or its id when the server no
  // longer lists it, after its output's name when there is more than one output.
  function nameTheLayerOfALine(layer: Layer | undefined, layerId: string): string {
    const layerName = layer?.name ?? layerId;
    const output = slices.outputs.find((candidate) => candidate.outputId === layer?.outputId);
    if (!isMoreThanOneOutput || output === undefined) {
      return layerName;
    }
    return ptBR.outputs.layerNameWithItsOutput(output.name, layerName);
  }

  const previewInstances = slices.instances.filter((instance) => instance.target === 'preview');

  const linesWithTheirZIndex = previewInstances.map((previewInstance) => {
    const layer = slices.layers.find((candidate) => candidate.id === previewInstance.layerId);
    const itemPreviewed = slices.items.find((candidate) => candidate.id === previewInstance.itemId);
    const graphic = slices.graphics.find((candidate) => candidate.id === previewInstance.graphicId);
    const graphicNameOrItsId = graphic?.manifest.name ?? previewInstance.graphicId;
    const previewedLayer: PreviewedLayer = {
      lineKey: `preview:${previewInstance.layerId}:${previewInstance.id}`,
      layerId: previewInstance.layerId,
      layerName: nameTheLayerOfALine(layer, previewInstance.layerId),
      previewLabel: itemPreviewed?.label ?? graphicNameOrItsId,
      isMarkedToBeCleared: false,
    };
    return { previewedLayer, zIndex: layer?.zIndex ?? zIndexOfUnknownLayer };
  });

  for (const markedLayerId of slices.previewClearedLayerIds) {
    const layer = slices.layers.find((candidate) => candidate.id === markedLayerId);
    const markedLayer: PreviewedLayer = {
      lineKey: `mark:${markedLayerId}`,
      layerId: markedLayerId,
      layerName: nameTheLayerOfALine(layer, markedLayerId),
      previewLabel: '',
      isMarkedToBeCleared: true,
    };
    linesWithTheirZIndex.push({
      previewedLayer: markedLayer,
      zIndex: layer?.zIndex ?? zIndexOfUnknownLayer,
    });
  }

  // `sort` keeps lines of equal z-index in the order the server listed them.
  linesWithTheirZIndex.sort((oneLine, otherLine) => oneLine.zIndex - otherLine.zIndex);
  return linesWithTheirZIndex.map((line) => line.previewedLayer);
}
