/**
 * The two rules of the race clock that decide which of its fields an update sends,
 * beyond "the field differs from the stored one". They are about the clock's reference:
 * the time it shows (`referenceTimeMs`), whether it runs (`running`) and the moment it
 * counts from (`referenceWallClockMs`).
 *
 * Temporary home: this file knows field names of one graphic by heart. It moves out of
 * the item editor entirely in BAJAOVRLAY-14, when forms are generated from the manifest.
 */
import type { ItemFields } from '@bajaovrlay/shared';

import {
  hasReferenceMomentTheClockCanUse,
  isStoredReferenceTimeTheOneTheFormHolds,
} from './raceClockItemFields';

/**
 * Takes the race clock fields that differ from the stored item and returns the ones an
 * update must really send. Two fields can look different without the operator having
 * touched the clock, and are taken out again:
 *
 * 1. The time, when the stored time has a part of a second (only a script stores that).
 *    The form works in whole seconds, so it hands back 90 000 ms for a stored 90 500 ms.
 *    The time counts as changed only when the form shows another mm:ss than the item.
 * 2. The reference moment, when the item stores a number the clock can use (an item
 *    saved by an earlier editor, or by a script). The form always builds "the moment of
 *    the take", which differs from any number. Replacing the number changes where a
 *    running clock counts from, so it travels only together with a changed time or a
 *    changed "running": a label-only edit never rewrites the clock.
 *
 * A missing or unusable reference moment is always sent, because the graphic needs one.
 * What could go wrong: an item stored running with a number keeps counting from that
 * number, not from the take, until the operator changes its time or stops and starts it.
 */
export function applyRaceClockReferenceRules(
  fieldsThatDiffer: ItemFields,
  fieldsOnTheItem: ItemFields,
): ItemFields {
  const fieldsToSend: ItemFields = { ...fieldsThatDiffer };

  // Rule 1: a time the form shows the same way as the item stores it was not changed.
  const timeFromTheForm = fieldsThatDiffer.referenceTimeMs;
  const isTimeTheOneTheItemStores =
    timeFromTheForm !== undefined &&
    timeFromTheForm.kind === 'literal' &&
    typeof timeFromTheForm.value === 'number' &&
    isStoredReferenceTimeTheOneTheFormHolds(fieldsOnTheItem, timeFromTheForm.value);
  if (isTimeTheOneTheItemStores) {
    delete fieldsToSend.referenceTimeMs;
  }

  // Rule 2: a usable stored reference moment is replaced only with a new clock reference.
  const isClockReferenceChanged =
    fieldsToSend.referenceTimeMs !== undefined || fieldsToSend.running !== undefined;
  const isStoredReferenceMomentUsable = hasReferenceMomentTheClockCanUse(fieldsOnTheItem);
  if (isStoredReferenceMomentUsable && !isClockReferenceChanged) {
    delete fieldsToSend.referenceWallClockMs;
  }

  return fieldsToSend;
}
