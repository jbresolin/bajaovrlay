/**
 * Carries out the operations instanceReconciler decided: creates graphic elements inside
 * their layer containers and drives them through the OGraf lifecycle (load, playAction,
 * updateAction, stopAction, dispose).
 *
 * Two rules shape this file:
 *   - Operations on one layer run strictly one after the other, each waiting for the
 *     graphic's promise. Different layers each have their own queue and never wait for
 *     one another, so a slow animation on the clock cannot hold up a lower third.
 *   - A graphic that fails (its module cannot be imported, its load throws or is refused)
 *     is logged and leaves its layer empty. It never stops the queue of its own layer or
 *     of any other.
 *
 * What could go wrong: the renderer only awaits the graphic's promises (concept §6). A
 * graphic whose promise never settles blocks its own layer until the page is reloaded.
 */
import type { Graphic, Instance } from '@bajaovrlay/shared';

import type { GraphicLoader } from './graphicLoader.js';
import type { InstanceOperation, LayerOperations } from './instanceReconciler.js';
import type { LayerContainers } from './layerContainers.js';
import { type LifecycleCallSubject, makeLifecycleCall } from './lifecycleCall.js';
import type { OGrafGraphicElement } from './ografGraphicElement.js';
import { logRendererEvent } from './rendererLog.js';

// The stage is the stream canvas: horizontal 16:9 only (concept §18.6).
const stageResolution = { width: 1920, height: 1080 };

/** What the renderer asks of the player. */
export type InstancePlayer = {
  /**
   * Queues the operations of each layer behind whatever that layer is still doing and
   * returns at once. `graphics` is the current `graphics` slice, used to find the module
   * of a graphic that must be loaded.
   */
  runLayerOperations: (layerOperations: LayerOperations[], graphics: Graphic[]) => void;
};

/** What the player works with; `logEvent` is replaceable so a test could capture the log. */
export type InstancePlayerOptions = {
  layerContainers: LayerContainers;
  graphicLoader: GraphicLoader;
  logEvent?: typeof logRendererEvent;
};

/** A graphic element that was loaded successfully and sits in its layer's container. */
type GraphicOnLayer = {
  subject: LifecycleCallSubject;
  element: OGrafGraphicElement;
};

/** Builds the player for one stage. Nothing is on any layer until operations arrive. */
export function createInstancePlayer(options: InstancePlayerOptions): InstancePlayer {
  const { layerContainers, graphicLoader } = options;
  const logEvent = options.logEvent ?? logRendererEvent;

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
          // Nothing below is expected to throw; if it does, the layer's queue must go on.
          .catch((unexpectedError: unknown) => {
            logEvent('error', 'renderer operation failed unexpectedly', {
              layerId,
              operation: operation.kind,
              reason: String(unexpectedError),
            });
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
      await loadAndPlayInstance(operation.instance, graphics, operation.skipAnimation);
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
    // A replace. `out-then-in` animates the old graphic out and the new one in. `cut`
    // skips both animations. `crossfade` is treated as `cut` in M0: a real crossfade
    // needs both graphics on the layer at once, which no M0 graphic is designed for.
    // Trade-off of this order for `cut`: the layer is empty while the new graphic
    // loads; loading the new one first would avoid that and is left for when a layer
    // actually uses `cut` (every seeded layer is `out-then-in`).
    const skipAnimation = operation.replacePolicy !== 'out-then-in';
    await stopAndDisposeInstance(layerId, operation.outgoingInstanceId, skipAnimation);
    await loadAndPlayInstance(operation.incomingInstance, graphics, skipAnimation);
  }

  /** Creates the instance's element in its layer, loads it, then plays step 0. */
  async function loadAndPlayInstance(
    instance: Instance,
    graphics: Graphic[],
    skipAnimation: boolean,
  ): Promise<void> {
    const subject: LifecycleCallSubject = {
      instanceId: instance.id,
      layerId: instance.layerId,
      graphicId: instance.graphicId,
    };
    const element = await createGraphicElement(subject, graphics);
    if (element === undefined) {
      return;
    }
    // Two graphics must never share a layer. Nothing should be here (the reconciler
    // always clears a layer first), so this only guards against a bug elsewhere.
    await disposeWhateverIsOnLayer(instance.layerId);

    // The id is on the element for people reading the page in DevTools, and for tests.
    element.dataset.instanceId = instance.id;
    layerContainers.findContainerOfLayer(instance.layerId)?.append(element);

    const wasLoaded = await makeLifecycleCall(
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
      logEvent,
    );
    if (!wasLoaded) {
      element.remove();
      logCouldNotGoOnAir(subject, 'its load failed or was refused');
      return;
    }
    graphicOnLayerByLayerId.set(instance.layerId, { subject, element });

    await makeLifecycleCall(
      subject,
      {
        action: 'playAction',
        skipAnimation,
        run: () =>
          element.playAction(skipAnimation ? { goto: 0, skipAnimation: true } : { goto: 0 }),
      },
      logEvent,
    );
  }

  /**
   * Imports the graphic's module and creates its element (not yet on the page).
   * Undefined, after a log line, when the layer or the graphic is unknown or the module
   * cannot be loaded.
   */
  async function createGraphicElement(
    subject: LifecycleCallSubject,
    graphics: Graphic[],
  ): Promise<OGrafGraphicElement | undefined> {
    if (layerContainers.findContainerOfLayer(subject.layerId) === undefined) {
      logCouldNotGoOnAir(subject, 'its layer is not in the layers slice');
      return undefined;
    }
    const graphic = graphics.find((candidate) => candidate.id === subject.graphicId);
    if (graphic === undefined) {
      logCouldNotGoOnAir(subject, 'its graphic is not in the graphics slice');
      return undefined;
    }
    let tagName: string;
    try {
      tagName = await graphicLoader.defineGraphicElement(graphic);
    } catch (importError) {
      logCouldNotGoOnAir(subject, `its module could not be loaded: ${String(importError)}`);
      return undefined;
    }
    return document.createElement(tagName) as OGrafGraphicElement;
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

  function logCouldNotGoOnAir(subject: LifecycleCallSubject, reason: string): void {
    logEvent('error', 'graphic could not go on air; its layer stays empty', {
      ...subject,
      reason,
    });
  }

  return { runLayerOperations };
}
