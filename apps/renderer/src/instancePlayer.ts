/**
 * Carries out the operations instanceReconciler decided: brings graphic elements into
 * their layer containers (instanceLoading.ts) and drives them through the rest of the
 * OGraf lifecycle (playAction, updateAction, stopAction, dispose). It also tells the
 * server what really happened to each instance it tried to put on air.
 *
 * Three rules shape this file:
 *   - Operations on one layer run strictly one after the other, each waiting for the
 *     graphic's promise. Different layers each have their own queue and never wait for
 *     one another, so a slow animation on the clock cannot hold up a lower third.
 *   - A graphic that fails (its module cannot be imported, its load throws or is refused)
 *     is logged and leaves its layer empty. It never stops the queue of its own layer or
 *     of any other.
 *   - Every instance the player tries to put on air is reported to the server exactly as
 *     it ended: `on-air` once its playAction resolved, `failed` with the reason otherwise.
 *     The exceptions are a program monitor and a preview page, whose player has no
 *     reporter and tells nothing.
 *
 * What could go wrong: the renderer only awaits the graphic's promises (concept §6). A
 * graphic whose promise never settles blocks its own layer until the page is reloaded;
 * lifecycleCall.ts writes a warning after ten seconds so that at least it can be seen.
 */
import type { Graphic, Instance, InstanceStatusMessage } from '@bajaovrlay/shared';

import type { GraphicLoader } from './graphicLoader.js';
import { type GraphicOnLayer, loadInstanceIntoItsLayer } from './instanceLoading.js';
import type { InstanceOperation, LayerOperations } from './instanceReconciler.js';
import type { LayerContainers } from './layerContainers.js';
import { makeLifecycleCall } from './lifecycleCall.js';
import { logRendererEvent } from './rendererLog.js';

/** What the renderer asks of the player. */
export type InstancePlayer = {
  /**
   * Queues the operations of each layer behind whatever that layer is still doing and
   * returns at once. `graphics` is the current `graphics` slice, used to find the module
   * of a graphic that must be loaded.
   */
  runLayerOperations: (layerOperations: LayerOperations[], graphics: Graphic[]) => void;
};

/**
 * What the player works with. `reportInstanceStatus` is how it tells the server what
 * happened to an instance (renderer.ts hands it the connection's sendInstanceStatus).
 * A program monitor and a preview page leave it out: such a page is not the program
 * output, so it must tell the server nothing (instancePlayer.noReporter.test.ts). `logEvent` is replaceable so a
 * test can capture the log.
 */
export type InstancePlayerOptions = {
  layerContainers: LayerContainers;
  graphicLoader: GraphicLoader;
  reportInstanceStatus?: (statusReport: InstanceStatusMessage) => void;
  logEvent?: typeof logRendererEvent;
};

/** Stands in for the reporter on a page that was given none (a monitor, a preview page). */
function reportNothingToTheServer(): void {
  // Empty on purpose. Everything the player does around a report (the log line, the
  // empty layer, the queue going on) must happen on such a page too; only the telling stops.
}

/** Builds the player for one stage. Nothing is on any layer until operations arrive. */
export function createInstancePlayer(options: InstancePlayerOptions): InstancePlayer {
  const { layerContainers, graphicLoader } = options;
  const reportInstanceStatus = options.reportInstanceStatus ?? reportNothingToTheServer;
  const logEvent = options.logEvent ?? logRendererEvent;
  const loadingTools = { layerContainers, graphicLoader, logEvent };

  // What is really on each layer right now, as far as the page goes. A graphic whose
  // load failed is never in this map, even though the server lists its instance.
  const graphicOnLayerByLayerId = new Map<string, GraphicOnLayer>();
  // The end of each layer's queue: the promise of the last operation queued on it.
  const endOfQueueByLayerId = new Map<string, Promise<void>>();

  function runLayerOperations(layerOperations: LayerOperations[], graphics: Graphic[]): void {
    for (const { layerId, operations } of layerOperations) {
      for (const operation of operations) {
        const endOfQueue = endOfQueueByLayerId.get(layerId) ?? Promise.resolve();
        const thisOperation = endOfQueue
          .then(() => runOneOperation(layerId, operation, graphics))
          // Nothing below is expected to throw; if it does, the layer's queue must go on
          // (instancePlayer.test.ts proves it with an element that cannot be created).
          .catch((unexpectedError: unknown) => {
            logEvent('error', 'renderer operation failed unexpectedly', {
              layerId,
              operation: operation.kind,
              reason: String(unexpectedError),
            });
            // Without this report the instance would read "loading" in the layer panel
            // for ever, with nothing on screen and nothing to say why.
            const instanceGoingOnAir = findInstanceAnOperationPutsOnAir(operation);
            if (instanceGoingOnAir !== undefined) {
              reportInstanceStatus({
                type: 'instanceStatus',
                instanceId: instanceGoingOnAir.id,
                status: 'failed',
                detail: `the renderer failed unexpectedly: ${String(unexpectedError)}`,
              });
            }
          });
        endOfQueueByLayerId.set(layerId, thisOperation);
      }
    }
  }

  async function runOneOperation(
    layerId: string,
    operation: InstanceOperation,
    graphics: Graphic[],
  ): Promise<void> {
    if (operation.kind === 'loadAndPlay') {
      await putInstanceOnItsEmptyLayer(operation.instance, graphics, operation.skipAnimation);
      return;
    }
    if (operation.kind === 'updateData') {
      await updateDataOfInstance(layerId, operation.instanceId, operation.changedData);
      return;
    }
    if (operation.kind === 'stopAndDispose') {
      await stopAndDisposeInstance(layerId, operation.instanceId, false);
      return;
    }
    if (operation.kind === 'disposeAtOnce') {
      await disposeWhateverIsOnLayer(layerId);
      return;
    }
    if (operation.kind === 'replace') {
      if (operation.replacePolicy === 'out-then-in') {
        // The old graphic animates out, and only then is the new one loaded and animated
        // in. The layer is empty in between; with this policy that is the design.
        await stopAndDisposeInstance(layerId, operation.outgoingInstanceId, false);
        await putInstanceOnItsEmptyLayer(operation.incomingInstance, graphics, false);
        return;
      }
      // `cut`, and `crossfade`, which is treated as `cut`: a real crossfade needs both
      // graphics visible on the layer at once, which no graphic is designed for yet.
      await cutToInstance(
        layerId,
        operation.outgoingInstanceId,
        operation.incomingInstance,
        graphics,
      );
      return;
    }
    // Every kind is handled above. Two guards keep it that way. The `never` line stops
    // the build when a new kind is added to InstanceOperation without a branch here. The
    // throw covers what the build cannot see (an operation that did not come from this
    // version's reconciler): the queue logs it by name instead of guessing what to do.
    const unhandledOperation: never = operation;
    const unknownKind = String((unhandledOperation as { kind?: unknown }).kind);
    throw new Error(`the renderer does not know the operation kind "${unknownKind}"`);
  }

  /** Loads the instance on its layer, which must be empty by now, then plays step 0. */
  async function putInstanceOnItsEmptyLayer(
    instance: Instance,
    graphics: Graphic[],
    skipAnimation: boolean,
  ): Promise<void> {
    // Two graphics must never share a layer by accident. Nothing should be here (the
    // reconciler always clears a layer first), so this only guards against a bug elsewhere.
    await disposeWhateverIsOnLayer(instance.layerId);

    const graphicOnLayer = await loadInstanceAndReportAFailure(instance, graphics, 'visible');
    if (graphicOnLayer === undefined) {
      return;
    }
    graphicOnLayerByLayerId.set(instance.layerId, graphicOnLayer);
    await playGraphicAndReportHowItWent(graphicOnLayer, skipAnimation);
  }

  /**
   * Swaps the graphic on a layer for a new one without the layer ever being empty while
   * the new one loads: the new graphic is loaded first, hidden, behind the old one; then
   * the old one is stopped and disposed and the new one played, all without animation.
   */
  async function cutToInstance(
    layerId: string,
    outgoingInstanceId: string,
    incomingInstance: Instance,
    graphics: Graphic[],
  ): Promise<void> {
    // For as long as this takes (a module to import, fonts to fetch) the old graphic
    // stays on air untouched. This is the one moment two graphics share a layer.
    let incomingGraphic: GraphicOnLayer | undefined;
    try {
      incomingGraphic = await loadInstanceAndReportAFailure(incomingInstance, graphics, 'hidden');
    } finally {
      // The old graphic leaves however the load ended: the server no longer lists it, so
      // it must not stay on air. That covers the new graphic loaded, the new graphic
      // failing to load (the layer is then empty, as after any failure) and the renderer
      // itself throwing (not the graphic, whose failures come back as "not loaded"). In
      // that last case the error goes on, after this, to the layer's queue, which logs it
      // and reports the new instance failed.
      await stopAndDisposeInstance(layerId, outgoingInstanceId, true);
    }
    // Normally nothing is left by now. This only guards against a bug elsewhere having
    // left some other graphic here, which the new one would otherwise sit on top of.
    await disposeWhateverIsOnLayer(layerId);
    if (incomingGraphic === undefined) {
      return;
    }

    // Shown in the same turn in which the old element was removed, before the browser
    // draws its next frame, so no frame has an empty layer (e2e/replaceWithCut.e2e.ts
    // watches the frames). What the viewer sees from here on is up to the graphic: one
    // that draws nothing until it is played shows nothing until the play below is done.
    incomingGraphic.element.style.removeProperty('visibility');
    graphicOnLayerByLayerId.set(layerId, incomingGraphic);
    await playGraphicAndReportHowItWent(incomingGraphic, true);
  }

  /**
   * Brings the instance's graphic into its layer, loaded. Undefined when that failed,
   * after a log line and a `failed` report to the server carrying the reason.
   */
  async function loadInstanceAndReportAFailure(
    instance: Instance,
    graphics: Graphic[],
    visibilityWhileLoading: 'visible' | 'hidden',
  ): Promise<GraphicOnLayer | undefined> {
    const loadOutcome = await loadInstanceIntoItsLayer(
      instance,
      graphics,
      visibilityWhileLoading,
      loadingTools,
    );
    if (loadOutcome.wasLoaded) {
      return loadOutcome.graphicOnLayer;
    }
    logEvent('error', 'graphic could not go on air; its layer stays empty', {
      instanceId: instance.id,
      layerId: instance.layerId,
      graphicId: instance.graphicId,
      reason: loadOutcome.reason,
    });
    reportInstanceStatus({
      type: 'instanceStatus',
      instanceId: instance.id,
      status: 'failed',
      detail: loadOutcome.reason,
    });
    return undefined;
  }

  /**
   * Plays step 0 of a loaded graphic and tells the server how it ended: `on-air` once the
   * playAction has resolved and was accepted, `failed` with the reason otherwise.
   */
  async function playGraphicAndReportHowItWent(
    graphicOnLayer: GraphicOnLayer,
    skipAnimation: boolean,
  ): Promise<void> {
    const { subject, element } = graphicOnLayer;
    const playOutcome = await makeLifecycleCall(
      subject,
      {
        action: 'playAction',
        skipAnimation,
        run: () =>
          element.playAction(skipAnimation ? { goto: 0, skipAnimation: true } : { goto: 0 }),
      },
      logEvent,
    );
    if (playOutcome.wasAccepted) {
      reportInstanceStatus({
        type: 'instanceStatus',
        instanceId: subject.instanceId,
        status: 'on-air',
      });
      return;
    }
    // The graphic stays on its layer (it is loaded, and a later clear must still find it
    // to stop and dispose it), but nobody can say it is showing, so it is not "on air".
    reportInstanceStatus({
      type: 'instanceStatus',
      instanceId: subject.instanceId,
      status: 'failed',
      detail: `its playAction failed or was refused: ${playOutcome.whyNot}`,
    });
  }

  /** Sends the changed fields to the graphic of this instance, if it is on its layer. */
  async function updateDataOfInstance(
    layerId: string,
    instanceId: string,
    changedData: Record<string, unknown>,
  ): Promise<void> {
    const graphicOnLayer = findGraphicOfInstance(layerId, instanceId, 'updateData');
    if (graphicOnLayer === undefined) {
      return;
    }
    await makeLifecycleCall(
      graphicOnLayer.subject,
      {
        action: 'updateAction',
        skipAnimation: false,
        run: () => graphicOnLayer.element.updateAction({ data: changedData }),
      },
      logEvent,
    );
  }

  /** Stops the graphic of this instance (animated unless skipped), then disposes it. */
  async function stopAndDisposeInstance(
    layerId: string,
    instanceId: string,
    skipAnimation: boolean,
  ): Promise<void> {
    const graphicOnLayer = findGraphicOfInstance(layerId, instanceId, 'stopAndDispose');
    if (graphicOnLayer === undefined) {
      return;
    }
    // A refused or failed stop is already logged; the graphic is disposed regardless,
    // because the server says it is off air and the layer must be freed.
    await makeLifecycleCall(
      graphicOnLayer.subject,
      {
        action: 'stopAction',
        skipAnimation,
        run: () => graphicOnLayer.element.stopAction(skipAnimation ? { skipAnimation: true } : {}),
      },
      logEvent,
    );
    await disposeWhateverIsOnLayer(layerId);
  }

  /** Disposes the graphic on a layer, whichever it is, and removes its element. */
  async function disposeWhateverIsOnLayer(layerId: string): Promise<void> {
    const graphicOnLayer = graphicOnLayerByLayerId.get(layerId);
    if (graphicOnLayer === undefined) {
      return;
    }
    // Forgotten first: whatever dispose answers, this graphic is no longer on its layer.
    graphicOnLayerByLayerId.delete(layerId);
    await makeLifecycleCall(
      graphicOnLayer.subject,
      { action: 'dispose', skipAnimation: false, run: () => graphicOnLayer.element.dispose({}) },
      logEvent,
    );
    graphicOnLayer.element.remove();
  }

  /**
   * Finds the graphic of an instance on its layer. Undefined, after a log line, when it
   * is not there: its load failed earlier, so there is nothing to update or stop.
   */
  function findGraphicOfInstance(
    layerId: string,
    instanceId: string,
    operationKind: InstanceOperation['kind'],
  ): GraphicOnLayer | undefined {
    const graphicOnLayer = graphicOnLayerByLayerId.get(layerId);
    if (graphicOnLayer === undefined || graphicOnLayer.subject.instanceId !== instanceId) {
      logEvent('info', 'operation skipped: the instance is not on its layer', {
        operation: operationKind,
        instanceId,
        layerId,
      });
      return undefined;
    }
    return graphicOnLayer;
  }

  return { runLayerOperations };
}

/** The instance an operation is meant to put on air, or undefined when it puts none. */
function findInstanceAnOperationPutsOnAir(operation: InstanceOperation): Instance | undefined {
  if (operation.kind === 'loadAndPlay') {
    return operation.instance;
  }
  if (operation.kind === 'replace') {
    return operation.incomingInstance;
  }
  return undefined;
}
