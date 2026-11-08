import {
  type ClockFieldKeysByRole,
  findClockFieldKeysByRole,
} from '../bindings/bindingFitsGraphicField.js';
import { listFieldKeysItemReadsFromASource } from '../bindings/itemFieldsReadFromASource.js';
import { areJsonValuesEqual } from '../dataSources/areJsonValuesEqual.js';
import type { Graphic } from '../slices/graphic.js';
import type { Instance } from '../slices/instance.js';
import type { Item } from './item.js';

/**
 * The fields of an instance on air that are behind its item ("item mudou" in Camadas,
 * BAJAOVRLAY-38): those the item holds as typed values and the air shows otherwise, in the
 * item's order. Fields changed on air are left to "alterado no ar", a clock whole.
 * Empty for a deleted item, an instance with no item and a graphic no longer listed.
 */
export function findWhereTheItemIsAheadOfTheAir(
  instance: Instance,
  item: Item | undefined,
  graphic: Graphic | undefined,
): string[] {
  // A deleted item keeps "item excluído"; with no graphic there is nothing to offer, since
  // the take and the update both need it.
  const isTheInstanceOwnItem = item !== undefined && instance.itemId === item.id;
  if (!isTheInstanceOwnItem || graphic === undefined) {
    return [];
  }

  const clockFieldKeys = findClockFieldKeysByRole(graphic);
  const keysReadFromASource = listFieldKeysItemReadsFromASource(item.fields, clockFieldKeys);
  const keysLeftToChangedOnAir = listKeysLeftToChangedOnAir(instance, clockFieldKeys);

  const keysBehind: string[] = [];
  for (const [fieldKey, fieldOfTheItem] of Object.entries(item.fields)) {
    // Only a typed value can be behind: a binding, a library record, a list, an event
    // field or the moment of the take each give "whatever it is now", never a value.
    if (fieldOfTheItem.kind !== 'literal') {
      continue;
    }
    // A clock read whole from a source keeps its three other parts in the item as typed
    // values the take never uses (itemFieldsReadFromASource.ts).
    if (keysReadFromASource.includes(fieldKey)) {
      continue;
    }
    if (keysLeftToChangedOnAir.includes(fieldKey)) {
      continue;
    }
    if (doesTheAirShowSomethingElse(instance.resolvedData, fieldKey, fieldOfTheItem.value)) {
      keysBehind.push(fieldKey);
    }
  }
  return keysBehind;
}

/**
 * The keys "alterado no ar" speaks for: those listed on the instance, and the whole clock
 * once any part of it is listed. Deliberate: the server's carryClockForward rewrites the
 * clock's time and moment when the clock is started or stopped on air without listing
 * them, so the time on air then differs from the item though the item did not change.
 */
function listKeysLeftToChangedOnAir(
  instance: Instance,
  clockFieldKeys: ClockFieldKeysByRole | undefined,
): string[] {
  const keysListedOnAir = instance.fieldsChangedOnAir ?? [];
  if (clockFieldKeys === undefined) {
    return keysListedOnAir;
  }
  const keysOfTheClock = [
    clockFieldKeys.clockTime,
    clockFieldKeys.wallClock,
    clockFieldKeys.clockRunning,
    clockFieldKeys.clockMode,
  ];
  const isAPartOfTheClockListed = keysListedOnAir.some((fieldKey) =>
    keysOfTheClock.includes(fieldKey),
  );
  return isAPartOfTheClockListed ? [...keysListedOnAir, ...keysOfTheClock] : keysListedOnAir;
}

/**
 * Whether the air shows something other than the item's typed value, by content. The
 * server's own rule (apps/server fieldsChangedOnAir.ts): a field missing on air counts as
 * equal to an empty (null) value, because a take leaves an empty value out of the data.
 */
function doesTheAirShowSomethingElse(
  dataOnAir: Record<string, unknown>,
  fieldKey: string,
  valueInTheItem: unknown,
): boolean {
  const isOnAir = Object.hasOwn(dataOnAir, fieldKey);
  const isEmptyInTheItem = valueInTheItem === null;
  if (!isOnAir) {
    return !isEmptyInTheItem;
  }
  return !areJsonValuesEqual(dataOnAir[fieldKey], valueInTheItem);
}
