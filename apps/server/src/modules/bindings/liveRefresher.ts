// The refresher of bound fields (concept §5.2): after a source's data changed, every
// instance on air or in preview with live bindings on it gets the source's new values
// through refreshBoundInstanceData, signed `sistema:vinculos`, the one command path.
import type { RefreshBoundInstanceDataCommand, Slices } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { bindingRefresherActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { buildRefreshOfLiveBoundFields } from './liveFieldsRefresh.js';

/** What the refresher needs; the two timer functions default to Node's own. */
export type LiveRefresherOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  /** Starts a wait and returns something cancelTimer can cancel it with. */
  startTimer?: ((onTimeIsUp: () => void, delayInMilliseconds: number) => unknown) | undefined;
  /** Cancels a wait started by startTimer. */
  cancelTimer?: ((timerHandle: unknown) => void) | undefined;
};

/** The running refresher; stop() calls off a pending refresh and stops watching the store. */
export type LiveRefresher = { stop: () => void };

/**
 * Watches the store: when snapshots change (a good poll, a deleted source) or the
 * overrides change, it refreshes, from a 0 ms timer, every instance whose live bindings
 * read a source that changed (every instance with live bindings, for an override). It
 * reads each instance's entry of `instanceBindings`, never the item, and sends only what
 * changes (buildRefreshOfLiveBoundFields), so a poll that repeats what is on air sends
 * nothing.
 * Deliberate trade-offs:
 * - The refresh runs from a timer, not inside the store's listener, so one change is
 *   told to every listener before the next begins (as the macro runner does). Changes
 *   that land before the timer runs are refreshed together in one pass.
 * - A refused refresh (the graphic's schema refuses the source's value) is logged as a
 *   failed row once per instance: the refresher remembers the instance and asks the
 *   store to leave the next refusals out of the event log until a refresh of it succeeds
 *   (ApplyCommandOptions), so a poll every two seconds cannot fill the log. The memory
 *   lives here, so after a restart the first refusal is logged again.
 */
export function startLiveRefresher(options: LiveRefresherOptions): LiveRefresher {
  const { stateStore, logger } = options;
  const startTimer = options.startTimer ?? startNodeTimer;
  const cancelTimer = options.cancelTimer ?? cancelNodeTimer;
  // The sources changed since the last pass; undefined for "every source" (an override).
  let sourceIdsToRefresh: Set<string> | undefined = new Set();
  let pendingPassHandle: unknown;
  let isPassPending = false;
  const instanceIdsWhoseRefreshWasRefused = new Set<string>();

  /** Notes what changed and starts a pass unless one is already waiting. */
  function scheduleRefresh(changedSourceIds: string[], isEverySourceAffected: boolean): void {
    if (isEverySourceAffected) {
      sourceIdsToRefresh = undefined;
    } else if (sourceIdsToRefresh !== undefined) {
      for (const sourceId of changedSourceIds) {
        sourceIdsToRefresh.add(sourceId);
      }
    }
    if (!isPassPending) {
      isPassPending = true;
      pendingPassHandle = startTimer(runRefreshPass, 0);
    }
  }

  /** One pass over every instance with bindings. Never throws: it runs from a timer. */
  function runRefreshPass(): void {
    const sourceIdsThatChanged = sourceIdsToRefresh;
    sourceIdsToRefresh = new Set();
    isPassPending = false;
    try {
      const slices = stateStore.readAllSlices();
      forgetInstancesThatLeft(slices);
      for (const entry of slices.instanceBindings) {
        refreshOneInstance(slices, entry.instanceId, entry.boundFields, sourceIdsThatChanged);
      }
    } catch (refreshError) {
      logger.error({ err: refreshError }, 'refresh of bound fields crashed');
    }
  }

  /** Sends the refresh of one instance, when anything it shows changed. */
  function refreshOneInstance(
    slices: Slices,
    instanceId: string,
    boundFields: Slices['instanceBindings'][number]['boundFields'],
    sourceIdsThatChanged: ReadonlySet<string> | undefined,
  ): void {
    const instance = slices.instances.find((candidate) => candidate.id === instanceId);
    if (instance === undefined) {
      return;
    }
    const data = buildRefreshOfLiveBoundFields({
      instance,
      boundFields,
      graphic: slices.graphics.find((graphic) => graphic.id === instance.graphicId),
      sources: {
        dataSources: slices.dataSources,
        dataSnapshots: slices.dataSnapshots,
        overrides: slices.overrides,
      },
      sourceIdsThatChanged,
    });
    if (data === undefined) {
      return;
    }
    const command: RefreshBoundInstanceDataCommand = {
      type: 'refreshBoundInstanceData',
      instanceId,
      data,
    };
    const wasRefusedBefore = instanceIdsWhoseRefreshWasRefused.has(instanceId);
    const outcome = stateStore.applyCommand(command, bindingRefresherActor, {
      isRefusalLeftOutOfTheEventLog: wasRefusedBefore,
    });
    if (outcome.ok) {
      instanceIdsWhoseRefreshWasRefused.delete(instanceId);
      return;
    }
    if (!wasRefusedBefore) {
      logger.warn(
        { instance_id: instanceId, error: outcome.error },
        'refresh of bound fields was refused',
      );
    }
    instanceIdsWhoseRefreshWasRefused.add(instanceId);
  }

  /** Lets go of the refusals of instances no longer there. */
  function forgetInstancesThatLeft(slices: Slices): void {
    for (const instanceId of instanceIdsWhoseRefreshWasRefused) {
      const isStillThere = slices.instances.some((instance) => instance.id === instanceId);
      if (!isStillThere) {
        instanceIdsWhoseRefreshWasRefused.delete(instanceId);
      }
    }
  }

  const stopWatchingTheStore = stateStore.subscribeToSliceChanges(
    (changedSliceNames, _slices, changedDataSnapshots) => {
      // A correction set or cleared changes what every source says from now on, so it
      // refreshes every bound instance; a snapshot only those bound to its source.
      const haveOverridesChanged = changedSliceNames.includes('overrides');
      const changedSourceIds = changedDataSnapshots.map((change) => change.sourceId);
      if (haveOverridesChanged || changedSourceIds.length > 0) {
        scheduleRefresh(changedSourceIds, haveOverridesChanged);
      }
    },
  );

  return {
    stop: () => {
      stopWatchingTheStore();
      if (isPassPending) {
        cancelTimer(pendingPassHandle);
        isPassPending = false;
      }
    },
  };
}

/** Node's setTimeout, as the default way to wait. */
function startNodeTimer(onTimeIsUp: () => void, delayInMilliseconds: number): unknown {
  return setTimeout(onTimeIsUp, delayInMilliseconds);
}

/** Node's clearTimeout, as the default way to cancel a wait. */
function cancelNodeTimer(timerHandle: unknown): void {
  clearTimeout(timerHandle as ReturnType<typeof setTimeout>);
}
