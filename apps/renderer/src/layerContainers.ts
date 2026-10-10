/**
 * The layer containers of the stage: one absolutely positioned element per layer, stacked
 * by `zIndex`. A graphic is always placed inside its layer's container, so which graphic
 * draws on top is decided here once and never by a graphic.
 */
import type { Layer } from '@bajaovrlay/shared';

/** The stage's containers and the two things the renderer does with them. */
export type LayerContainers = {
  /**
   * Makes the stage hold exactly these layers. Answers 'unchanged', touching nothing,
   * when the layers are the same as last time; 'rebuilt' otherwise.
   */
  showLayers: (layers: Layer[]) => 'rebuilt' | 'unchanged';
  /** The container of a layer, or undefined when the layers slice does not list it. */
  findContainerOfLayer: (layerId: string) => HTMLElement | undefined;
};

/**
 * Builds the keeper of the stage's layer containers. The stage starts empty; the first
 * `showLayers` fills it.
 */
export function createLayerContainers(stage: HTMLElement): LayerContainers {
  const containerByLayerId = new Map<string, HTMLElement>();
  // The layers shown last, as text: the cheapest way to tell "same layers again" (every
  // hello repeats them) from a real change.
  let layersShownLastAsText = '';

  function showLayers(layers: Layer[]): 'rebuilt' | 'unchanged' {
    const layersAsText = JSON.stringify(layers);
    if (layersAsText === layersShownLastAsText) {
      return 'unchanged';
    }
    layersShownLastAsText = layersAsText;

    // A layer that is no longer listed loses its container (and anything inside it).
    const listedLayerIds = new Set(layers.map((layer) => layer.id));
    for (const [layerId, container] of containerByLayerId) {
      if (!listedLayerIds.has(layerId)) {
        container.remove();
        containerByLayerId.delete(layerId);
      }
    }

    // A layer that stays keeps its container element, so a graphic on air inside it
    // survives the change. Appending in z-order also puts the page order right: `append`
    // moves an element that is already on the stage instead of copying it.
    const layersFromBottomToTop = [...layers].sort(
      (oneLayer, otherLayer) => oneLayer.zIndex - otherLayer.zIndex,
    );
    for (const layer of layersFromBottomToTop) {
      const container = containerByLayerId.get(layer.id) ?? createContainerForLayer(layer.id);
      container.style.zIndex = String(layer.zIndex);
      containerByLayerId.set(layer.id, container);
      stage.append(container);
    }
    return 'rebuilt';
  }

  return {
    showLayers,
    findContainerOfLayer: (layerId) => containerByLayerId.get(layerId),
  };
}

/** Creates an empty container covering the whole stage, marked with its layer id. */
function createContainerForLayer(layerId: string): HTMLElement {
  const container = document.createElement('div');
  container.dataset.layerId = layerId;
  container.style.position = 'absolute';
  container.style.top = '0px';
  container.style.left = '0px';
  container.style.width = '100%';
  container.style.height = '100%';
  return container;
}
