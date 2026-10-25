/**
 * The queue of operations of each layer, for instancePlayer.ts: operations on one layer run
 * strictly one after the other, each waiting for the one before it; different layers each
 * have their own queue and never wait for one another, so a slow animation on the clock
 * cannot hold up a lower third. An operation that throws (a bug, not a graphic failing,
 * which the player handles itself) is logged, the instance it was putting on air is
 * reported failed, and the layer's queue goes on.
 */
import type { Graphic, Instance, InstanceStatusMessage } from '@bajaovrlay/shared';

import type { InstanceOperation, LayerOperations } from './instanceReconciler.js';
import type { logRendererEvent } from './rendererLog.js';

/** What the queue needs from the player: how to run one operation, report and log. */
export type LayerOperationQueueOptions = {
  runOneOperation: (
    layerId: string,
    operation: InstanceOperation,
    graphics: Graphic[],
  ) => Promise<void>;
  reportInstanceStatus: (statusReport: InstanceStatusMessage) => void;
  logEvent: typeof logRendererEvent;
};

/**
 * Builds the queues of one stage. `runLayerOperations` queues each layer's operations
 * behind whatever that layer is still doing and returns at once.
 */
export function createLayerOperationQueue(options: LayerOperationQueueOptions): {
  runLayerOperations: (layerOperations: LayerOperations[], graphics: Graphic[]) => void;
} {
  const { runOneOperation, reportInstanceStatus, logEvent } = options;
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
