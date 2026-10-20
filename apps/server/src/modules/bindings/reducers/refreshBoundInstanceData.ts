import type { RefreshBoundInstanceDataCommand } from '@bajaovrlay/shared';

import { prepareInstanceDataUpdate } from '../../../core/store/instanceDataUpdate.js';
import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';

/**
 * refreshBoundInstanceData: writes a source's new values for an instance's live bound
 * fields, sent by the refresher (`sistema:vinculos`) after a snapshot or an override
 * changed. It runs updateInstanceData's steps (prepareInstanceDataUpdate: nulls, the
 * update rule, the no-change check, the manifest schema), so the instance keeps its id
 * and the renderer updates it in place, and a refresh can never put on air what an edit
 * could not. A whole clock reading sent by the clock group carries its own moment, so
 * the race clock's rule lets it through as it came.
 * Unlike an operator's update it never adds to `fieldsChangedOnAir` (those are the
 * operator's changes, and a source's update is not one) and never touches what only a
 * preview carries (its origin, the fields it stamps at the take).
 * An applied refresh is left out of the event log (`isLeftOutOfTheEventLog`), for the
 * reason a routine poll is (PR #16): one every poll would bury the operator's history.
 * A refresh for an instance that has just left (a clear between the poll and the
 * refresh) is answered ok and changes nothing, like a late poll.
 */
export function reduceRefreshBoundInstanceData(
  slices: SlicesChangedByCommands,
  command: RefreshBoundInstanceDataCommand,
  context: ReducerContext,
): ReducerOutcome {
  const instanceToRefresh = slices.instances.find((instance) => instance.id === command.instanceId);
  if (instanceToRefresh === undefined) {
    return { status: 'applied', slices };
  }
  const preparation = prepareInstanceDataUpdate(
    slices.graphics,
    instanceToRefresh,
    command.data,
    [],
    context.now,
  );
  if (preparation.status === 'refused') {
    return preparation;
  }
  if (preparation.status === 'unchanged') {
    return { status: 'applied', slices };
  }
  const instancesAfter = slices.instances.map((instance) =>
    instance.id === instanceToRefresh.id
      ? { ...instance, resolvedData: preparation.dataAfterUpdate }
      : instance,
  );
  return {
    status: 'applied',
    slices: { ...slices, instances: instancesAfter },
    isLeftOutOfTheEventLog: true,
  };
}
