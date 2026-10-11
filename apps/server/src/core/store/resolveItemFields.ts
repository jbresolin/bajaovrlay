import type { CommandError, ItemFields } from '@bajaovrlay/shared';

import { refuseUnsupportedFieldKind } from './rundownCommandRefusals.js';

/** What resolving an item's fields gives: the data for the graphic, or why it cannot be made. */
export type ItemFieldsResolution =
  | { status: 'resolved'; data: Record<string, unknown> }
  | { status: 'refused'; error: CommandError };

/**
 * Turns an item's field values into the plain data its graphic receives at the take.
 * Pure: it reads nothing but what it is given, the clock included. `momentOfTheTake` is
 * the moment the store gave the command (the reducer context's `now`, ISO 8601 text),
 * so the same call always gives the same data. A `literal` passes through as typed; a
 * `takeTime` becomes that moment in wall-clock milliseconds. M2 (BAJAOVRLAY-20) adds
 * values read from data sources, each as one more `case` below (and, then, more
 * parameters for the snapshots).
 * One field it cannot resolve refuses the whole item: a graphic must never go on air
 * with part of its data missing.
 */
export function resolveItemFieldsIntoGraphicData(
  fields: ItemFields,
  momentOfTheTake: string,
): ItemFieldsResolution {
  // The store always writes the moment with toISOString, which Date.parse reads back to
  // the exact millisecond. A text that is not a date would give NaN here; a graphic whose
  // schema asks for a whole number (the race clock does) then refuses the take.
  const momentOfTheTakeInMilliseconds = Date.parse(momentOfTheTake);
  const resolvedKeysAndValues: Array<[string, unknown]> = [];
  for (const [fieldKey, fieldValue] of Object.entries(fields)) {
    // Read as plain text on purpose, as a guard kept ready for M2 (BAJAOVRLAY-20): the
    // `default` below cannot be reached through the server today. A command carrying
    // another kind is refused earlier with INVALID_COMMAND by the command schema, and a
    // stored items row holding one fails its schema and stops the boot. Only a direct
    // call with hand-built fields gets here. The guard stays so that the day the schema
    // accepts a new kind before this function has its `case`, the take is refused in
    // words instead of resolving the field to nothing.
    const fieldKind: string = fieldValue.kind;
    switch (fieldValue.kind) {
      case 'literal':
        resolvedKeysAndValues.push([fieldKey, fieldValue.value]);
        break;
      case 'takeTime':
        resolvedKeysAndValues.push([fieldKey, momentOfTheTakeInMilliseconds]);
        break;
      default:
        return { status: 'refused', error: refuseUnsupportedFieldKind(fieldKey, fieldKind) };
    }
  }
  // Built from pairs so that a field key such as `__proto__` becomes an ordinary key of
  // the data instead of changing what kind of object the data is.
  return { status: 'resolved', data: Object.fromEntries(resolvedKeysAndValues) };
}
