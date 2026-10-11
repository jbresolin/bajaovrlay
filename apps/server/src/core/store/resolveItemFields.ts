import type { CommandError, ItemFields } from '@bajaovrlay/shared';

import { refuseUnsupportedFieldKind } from './rundownCommandRefusals.js';

/** What resolving an item's fields gives: the data for the graphic, or why it cannot be made. */
export type ItemFieldsResolution =
  | { status: 'resolved'; data: Record<string, unknown> }
  | { status: 'refused'; error: CommandError };

/**
 * Turns an item's field values into the plain data its graphic receives at the take.
 * Pure: it reads nothing but the fields it is given. Today every value is a `literal`
 * and passes through as typed; M2 (BAJAOVRLAY-20) adds values read from data sources,
 * each as one more `case` below (and, then, more parameters for the snapshots).
 * One field it cannot resolve refuses the whole item: a graphic must never go on air
 * with part of its data missing.
 */
export function resolveItemFieldsIntoGraphicData(fields: ItemFields): ItemFieldsResolution {
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
    switch (fieldKind) {
      case 'literal':
        resolvedKeysAndValues.push([fieldKey, fieldValue.value]);
        break;
      default:
        return { status: 'refused', error: refuseUnsupportedFieldKind(fieldKey, fieldKind) };
    }
  }
  // Built from pairs so that a field key such as `__proto__` becomes an ordinary key of
  // the data instead of changing what kind of object the data is.
  return { status: 'resolved', data: Object.fromEntries(resolvedKeysAndValues) };
}
