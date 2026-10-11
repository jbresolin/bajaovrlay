/**
 * Brings the graphic of one instance into its layer, loaded but not yet played: imports
 * the graphic's module, creates its element inside the layer's container and awaits the
 * OGraf `load`. instancePlayer.ts decides when this happens and what comes after it.
 *
 * Whatever goes wrong here (the layer or the graphic is unknown, the module cannot be
 * imported, the load throws or is refused) ends as an answer of "not loaded" with the
 * reason in words, and leaves nothing behind on the layer. The caller logs the reason and
 * reports it to the server.
 */
import type { Graphic, Instance } from '@bajaovrlay/shared';

import type { GraphicLoader } from './graphicLoader.js';
import type { LayerContainers } from './layerContainers.js';
import { type LifecycleCallSubject, makeLifecycleCall } from './lifecycleCall.js';
import type { OGrafGraphicElement } from './ografGraphicElement.js';
import type { logRendererEvent } from './rendererLog.js';

// The stage is the stream canvas: horizontal 16:9 only (concept §18.6).
const stageResolution = { width: 1920, height: 1080 };

/** A graphic element that was loaded successfully and sits in its layer's container. */
export type GraphicOnLayer = {
  subject: LifecycleCallSubject;
  element: OGrafGraphicElement;
};

/** What came of loading an instance: its graphic on the layer, or why there is none. */
export type InstanceLoadOutcome =
  | { wasLoaded: true; graphicOnLayer: GraphicOnLayer }
  | {
      wasLoaded: false;
      /** For example `its module could not be loaded: TypeError: Failed to fetch …`. */
      reason: string;
    };

/** What loading needs from the stage: the layers, the module loader and the log. */
export type InstanceLoadingTools = {
  layerContainers: LayerContainers;
  graphicLoader: GraphicLoader;
  logEvent: typeof logRendererEvent;
};

/**
 * Creates the instance's element in its layer and loads it. With `'hidden'` the element
 * is on the layer but not drawn, for a graphic that loads behind the one it will replace;
 * the caller makes it visible again. Never rejects on account of the graphic.
 */
export async function loadInstanceIntoItsLayer(
  instance: Instance,
  graphics: Graphic[],
  visibilityWhileLoading: 'visible' | 'hidden',
  tools: InstanceLoadingTools,
): Promise<InstanceLoadOutcome> {
  const subject: LifecycleCallSubject = {
    instanceId: instance.id,
    layerId: instance.layerId,
    graphicId: instance.graphicId,
  };

  const container = tools.layerContainers.findContainerOfLayer(instance.layerId);
  if (container === undefined) {
    return { wasLoaded: false, reason: 'its layer is not in the layers slice' };
  }
  const graphic = graphics.find((candidate) => candidate.id === instance.graphicId);
  if (graphic === undefined) {
    return { wasLoaded: false, reason: 'its graphic is not in the graphics slice' };
  }
  let tagName: string;
  try {
    tagName = await tools.graphicLoader.defineGraphicElement(graphic);
  } catch (importError) {
    return {
      wasLoaded: false,
      reason: `its module could not be loaded: ${String(importError)}`,
    };
  }

  const element = document.createElement(tagName) as OGrafGraphicElement;
  // The id is on the element for people reading the page in DevTools, and for tests.
  element.dataset.instanceId = instance.id;
  if (visibilityWhileLoading === 'hidden') {
    // `visibility`, not `display: none`: a hidden element is still laid out, so a graphic
    // that measures its text or waits for its fonts during load works as if it were shown.
    element.style.visibility = 'hidden';
  }
  container.append(element);

  const loadOutcome = await makeLifecycleCall(
    subject,
    {
      action: 'load',
      skipAnimation: false,
      run: () =>
        element.load({
          data: instance.resolvedData,
          renderType: 'realtime',
          renderCharacteristics: { resolution: stageResolution },
        }),
    },
    tools.logEvent,
  );
  if (!loadOutcome.wasAccepted) {
    element.remove();
    return {
      wasLoaded: false,
      reason: `its load failed or was refused: ${loadOutcome.whyNot}`,
    };
  }
  return { wasLoaded: true, graphicOnLayer: { subject, element } };
}
