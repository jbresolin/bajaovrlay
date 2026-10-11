import type { Instance, Slices } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import type { StateStore } from './createStateStore.js';

/**
 * The actor every auto-out clear is signed with in the event log. `sistema` (pt-BR,
 * because people read the event log) says no operator sent it; it is not a renderer,
 * so any authorisation by role treats it like an operator and lets clearLayer through.
 */
export const autoOutActor = 'sistema:auto-out';

/** The longest wait Node's setTimeout honours: 2^31 - 1 ms, a little under 25 days. */
const longestDelayATimerCanWaitInMilliseconds = 2_147_483_647;

/** What the scheduler needs; the two timer functions default to Node's own. */
export type AutoOutSchedulerOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  /** Starts a wait and returns something cancelTimer can cancel it with. */
  startTimer?: ((onTimeIsUp: () => void, delayInMilliseconds: number) => unknown) | undefined;
  /** Cancels a wait started by startTimer. */
  cancelTimer?: ((timerHandle: unknown) => void) | undefined;
};

/** The running scheduler; stop() calls off every wait and stops watching the store. */
export type AutoOutScheduler = { stop: () => void };

/** One wait in progress: which layer to clear, and the handle that cancels the wait. */
type PendingAutoOut = { layerId: string; timerHandle: unknown };

/**
 * Watches the store and, whenever an item that has `autoOutAfterMs` is taken, waits
 * that long and then sends a clearLayer for the item's layer through
 * stateStore.applyCommand, the same single path every command takes, so the clear is
 * validated, saved, logged (as `sistema:auto-out`) and broadcast like any other.
 *
 * The wait belongs to the instance the take created. It is called off as soon as that
 * instance is gone, which is what "the layer changed" means here: another take on the
 * same layer and output, a clearLayer, a clearAll. Changes to the item afterwards (a
 * new delay, deleting the item) do not touch a wait already started.
 *
 * Deliberate trade-offs:
 * - Waits live in memory only. After a server restart nothing is rescheduled: an item
 *   that was on air with a delay stays on air until someone clears it. Rescheduling
 *   would have to guess how much of the delay the viewers already saw, and a graphic
 *   that stays too long is a smaller mistake than one that vanishes at a wrong moment.
 * - The delay counts from the moment the server accepted the take, not from the moment
 *   the graphic finished animating in on screen.
 * - clearLayer names only a layer, so the clear also removes whatever is on the same
 *   layer of the preview output at that moment.
 */
export function startAutoOutScheduler(options: AutoOutSchedulerOptions): AutoOutScheduler {
  const { stateStore, logger } = options;
  const startTimer = options.startTimer ?? startNodeTimer;
  const cancelTimer = options.cancelTimer ?? cancelNodeTimer;
  const pendingAutoOutByInstanceId = new Map<string, PendingAutoOut>();
  // Every instance already on air when the scheduler starts counts as seen, which is
  // exactly what makes a restart reschedule nothing.
  let instanceIdsAlreadySeen = listInstanceIds(stateStore.readAllSlices().instances);

  /** Runs after every command that changed the instances: cancel first, then schedule. */
  function followInstancesAfterChange(slices: Slices): void {
    const instanceIdsNow = listInstanceIds(slices.instances);
    for (const [instanceId, pendingAutoOut] of pendingAutoOutByInstanceId) {
      if (!instanceIdsNow.has(instanceId)) {
        cancelTimer(pendingAutoOut.timerHandle);
        pendingAutoOutByInstanceId.delete(instanceId);
      }
    }
    for (const instance of slices.instances) {
      if (!instanceIdsAlreadySeen.has(instance.id)) {
        startWaitIfItemHasAutoOut(instance, slices);
      }
    }
    instanceIdsAlreadySeen = instanceIdsNow;
  }

  /** Starts the wait for a new instance, if it came from an item that has a delay. */
  function startWaitIfItemHasAutoOut(newInstance: Instance, slices: Slices): void {
    const item = slices.items.find((candidate) => candidate.id === newInstance.itemId);
    if (item?.autoOutAfterMs === undefined) {
      return;
    }
    // Node turns a longer wait into a wait of one millisecond, which would take the
    // graphic off air at once. Leaving it on air and saying so in the log is safer.
    if (item.autoOutAfterMs > longestDelayATimerCanWaitInMilliseconds) {
      logger.warn(
        { item_id: item.id, auto_out_after_ms: item.autoOutAfterMs },
        'auto-out delay is longer than a timer can wait; the item stays on air',
      );
      return;
    }
    const timerHandle = startTimer(
      () => clearLayerWhenTimeIsUp(newInstance.id, newInstance.layerId),
      item.autoOutAfterMs,
    );
    pendingAutoOutByInstanceId.set(newInstance.id, { layerId: newInstance.layerId, timerHandle });
  }

  /**
   * Sends the clearLayer. Nothing may be thrown from here: this runs from a timer, where
   * an error nobody catches would stop the whole server, with graphics on air.
   */
  function clearLayerWhenTimeIsUp(instanceId: string, layerId: string): void {
    pendingAutoOutByInstanceId.delete(instanceId);
    try {
      const outcome = stateStore.applyCommand({ type: 'clearLayer', layerId }, autoOutActor);
      if (!outcome.ok) {
        logger.warn({ layer_id: layerId, error: outcome.error }, 'auto-out clear was refused');
      }
    } catch (clearError) {
      logger.error({ err: clearError, layer_id: layerId }, 'auto-out could not clear the layer');
    }
  }

  const stopWatchingTheStore = stateStore.subscribeToSliceChanges((changedSliceNames, slices) => {
    if (changedSliceNames.includes('instances')) {
      followInstancesAfterChange(slices);
    }
  });

  return {
    stop: () => {
      stopWatchingTheStore();
      for (const pendingAutoOut of pendingAutoOutByInstanceId.values()) {
        cancelTimer(pendingAutoOut.timerHandle);
      }
      pendingAutoOutByInstanceId.clear();
    },
  };
}

/** The ids of the given instances, as a set for quick "is it there?" questions. */
function listInstanceIds(instances: Instance[]): Set<string> {
  return new Set(instances.map((instance) => instance.id));
}

/** The default startTimer: Node's setTimeout. */
function startNodeTimer(onTimeIsUp: () => void, delayInMilliseconds: number): unknown {
  return setTimeout(onTimeIsUp, delayInMilliseconds);
}

/** The default cancelTimer: Node's clearTimeout, for a handle startNodeTimer returned. */
function cancelNodeTimer(timerHandle: unknown): void {
  clearTimeout(timerHandle as NodeJS.Timeout);
}
