import type { Instance, Slices } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import type { StateStore } from './createStateStore.js';

/**
 * The actor every auto-out clear is signed with in the event log. `sistema` (pt-BR,
 * because people read the event log) says no operator sent it. The default
 * authorisation hook lets a `sistema:` actor send clearLayer and nothing else, so this
 * scheduler must never be made to send another command without changing that rule too.
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
 * Watches the store and, whenever an item that has `autoOutAfterMs` goes on the program
 * output (takeItem, takeNext, or takePreview or takeAllPreviews of a preview of that
 * item: any new program instance carrying its id), waits that
 * long and then sends a clearLayer of the item's layer, aimed at program, through
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
 *   that was on air with a delay stays on air until someone clears it. An instance that
 *   carries its own delay (an event's notice, the plain sponsor roll's pass) is instead taken
 *   off air by the boot (loadInitialSlices.ts), since it was never meant to stay. Rescheduling
 *   would have to guess how much of the delay the viewers already saw, and a graphic
 *   that stays too long is a smaller mistake than one that vanishes at a wrong moment.
 * - The delay counts from the moment the server accepted the take, not from the moment
 *   the graphic finished animating in on screen.
 * - The clear is a clearLayer aimed at program, so a preview the operator prepared on
 *   that layer stays. It still names only a layer, not the instance, but by then the
 *   wait's instance is the layer's program instance (another one would have called the
 *   wait off).
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

  /**
   * Starts the wait for a new instance, if it is on air and came from an item that has
   * a delay.
   */
  function startWaitIfItemHasAutoOut(newInstance: Instance, slices: Slices): void {
    // An item that is only previewed is not on air: no wait. What could go wrong without
    // this: the wait of a preview would end in a clear of the layer's program, and so
    // take off air whatever program shows there. When the preview
    // is sent to air (takePreview) a new program instance appears, and its wait starts
    // then, from that take.
    if (newInstance.target !== 'program') {
      return;
    }
    // An event's instance carries its rule's duration, which wins over the item's own
    // delay (BAJAOVRLAY-44); any other instance waits as long as its item says.
    const item = slices.items.find((candidate) => candidate.id === newInstance.itemId);
    const autoOutAfterMs = newInstance.autoOutAfterMs ?? item?.autoOutAfterMs;
    if (autoOutAfterMs === undefined) {
      return;
    }
    // Node turns a longer wait into a wait of one millisecond, which would take the
    // graphic off air at once. Leaving it on air and saying so in the log is safer.
    if (autoOutAfterMs > longestDelayATimerCanWaitInMilliseconds) {
      logger.warn(
        { item_id: newInstance.itemId, auto_out_after_ms: autoOutAfterMs },
        'auto-out delay is longer than a timer can wait; the item stays on air',
      );
      return;
    }
    const timerHandle = startTimer(
      () => clearLayerWhenTimeIsUp(newInstance.id, newInstance.layerId),
      autoOutAfterMs,
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
      const outcome = stateStore.applyCommand(
        { type: 'clearLayer', layerId, target: 'program' },
        autoOutActor,
      );
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
