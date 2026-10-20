import { isDeepStrictEqual } from 'node:util';

import {
  findClockFieldKeysByRole,
  type Instance,
  type InstanceBindings,
  type RefreshBoundInstanceDataCommand,
} from '@bajaovrlay/shared';

import { prepareInstanceDataUpdate } from '../../../core/store/instanceDataUpdate.js';
import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { splitRefreshIntoParts } from './refreshSplitIntoParts.js';

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
 * When the whole set is refused, the clock group and each other field are tried alone
 * (refreshSplitIntoParts.ts), each on the data the parts before it left: what fits goes
 * on air, and the refused keys are written on the instance's entry of `instanceBindings`
 * (`refusedFieldKeys`, the chip "atualização recusada"). A refresh that fits as a whole
 * clears them. The refresh that begins a spell of refusals (no keys before, some now)
 * asks the store to log it as failed with the whole set's reason
 * (`refusalWrittenToTheEventLog`); the rest of the spell writes no row, so a source
 * polled every two seconds cannot fill the log (gate 2 of PR #18). An instance with no
 * entry has nowhere to keep the spell, so its refusal is a plain refusal.
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
  const wholeSet = prepareInstanceDataUpdate(
    slices.graphics,
    instanceToRefresh,
    command.data,
    [],
    context.now,
  );
  if (wholeSet.status === 'unchanged') {
    return buildRefreshOutcome(slices, instanceToRefresh, instanceToRefresh.resolvedData, []);
  }
  if (wholeSet.status === 'prepared') {
    return buildRefreshOutcome(slices, instanceToRefresh, wholeSet.dataAfterUpdate, []);
  }

  // The whole set was refused: try each part on the data the parts before it left.
  const graphic = slices.graphics.find((candidate) => candidate.id === instanceToRefresh.graphicId);
  const parts = splitRefreshIntoParts(
    command.data,
    graphic === undefined ? undefined : findClockFieldKeysByRole(graphic),
  );
  let instanceSoFar: Instance = instanceToRefresh;
  const refusedFieldKeys: string[] = [];
  for (const part of parts) {
    const preparation = prepareInstanceDataUpdate(
      slices.graphics,
      instanceSoFar,
      part,
      [],
      context.now,
    );
    if (preparation.status === 'refused') {
      refusedFieldKeys.push(...Object.keys(part));
    }
    if (preparation.status === 'prepared') {
      instanceSoFar = { ...instanceSoFar, resolvedData: preparation.dataAfterUpdate };
    }
  }
  const entry = slices.instanceBindings.find(
    (candidate) => candidate.instanceId === instanceToRefresh.id,
  );
  if (entry === undefined) {
    return wholeSet;
  }
  const outcome = buildRefreshOutcome(
    slices,
    instanceToRefresh,
    instanceSoFar.resolvedData,
    refusedFieldKeys,
  );
  const doesASpellOfRefusalsBegin = entry.refusedFieldKeys === undefined;
  if (outcome.status === 'applied' && doesASpellOfRefusalsBegin) {
    return { ...outcome, refusalWrittenToTheEventLog: wholeSet.error };
  }
  return outcome;
}

/**
 * The applied refresh: the instance with its new data and its entry with these refused
 * keys (none: no list). The very same slices when neither changed, so nothing is saved
 * or broadcast.
 */
function buildRefreshOutcome(
  slices: SlicesChangedByCommands,
  instanceBefore: Instance,
  dataAfter: Record<string, unknown>,
  refusedFieldKeys: string[],
): ReducerOutcome {
  const isDataChanged = !isDeepStrictEqual(dataAfter, instanceBefore.resolvedData);
  const instanceBindingsAfter = writeRefusedFieldKeys(
    slices.instanceBindings,
    instanceBefore.id,
    refusedFieldKeys,
  );
  const isEntryChanged = instanceBindingsAfter !== slices.instanceBindings;
  if (!isDataChanged && !isEntryChanged) {
    return { status: 'applied', slices };
  }
  const instancesAfter = isDataChanged
    ? slices.instances.map((instance) =>
        instance.id === instanceBefore.id ? { ...instance, resolvedData: dataAfter } : instance,
      )
    : slices.instances;
  return {
    status: 'applied',
    slices: { ...slices, instances: instancesAfter, instanceBindings: instanceBindingsAfter },
    isLeftOutOfTheEventLog: true,
  };
}

/** The slice with these refused keys on the instance's entry; the same list when unchanged. */
function writeRefusedFieldKeys(
  instanceBindings: InstanceBindings,
  instanceId: string,
  refusedFieldKeys: string[],
): InstanceBindings {
  const entry = instanceBindings.find((candidate) => candidate.instanceId === instanceId);
  if (entry === undefined) {
    return instanceBindings;
  }
  const keysBefore = entry.refusedFieldKeys ?? [];
  if (isDeepStrictEqual(keysBefore, refusedFieldKeys)) {
    return instanceBindings;
  }
  const entryAfter =
    refusedFieldKeys.length === 0
      ? { instanceId: entry.instanceId, boundFields: entry.boundFields }
      : { ...entry, refusedFieldKeys };
  return instanceBindings.map((candidate) => (candidate === entry ? entryAfter : candidate));
}
