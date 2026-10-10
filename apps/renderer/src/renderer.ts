// Entry point of the renderer page that OBS loads as a browser source. It only wires the
// parts together: the layer containers on the stage, the connection to the server, and
// the reconciler/player pair that makes the stage match the server's `instances` slice.
// The renderer decides nothing about what is on air: if the slice says it, it is drawn.
import type { Instance } from '@bajaovrlay/shared';

import { createGraphicLoader } from './graphicLoader.js';
import { createInstancePlayer } from './instancePlayer.js';
import { decideLayerOperations, decideRebuildOperations } from './instanceReconciler.js';
import { createLayerContainers } from './layerContainers.js';
import { logRendererEvent } from './rendererLog.js';
import { connectToServer } from './serverConnection.js';

/** Builds the renderer on the stage element and connects it to the server it came from. */
function startRenderer(stage: HTMLElement): void {
  const layerContainers = createLayerContainers(stage);
  const instancePlayer = createInstancePlayer({
    layerContainers,
    graphicLoader: createGraphicLoader(),
  });
  // What the last delivery said is on air, to compare the next one against.
  let instancesOfLastDelivery: Instance[] = [];

  // The page is served by the server (or by the dev server that forwards to it), so the
  // WebSocket and the API live on the page's own host.
  const webSocketScheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const connection = connectToServer({
    webSocketAddress: `${webSocketScheme}//${location.host}/ws`,
    stateAddress: `${location.origin}/api/v1/state`,
  });

  connection.onSlices(({ slices, isFullSnapshot }) => {
    layerContainers.showLayers(slices.layers);
    const change = { previousInstances: instancesOfLastDelivery, nextInstances: slices.instances };
    // A full snapshot (hello) means the page may have missed anything: rebuild the stage
    // without animations. Otherwise only the difference is played, with animations.
    const layerOperations = isFullSnapshot
      ? decideRebuildOperations(change)
      : decideLayerOperations({ ...change, layers: slices.layers });
    instancePlayer.runLayerOperations(layerOperations, slices.graphics);
    instancesOfLastDelivery = slices.instances;
  });

  logRendererEvent('info', 'renderer ready', {
    stageWidth: stage.offsetWidth,
    stageHeight: stage.offsetHeight,
  });
}

const stage = document.getElementById('stage');
if (stage === null) {
  logRendererEvent('error', 'renderer stage missing', { expectedElementId: 'stage' });
} else {
  startRenderer(stage);
}
