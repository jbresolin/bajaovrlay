import {
  type ClockFieldKeysByRole,
  type InstanceBindings,
  type InstanceBindingsEntry,
  type InstanceBoundField,
  type InstanceEntityField,
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
 * The fields a new instance reads from the entity library, in the item's field order:
 * every one, on program and on preview alike, because an entity reference and an entity
 * list (BAJAOVRLAY-46) are always live (an edit, add or delete refreshes them; there is
 * nothing frozen to read again).
 */
export function listEntityFieldsKeptByNewInstance(fields: ItemFields): InstanceEntityField[] {
  const entityFields: InstanceEntityField[] = [];
  for (const [fieldKey, fieldValue] of Object.entries(fields)) {
    if (fieldValue.kind === 'entity' || fieldValue.kind === 'entityList') {
      entityFields.push({ fieldKey, entityReference: fieldValue });
    }
  }
  return entityFields;
}

/**
 * The slice with an entry for a new instance, or the very same list when it keeps no
 * bound field and no entity field (nothing to save or broadcast then).
 */
export function addBindingsOfNewInstance(
  instanceBindings: InstanceBindings,
  instanceId: string,
  boundFields: InstanceBoundField[],
  entityFields: InstanceEntityField[],
): InstanceBindings {
  const entry = buildEntryOfInstance(instanceId, boundFields, entityFields);
  if (entry === undefined) {
    return instanceBindings;
  }
  return [...instanceBindings, entry];
}

/**
 * One instance's entry with these fields, or undefined when it keeps none: the
 * entityFields key is left out when there is no entity field, as the schema wants.
 */
function buildEntryOfInstance(
  instanceId: string,
  boundFields: InstanceBoundField[],
  entityFields: InstanceEntityField[],
): InstanceBindingsEntry | undefined {
  if (boundFields.length === 0 && entityFields.length === 0) {
    return undefined;
  }
  if (entityFields.length === 0) {
    return { instanceId, boundFields };
  }
  return { instanceId, boundFields, entityFields };
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
 * one, and each entity field of those keys too; the entry goes when nothing is left. So
 * the next refresh leaves what was typed on air until the next take, which reads the
 * item again (gate 2 of PR #18). The very same list comes back when nothing was dropped.
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
  const entityFieldsBefore = entry.entityFields ?? [];
  const entityFieldsKept = entityFieldsBefore.filter(
    (entityField) => !keysTypedOnAir.includes(entityField.fieldKey),
  );
  const isAnythingReleased =
    boundFieldsKept.length !== entry.boundFields.length ||
    entityFieldsKept.length !== entityFieldsBefore.length;
  if (!isAnythingReleased) {
    return instanceBindings;
  }
  const entryAfter = buildEntryOfInstance(instanceId, boundFieldsKept, entityFieldsKept);
  if (entryAfter === undefined) {
    return instanceBindings.filter((candidate) => candidate !== entry);
  }
  return instanceBindings.map((candidate) => (candidate === entry ? entryAfter : candidate));
}
