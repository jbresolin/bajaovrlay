import type { DeleteItemCommand } from '@bajaovrlay/shared';

import { refuseUnknownItem } from '../rundownCommandRefusals.js';
import {
  findItemThatFollows,
  listItemsOfRundownInOrder,
  numberItemsByPositionInList,
} from './itemOrdering.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { putRundownCursorOnItem } from './rundownCursor.js';

/**
 * deleteItem: removes an item from its rundown and moves the items after it up by one.
 * If the rundown's cursor was on the deleted item, it moves to the item that followed
 * it, or to nothing when the deleted item was the last. Refused if the item does not exist.
 * A graphic already on air from the item is left on air, on purpose: preparing the
 * rundown must never change what viewers see.
 * What could go wrong: that instance keeps an `itemId` that no longer names any item,
 * so whoever reads it (the layer panel) must cope with not finding the item.
 */
export function reduceDeleteItem(
  slices: SlicesChangedByCommands,
  command: DeleteItemCommand,
): ReducerOutcome {
  const deletedItem = slices.items.find((item) => item.id === command.itemId);
  if (deletedItem === undefined) {
    return { status: 'refused', error: refuseUnknownItem(command.itemId) };
  }

  // Worked out before the item is removed, while "the item after it" can still be found.
  const rundown = slices.rundowns.find((candidate) => candidate.id === deletedItem.rundownId);
  const isCursorOnDeletedItem = rundown?.cursorItemId === deletedItem.id;
  const itemAfterDeletedOne = findItemThatFollows(slices.items, deletedItem);
  const rundownsAfter = isCursorOnDeletedItem
    ? putRundownCursorOnItem(
        slices.rundowns,
        deletedItem.rundownId,
        itemAfterDeletedOne?.id ?? null,
      )
    : slices.rundowns;

  const itemsKept = slices.items.filter((item) => item.id !== deletedItem.id);
  const itemIdsLeftInOrder = listItemsOfRundownInOrder(itemsKept, deletedItem.rundownId).map(
    (item) => item.id,
  );
  const itemsAfter = numberItemsByPositionInList(itemsKept, itemIdsLeftInOrder);

  return { status: 'applied', slices: { ...slices, items: itemsAfter, rundowns: rundownsAfter } };
}
