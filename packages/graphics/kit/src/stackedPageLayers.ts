/**
 * Two layers stacked in one place, for a graphic whose pages turn in place (BAJAOVRLAY-46:
 * the sponsor roll's tiles and corner cell, the intermission's sponsor line). The page on
 * air is drawn on one layer; a turn draws the next page on the other layer, runs the
 * motion, and the other layer is then the one on air. These are the plans only, pure:
 * which page each layer holds before, during and after a turn or a redraw. The graphic
 * draws them and runs the motion.
 */

/** One of the two layers. */
export type LayerIndex = 0 | 1;

/** The page index each of the two layers shows; undefined for an empty layer. */
export type PageIndexOfEachLayer = [number | undefined, number | undefined];

/** Which page each layer holds, which layer is on air, and the page on air. */
export type StackedPageLayers = {
  pageIndexOfLayer: PageIndexOfEachLayer;
  layerOnAir: LayerIndex;
  pageIndexOnAir: number;
};

/** A turn to the next page: the layers while the motion runs, and once it has ended. */
export type PlannedPageTurn = {
  layerLeaving: LayerIndex;
  layerArriving: LayerIndex;
  /** Both pages drawn, the next one named as on air (a head shows it at once). */
  layersDuringTheTurn: StackedPageLayers;
  /** The same pages, the arriving layer now the one on air. */
  layersAfterTheTurn: StackedPageLayers;
};

/** The other of the two layers. */
export function otherLayerThan(layerIndex: LayerIndex): LayerIndex {
  return layerIndex === 0 ? 1 : 0;
}

/**
 * Where a round stands after its list changed: the same page when it still exists, page 1
 * when the list shrank under it. A graphic never jumps to a page that is not there.
 */
export function keepPageIndexWithin(pageIndex: number, pageCount: number): number {
  return pageIndex < pageCount ? pageIndex : 0;
}

/** Page 1 on the first layer, the second empty: after load and after a stop. */
export function planLayersOnPageOne(): StackedPageLayers {
  return { pageIndexOfLayer: [0, undefined], layerOnAir: 0, pageIndexOnAir: 0 };
}

/**
 * The page on air drawn again in place, after an edit, on the layer on air: the same
 * page, or page 1 when the list shrank under it; the other layer emptied.
 */
export function planTheRedrawInPlace(
  layers: StackedPageLayers,
  pageCount: number,
): StackedPageLayers {
  const pageIndexOnAir = keepPageIndexWithin(layers.pageIndexOnAir, pageCount);
  const pageIndexOfLayer: PageIndexOfEachLayer = [undefined, undefined];
  pageIndexOfLayer[layers.layerOnAir] = pageIndexOnAir;
  return { pageIndexOfLayer, layerOnAir: layers.layerOnAir, pageIndexOnAir };
}

/** The turn to the next page, after the last back to page 1, drawn on the other layer. */
export function planTheTurnToTheNextPage(
  layers: StackedPageLayers,
  pageCount: number,
): PlannedPageTurn {
  const layerLeaving = layers.layerOnAir;
  const layerArriving = otherLayerThan(layerLeaving);
  const nextPageIndex = (layers.pageIndexOnAir + 1) % pageCount;
  const pageIndexOfLayer: PageIndexOfEachLayer = [...layers.pageIndexOfLayer];
  pageIndexOfLayer[layerArriving] = nextPageIndex;
  const layersDuringTheTurn: StackedPageLayers = {
    pageIndexOfLayer,
    layerOnAir: layerLeaving,
    pageIndexOnAir: nextPageIndex,
  };
  return {
    layerLeaving,
    layerArriving,
    layersDuringTheTurn,
    layersAfterTheTurn: { ...layersDuringTheTurn, layerOnAir: layerArriving },
  };
}
