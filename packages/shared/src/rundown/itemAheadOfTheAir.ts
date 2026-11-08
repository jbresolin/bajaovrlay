import {
  findClockFieldKeysByRole,
  readSchemaPropertyOfField,
} from '../bindings/bindingFitsGraphicField.js';
import { areJsonValuesEqual } from '../dataSources/areJsonValuesEqual.js';
import type { Graphic } from '../slices/graphic.js';
import type { Instance } from '../slices/instance.js';
import type { Item } from './item.js';

/**
 * The fields of an instance on air that are behind its item ("item mudou" in Camadas,
 * BAJAOVRLAY-38): those the item holds as typed values, then those it no longer stores,
 * where the air shows otherwise. Never a clock, nor a field changed on air. Empty for a
 * deleted item, an instance with no item and a graphic no longer listed.
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

  // Deliberate (gate 2 of PR #49): a clock is never behind. Its update rule writes its
  // reference on the server (carryClockForward, a stamped moment), so "the air matches the
  // item" cannot be read field by field: an update would bring the chip straight back, and
  // a second press would make a running clock jump. A changed clock reaches air with a take.
  const keysOfTheClock = listKeysOfTheClock(graphic);
  // The two marks never name the same field: these belong to "alterado no ar".
  const keysChangedOnAir = instance.fieldsChangedOnAir ?? [];
  const keysLeftOut = [...keysOfTheClock, ...keysChangedOnAir];

  const keysBehind: string[] = [];
  for (const [fieldKey, fieldOfTheItem] of Object.entries(item.fields)) {
    // Only a typed value can be behind: a binding, a library record, a list, an event
    // field or the moment of the take each give "whatever it is now", never a value.
    if (fieldOfTheItem.kind !== 'literal' || keysLeftOut.includes(fieldKey)) {
      continue;
    }
    if (doesTheAirShowSomethingElse(instance.resolvedData, fieldKey, fieldOfTheItem.value)) {
      keysBehind.push(fieldKey);
    }
  }

  // A field the item no longer stores gives nothing, as an empty value does (the server's
  // rule): the air is behind while it still shows a value there. Only a field the graphic
  // declares: an older package's key has no title to name and no place in an update.
  for (const fieldKey of Object.keys(instance.resolvedData)) {
    const isStoredByTheItem = Object.hasOwn(item.fields, fieldKey);
    const isDeclaredByTheGraphic =
      readSchemaPropertyOfField(graphic.manifest.schema, fieldKey) !== undefined;
    if (isStoredByTheItem || !isDeclaredByTheGraphic || keysLeftOut.includes(fieldKey)) {
      continue;
    }
    if (doesTheAirShowSomethingElse(instance.resolvedData, fieldKey, null)) {
      keysBehind.push(fieldKey);
    }
  }
  return keysBehind;
}

/** The graphic's four clock fields (time, moment, switch and mode), or none without a clock. */
function listKeysOfTheClock(graphic: Graphic): string[] {
  const clockFieldKeys = findClockFieldKeysByRole(graphic);
  if (clockFieldKeys === undefined) {
    return [];
  }
  return [
    clockFieldKeys.clockTime,
    clockFieldKeys.wallClock,
    clockFieldKeys.clockRunning,
    clockFieldKeys.clockMode,
  ];
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
