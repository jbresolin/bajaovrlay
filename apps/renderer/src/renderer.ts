// Entry point of the renderer page that OBS loads as a browser source. It only wires the
// parts together: the layer containers on the stage, the connection to the server, and
// the reconciler/player pair that makes the stage match the server's `instances` slice.
// The renderer decides nothing about what is on air: if the slice says it, it is drawn,
// and the server is told how that went (on air, or failed and why). The same page framed
// by the control page as a program monitor (`?monitor=1`) draws the same and tells nothing.
import type { Instance } from '@bajaovrlay/shared';

import { createGraphicLoader } from './graphicLoader.js';
import { createInstancePlayer } from './instancePlayer.js';
import { decideLayerOperations, decideRebuildOperations } from './instanceReconciler.js';
import { createLayerContainers } from './layerContainers.js';
import { logRendererEvent } from './rendererLog.js';
import { decideRendererPageRole } from './rendererPageRole.js';
import { connectToServer } from './serverConnection.js';

/** Builds the renderer on the stage element and connects it to the server it came from. */
function startRenderer(stage: HTMLElement): void {
  // The page is served by the server (or by the dev server that forwards to it), so the
  // WebSocket and the API live on the page's own host. `role=renderer` is how the server
  // tells the program output from every other page: only it may report what is on screen.
  // The copy the control page frames (`?monitor=1`) dials without the role.
  const pageRole = decideRendererPageRole(location.search);
  const webSocketScheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const connection = connectToServer({
    webSocketAddress: `${webSocketScheme}//${location.host}${pageRole.webSocketPath}`,
    stateAddress: `${location.origin}/api/v1/state`,
  });

  const layerContainers = createLayerContainers(stage);
  // A monitor's player gets no reporter at all, so it cannot send an instanceStatus even
  // by mistake. Leaving the role off the address alone would not be enough: the server
  // would refuse each report, and every graphic on the monitor would cost a refused command.
  const reportInstanceStatus = pageRole.isProgramMonitor
    ? undefined
    : connection.sendInstanceStatus;
  const instancePlayer = createInstancePlayer({
    layerContainers,
    graphicLoader: createGraphicLoader(),
    reportInstanceStatus,
  });
  // What the last delivery said is on air, to compare the next one against.
  let instancesOfLastDelivery: Instance[] = [];

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
