// The order of a rundown's items: renumbering it and finding what follows an item. Every
// reducer that adds, removes or moves an item goes through here, so a rundown is always
// numbered 0, 1, 2, ... with no gaps and no repeats. Reading the order itself is
// `listItemsOfRundownInOrder` of @bajaovrlay/shared, which the control page uses too.
import { type Item, listItemsOfRundownInOrder } from '@bajaovrlay/shared';

/**
 * Gives each item named in `orderedItemIds` the position it has in that list (the first
 * id gets 0, the next 1, ...). An item whose position does not change, and every item
 * not named (the items of other rundowns), is handed back as the very same object.
 * The caller must name every item of the rundown exactly once, or the rundown ends up
 * with two items in one position.
 */
export function numberItemsByPositionInList(items: Item[], orderedItemIds: string[]): Item[] {
  const positionByItemId = new Map<string, number>();
  orderedItemIds.forEach((itemId, position) => {
    positionByItemId.set(itemId, position);
  });

  return items.map((item) => {
    const newPosition = positionByItemId.get(item.id);
    if (newPosition === undefined || newPosition === item.order) {
      return item;
    }
    return { ...item, order: newPosition };
  });
}

/**
 * The item that comes right after the given one in its rundown, or undefined when the
 * given item is the last. This is where the cursor goes after a take.
 */
export function findItemThatFollows(items: Item[], itemBefore: Item): Item | undefined {
  const itemsInOrder = listItemsOfRundownInOrder(items, itemBefore.rundownId);
  const positionOfItemBefore = itemsInOrder.findIndex((item) => item.id === itemBefore.id);
  return itemsInOrder[positionOfItemBefore + 1];
}
