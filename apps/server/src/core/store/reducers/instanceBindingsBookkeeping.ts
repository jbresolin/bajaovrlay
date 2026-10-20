import type {
  InstanceBindings,
  InstanceBoundField,
  InstanceTarget,
  ItemFields,
} from '@bajaovrlay/shared';

import type { SlicesChangedByCommands } from './reducerTypes.js';

/**
 * The bound fields a new instance keeps from its item, in the item's field order: on
 * program its live bindings only (the refreshes read them); on preview its frozen ones
 * too, because "Tomar" reads a frozen field again: frozen at the take, not at the
 * preview, as a takeTime field is (concept §5.3).
 */
export function listBoundFieldsKeptByNewInstance(
  fields: ItemFields,
  target: InstanceTarget,
): InstanceBoundField[] {
  const boundFields: InstanceBoundField[] = [];
  for (const [fieldKey, fieldValue] of Object.entries(fields)) {
    if (fieldValue.kind !== 'binding') {
      continue;
    }
    const isKept = target === 'preview' || fieldValue.isLive;
    if (isKept) {
      boundFields.push({ fieldKey, binding: fieldValue });
    }
  }
  return boundFields;
}

/**
 * The slice with an entry for a new instance, or the very same list when it keeps no
 * bound field (nothing to save or broadcast then).
 */
export function addBindingsOfNewInstance(
  instanceBindings: InstanceBindings,
  instanceId: string,
  boundFields: InstanceBoundField[],
): InstanceBindings {
  if (boundFields.length === 0) {
    return instanceBindings;
  }
  return [...instanceBindings, { instanceId, boundFields }];
}

/**
 * Drops the entries of instances that are no longer there, whatever took them away (a
 * clear, a replace, a promoted preview, a discarded preview, a macro's preview). Run once
 * after every applied command, in reduceCommand, so no path that removes an instance can
 * forget its bindings. The same slices come back when nothing was dropped.
 */
export function dropBindingsOfInstancesGone(
  slices: SlicesChangedByCommands,
): SlicesChangedByCommands {
  const instanceIdsStillThere = new Set(slices.instances.map((instance) => instance.id));
  const entriesKept = slices.instanceBindings.filter((entry) =>
    instanceIdsStillThere.has(entry.instanceId),
  );
  if (entriesKept.length === slices.instanceBindings.length) {
    return slices;
  }
  return { ...slices, instanceBindings: entriesKept };
}
