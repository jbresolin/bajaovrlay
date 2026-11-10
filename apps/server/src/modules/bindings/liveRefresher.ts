// The refresher of bound fields (concept §5.2): after a source's data changed, every
// instance on air or in preview with live bindings on it gets the source's new values
// through refreshBoundInstanceData, signed `sistema:vinculos`, the one command path; and
// after the entity library changed, every instance that reads it (BAJAOVRLAY-19).
import type { SliceName } from '@bajaovrlay/shared';
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
 * read a source that changed (every instance with live bindings, for an override); when
 * a team, person, sponsor or slot changes, every instance that reads the library. It
 * reads each instance's entry of `instanceBindings`, never the item, and sends only what
 * changes (buildRefreshOfLiveBoundFields), so a poll that repeats what is on air sends
 * nothing.
 * Deliberate trade-offs:
 * - The refresh runs from a timer, not inside the store's listener, so one change is
 *   told to every listener before the next begins (as the macro runner does). Changes
 *   that land before the timer runs are refreshed together in one pass.
 * - A refresh the graphic's schema refuses, in part or in whole, is applied as far as it
 *   fits and its refused keys are kept on the instance's entry (refreshBoundInstanceData.ts),
 *   which also writes one failed event-log row per spell of refusals. The refresher keeps
 *   no memory of its own; it writes one warning to the server log when a spell begins.
 */
export function startLiveRefresher(options: LiveRefresherOptions): LiveRefresher {
  const { stateStore, logger } = options;
  const startTimer = options.startTimer ?? startNodeTimer;
  const cancelTimer = options.cancelTimer ?? cancelNodeTimer;
  // The sources changed since the last pass; undefined for "every source" (an override).
  let sourceIdsToRefresh: Set<string> | undefined = new Set();
  let haveEntitiesChangedSinceThePass = false;
  let pendingPassHandle: unknown;
  let isPassPending = false;

  /** Notes what changed and starts a pass unless one is already waiting. */
  function scheduleRefresh(
    changedSourceIds: string[],
    isEverySourceAffected: boolean,
    haveEntitiesChanged: boolean,
  ): void {
    if (haveEntitiesChanged) {
      haveEntitiesChangedSinceThePass = true;
    }
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
    const haveEntitiesChanged = haveEntitiesChangedSinceThePass;
    sourceIdsToRefresh = new Set();
    haveEntitiesChangedSinceThePass = false;
    isPassPending = false;
    try {
      const slices = stateStore.readAllSlices();
      for (const entry of slices.instanceBindings) {
        refreshOneInstance(slices, entry, sourceIdsThatChanged, haveEntitiesChanged);
      }
    } catch (refreshError) {
      logger.error({ err: refreshError }, 'refresh of bound fields crashed');
    }
  }

  /** Sends the refresh of one instance, when anything it shows changed. */
  function refreshOneInstance(
    slices: Slices,
    entry: Slices['instanceBindings'][number],
    sourceIdsThatChanged: ReadonlySet<string> | undefined,
    haveEntitiesChanged: boolean,
  ): void {
    const instanceId = entry.instanceId;
    const instance = slices.instances.find((candidate) => candidate.id === instanceId);
    if (instance === undefined) {
      return;
    }
    const data = buildRefreshOfLiveBoundFields({
      instance,
      boundFields: entry.boundFields,
      graphic: slices.graphics.find((graphic) => graphic.id === instance.graphicId),
      sources: {
        dataSources: slices.dataSources,
        dataSnapshots: slices.dataSnapshots,
        overrides: slices.overrides,
        bracketMatchFocuses: slices.bracketMatchFocuses,
      },
      sourceIdsThatChanged,
      entityFields: entry.entityFields ?? [],
      entities: slices,
      haveEntitiesChanged,
    });
    if (data === undefined) {
      return;
    }
    const command: RefreshBoundInstanceDataCommand = {
      type: 'refreshBoundInstanceData',
      instanceId,
      data,
    };
    const wasRefusedBefore = readRefusedFieldKeys(slices, instanceId) !== undefined;
    const outcome = stateStore.applyCommand(command, bindingRefresherActor);
    if (!outcome.ok) {
      logger.warn(
        { instance_id: instanceId, error: outcome.error },
        'refresh of bound fields was refused',
      );
      return;
    }
    const refusedFieldKeysNow = readRefusedFieldKeys(stateStore.readAllSlices(), instanceId);
    if (!wasRefusedBefore && refusedFieldKeysNow !== undefined) {
      logger.warn(
        { instance_id: instanceId, refused_field_keys: refusedFieldKeysNow },
        'refresh of bound fields was refused in part',
      );
    }
  }

  /** The keys of the instance whose last refresh was refused, from its entry, if any. */
  function readRefusedFieldKeys(slices: Slices, instanceId: string): string[] | undefined {
    const entry = slices.instanceBindings.find((candidate) => candidate.instanceId === instanceId);
    return entry?.refusedFieldKeys;
  }

  const stopWatchingTheStore = stateStore.subscribeToSliceChanges(
    (changedSliceNames, _slices, changedDataSnapshots) => {
      // A correction set or cleared changes what every source says from now on, so it
      // refreshes every bound instance; a snapshot only those bound to its source. A new
      // "agora" or "a seguir" of a Super Prime (BAJAOVRLAY-65) is read the same way as a
      // correction: every live binding is read again, and only the instances whose values
      // differ get a refresh, so the bug and the card follow at once and nothing else moves.
      const haveOverridesChanged = changedSliceNames.includes('overrides');
      const hasMatchFocusChanged = changedSliceNames.includes('bracketMatchFocuses');
      const isEverySourceAffected = haveOverridesChanged || hasMatchFocusChanged;
      const changedSourceIds = changedDataSnapshots.map((change) => change.sourceId);
      // An edit in Cadastros refreshes every instance that reads the library.
      const haveEntitiesChanged = changedSliceNames.some((sliceName) =>
        entitySliceNames.includes(sliceName),
      );
      if (isEverySourceAffected || changedSourceIds.length > 0 || haveEntitiesChanged) {
        scheduleRefresh(changedSourceIds, isEverySourceAffected, haveEntitiesChanged);
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

/** The slices of the entity library, whose change refreshes the fields that read it. */
const entitySliceNames: readonly SliceName[] = ['teams', 'people', 'sponsors', 'scheduleSlots'];

/** Node's setTimeout, as the default way to wait. */
function startNodeTimer(onTimeIsUp: () => void, delayInMilliseconds: number): unknown {
  return setTimeout(onTimeIsUp, delayInMilliseconds);
}

/** Node's clearTimeout, as the default way to cancel a wait. */
function cancelNodeTimer(timerHandle: unknown): void {
  clearTimeout(timerHandle as ReturnType<typeof setTimeout>);
}
