import { wholeClockBindingPath } from '../dataShapes/bindablePaths.js';
import type { ItemFields } from '../rundown/fieldValue.js';
import type { ClockFieldKeysByRole } from './bindingFitsGraphicField.js';

/**
 * The keys of the fields an item reads from a source, in the item's order: every field
 * stored as a binding, live or frozen, and for the whole clock ("Relógio da fonte", stored
 * on the time field) the graphic's four clock fields; and every field that reads the
 * entity library (BAJAOVRLAY-19), for the same reason. "Salvar no item" leaves these as
 * they are (gate 2 of PR #18): writing the value on air over a binding would quietly stop
 * the field following its source. `clockFieldKeys` is the graphic's
 * (findClockFieldKeysByRole), undefined when it has no clock.
 */
export function listFieldKeysItemReadsFromASource(
  fields: ItemFields,
  clockFieldKeys: ClockFieldKeysByRole | undefined,
): string[] {
  const keys: string[] = [];
  for (const [fieldKey, fieldValue] of Object.entries(fields)) {
    if (fieldValue.kind === 'entity') {
      keys.push(fieldKey);
      continue;
    }
    if (fieldValue.kind !== 'binding') {
      continue;
    }
    const isWholeClock = fieldValue.path === wholeClockBindingPath && clockFieldKeys !== undefined;
    if (isWholeClock) {
      keys.push(
        clockFieldKeys.clockTime,
        clockFieldKeys.wallClock,
        clockFieldKeys.clockRunning,
        clockFieldKeys.clockMode,
      );
      continue;
    }
    keys.push(fieldKey);
  }
  return keys;
}
