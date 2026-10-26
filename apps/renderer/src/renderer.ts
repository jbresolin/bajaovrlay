// Entry point of the renderer page that OBS loads as a browser source. It only wires the
// parts together: the layer containers on the stage, the connection to the server, and
// the reconciler/player pair that makes the stage match the server's `instances` slice.
// The renderer decides nothing about what is on air: if the slice says it, it is drawn,
// and the server is told how that went (on air, or failed and why). The same page framed
// by the control page as a program monitor (`?monitor=1`) draws the same and tells nothing.
// Framed as the preview page (`?target=preview`) it draws the screen as it will look after
// the take instead (the preview instances, over what is on air, minus the layers marked
// "will be cleared") and tells nothing either. rendererPageRole.ts decides which of the
// three this page is; everything below is the same code for all of them.
import { browserPageReloadForNewBuild } from './browserPageReloadForNewBuild.js';
import { createGraphicLoader } from './graphicLoader.js';
import { createInstancePlayer } from './instancePlayer.js';
import { createLayerContainers } from './layerContainers.js';
import { createOperationsPerDelivery } from './operationsPerDelivery.js';
import { logRendererEvent } from './rendererLog.js';
import { decideRendererPageRole } from './rendererPageRole.js';
import { connectToServer } from './serverConnection.js';
import { isThemeOnRoot, themeTokenCheckedOnRoot, themeTokensAddress } from './themeOnRoot.js';

/** Builds the renderer on the stage element and connects it to the server it came from. */
function startRenderer(stage: HTMLElement): void {
  // index.html links the theme's tokens in its head, before this script, so they are on
  // :root before any graphic loads. A graphic has no fallback values, so if the link
  // failed the graphics draw unstyled; that is logged here and the page goes on: OBS must
  // keep drawing whatever it can, nothing on air is blanked by a missing stylesheet.
  if (!isThemeOnRoot()) {
    logRendererEvent('error', 'theme not loaded on :root', {
      tokenChecked: themeTokenCheckedOnRoot,
      themeAddress: themeTokensAddress,
    });
  }

  // The page is served by the server (or by the dev server that forwards to it), so the
  // WebSocket and the API live on the page's own host. `role=renderer` is how the server
  // tells the program output from every other page: only it may report what is on screen.
  // The copies the control page frames (`?monitor=1`, `?target=preview`) dial
  // `role=monitor`. Both roles are left out of the race data and the event log, on the
  // WebSocket and on the state read alike. A page loaded at /render/?output=pip passes its
  // output on in both, and the server sends it only the PiP's layers (BAJAOVRLAY-49).
  const pageRole = decideRendererPageRole(location.search);
  const webSocketScheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const connection = connectToServer({
    webSocketAddress: `${webSocketScheme}//${location.host}${pageRole.webSocketPath}`,
    stateAddress: `${location.origin}${pageRole.stateReadingPath}`,
    // A hello naming another build reloads this page (at most once per announced build),
    // so an OBS browser source left open across an upgrade does not go on with the old
    // bundle, and one loaded between a build and the restart is not blanked repeatedly.
    pageReloadForNewBuild: browserPageReloadForNewBuild,
  });

  const layerContainers = createLayerContainers(stage);
  // The player of a monitor or of a preview page gets no reporter at all, so it cannot
  // send an instanceStatus even by mistake. The monitor role in the address alone would
  // not be enough: the server would refuse each report, and every graphic on such a page
  // would cost a refused command.
  const reportInstanceStatus = pageRole.reportsInstanceStatus
    ? connection.sendInstanceStatus
    : undefined;
  const instancePlayer = createInstancePlayer({
    layerContainers,
    graphicLoader: createGraphicLoader(),
    reportInstanceStatus,
  });
  // `drawnOutput` is the one setting that tells the preview page from the others: the
  // reconciler draws the program instances, or the preview composition, from each delivery.
  const operationsPerDelivery = createOperationsPerDelivery(pageRole.drawnOutput);

  connection.onSlices((delivery) => {
    layerContainers.showLayers(delivery.slices.layers);
    const layerOperations = operationsPerDelivery.decideOperationsForDelivery(delivery);
    instancePlayer.runLayerOperations(layerOperations, delivery.slices.graphics);
  });

  logRendererEvent('info', 'renderer ready', {
    outputId: pageRole.outputId,
    drawnOutput: pageRole.drawnOutput,
    reportsInstanceStatus: pageRole.reportsInstanceStatus,
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
