import {
  type ClockFieldKeysByRole,
  type InstanceBindings,
  type InstanceBoundField,
  type InstanceTarget,
  type ItemFields,
  wholeClockBindingPath,
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

/** The graphic fields one bound field fills: the four clock fields for the whole clock. */
function listFieldKeysFilledByBoundField(
  boundField: InstanceBoundField,
  clockFieldKeys: ClockFieldKeysByRole | undefined,
): string[] {
  const isWholeClock = boundField.binding.path === wholeClockBindingPath;
  if (isWholeClock && clockFieldKeys !== undefined) {
    return Object.values(clockFieldKeys);
  }
  return [boundField.fieldKey];
}

/**
 * The slice after an operator's updateInstanceData typed `keysTypedOnAir` into one
 * instance: each bound field that fills one of those keys is dropped, the whole clock as
 * one, and the entry goes when nothing is left. So the next refresh leaves what was typed
 * on air until the next take, which reads the item again (gate 2 of PR #18). The very
 * same list comes back when nothing was dropped.
 */
export function releaseBindingsOfFieldsTypedOnAir(
  instanceBindings: InstanceBindings,
  instanceId: string,
  keysTypedOnAir: string[],
  clockFieldKeys: ClockFieldKeysByRole | undefined,
): InstanceBindings {
  const entry = instanceBindings.find((candidate) => candidate.instanceId === instanceId);
  if (entry === undefined) {
    return instanceBindings;
  }
  const boundFieldsKept = entry.boundFields.filter((boundField) => {
    const keysFilled = listFieldKeysFilledByBoundField(boundField, clockFieldKeys);
    return !keysFilled.some((keyFilled) => keysTypedOnAir.includes(keyFilled));
  });
  if (boundFieldsKept.length === entry.boundFields.length) {
    return instanceBindings;
  }
  const otherEntries = instanceBindings.filter((candidate) => candidate !== entry);
  if (boundFieldsKept.length === 0) {
    return otherEntries;
  }
  return instanceBindings.map((candidate) =>
    candidate === entry ? { instanceId, boundFields: boundFieldsKept } : candidate,
  );
}
