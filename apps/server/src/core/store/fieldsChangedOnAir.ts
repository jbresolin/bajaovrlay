// Which fields of an instance of an item were changed on air (BAJAOVRLAY-37): the rule
// updateInstanceData follows to write `fieldsChangedOnAir`. Pure, no state of its own.
import { isDeepStrictEqual } from 'node:util';

import type { Instance, Item } from '@bajaovrlay/shared';

/** What one updateInstanceData leaves behind, for working out the list. */
export type OnAirChange = {
  /** The instance as it was before the update. */
  instanceBefore: Instance;
  /** The instance's item as it is stored now; undefined when it was deleted since the take. */
  itemOfTheInstance: Item | undefined;
  /**
   * The keys the operator sent: those of the command's `data` (a `null` included) and
   * those named in its `takeTimeFieldKeys`. A key an update rule wrote by itself is not
   * among them, which is how carryClockForward's rewrites stay off the list.
   */
  keysSentByTheOperator: string[];
  /** The instance's data after the update. */
  dataAfterUpdate: Record<string, unknown>;
};

/**
 * The instance's list of fields changed on air after one update, or undefined when it has
 * none: the keys already listed, then each key the operator sent whose value on air now
 * differs from what the item gives (see doesValueOnAirDifferFromTheItem). An instance
 * with no item gets no list, since there is nothing to differ from; an instance whose
 * item was deleted lists every key sent.
 *
 * Deliberate: a key is never taken off the list, even when updated back to the item's
 * value (the brief's "keep it simple"); the list empties only with a new take or with
 * "Salvar no item". And the comparison is with the item as it is stored NOW, not as it
 * was at the take: "Atualizar no ar" of the item editor saves the item first and then
 * sends the same value to the air, which must not be listed as a change.
 * What could go wrong: an item edited with "Salvar" alone while its instance is on air
 * makes the air differ from the item without anything being listed, until the next
 * update of one of those fields.
 */
export function listFieldsChangedOnAirAfterUpdate(change: OnAirChange): string[] | undefined {
  const { instanceBefore, itemOfTheInstance, keysSentByTheOperator, dataAfterUpdate } = change;
  const keysListedBefore = instanceBefore.fieldsChangedOnAir ?? [];
  if (instanceBefore.itemId === undefined) {
    return instanceBefore.fieldsChangedOnAir;
  }

  const keysChangedByThisUpdate = keysSentByTheOperator.filter((sentKey) => {
    if (itemOfTheInstance === undefined) {
      return true;
    }
    return doesValueOnAirDifferFromTheItem(itemOfTheInstance, sentKey, dataAfterUpdate);
  });
  // A key sent in `data` and named for stamping too appears twice above; it is listed once.
  const keysListedAfter = [...keysListedBefore];
  for (const changedKey of keysChangedByThisUpdate) {
    if (!keysListedAfter.includes(changedKey)) {
      keysListedAfter.push(changedKey);
    }
  }
  if (keysListedAfter.length === 0) {
    return undefined;
  }
  return keysListedAfter;
}

/**
 * Whether one field on air now differs from what the item gives for it. A field the item
 * marks takeTime always differs once the operator sent it: the item gives "the moment of
 * the take", and anything sent replaced that. A bound field likewise: the item gives
 * "what the source says", and a value the operator sent replaced that. A literal is compared by content, and a
 * field missing on air counts as equal to a literal null and to a field the item does not
 * store at all, because a take leaves both out of the data.
 */
function doesValueOnAirDifferFromTheItem(
  item: Item,
  fieldKey: string,
  dataAfterUpdate: Record<string, unknown>,
): boolean {
  const fieldOfTheItem = item.fields[fieldKey];
  if (fieldOfTheItem?.kind === 'takeTime' || fieldOfTheItem?.kind === 'binding') {
    return true;
  }
  const isOnAir = Object.hasOwn(dataAfterUpdate, fieldKey);
  const valueTheItemGives = fieldOfTheItem === undefined ? null : fieldOfTheItem.value;
  const doesTheItemGiveAValue = valueTheItemGives !== null;
  const isMissingOnBothSides = !isOnAir && !doesTheItemGiveAValue;
  if (isMissingOnBothSides) {
    return false;
  }
  const isMissingOnOneSideOnly = !isOnAir || !doesTheItemGiveAValue;
  if (isMissingOnOneSideOnly) {
    return true;
  }
  return !isDeepStrictEqual(dataAfterUpdate[fieldKey], valueTheItemGives);
}

/**
 * The instances with these keys taken off the list of changed fields of every live
 * instance of this item, on program and in preview; a list left empty is removed. Used
 * when the item has just been given the newest value of those fields ("Salvar no item",
 * or the item editor's save), so the air no longer differs from the item on them and a
 * later "Salvar no item" cannot write an older value over a newer one.
 * The same array comes back when no list changed, so nothing is saved or broadcast.
 */
export function removeKeysFromFieldsChangedOnAirOfItem(
  instances: Instance[],
  itemId: string,
  keysTheItemNowGives: string[],
): Instance[] {
  let isAnyListChanged = false;
  const instancesAfter = instances.map((instance) => {
    const listBefore = instance.fieldsChangedOnAir;
    if (instance.itemId !== itemId || listBefore === undefined) {
      return instance;
    }
    const listAfter = listBefore.filter((fieldKey) => !keysTheItemNowGives.includes(fieldKey));
    if (listAfter.length === listBefore.length) {
      return instance;
    }
    isAnyListChanged = true;
    const instanceAfter: Instance = { ...instance };
    if (listAfter.length === 0) {
      delete instanceAfter.fieldsChangedOnAir;
    } else {
      instanceAfter.fieldsChangedOnAir = listAfter;
    }
    return instanceAfter;
  });
  return isAnyListChanged ? instancesAfter : instances;
}
