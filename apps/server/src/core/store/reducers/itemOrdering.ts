// The order of the items of one home (a rundown or a quick-fire panel): reading it,
// renumbering it and finding what follows an item. Every reducer that adds, removes or
// moves an item goes through here, so each home is always numbered 0, 1, 2, ... with no
// gaps and no repeats. The control page reads the same order through
// `listItemsOfRundownInOrder` and `listItemsOfQuickFirePanelInOrder` of @bajaovrlay/shared.
import { isSameItemHome, type Item, type ItemHome } from '@bajaovrlay/shared';

/**
 * Lists the items of one home, rundown or panel, from first to last. The list handed in
 * is not reordered.
 */
export function listItemsOfHomeInOrder(items: Item[], home: ItemHome): Item[] {
  const itemsOfTheHome = items.filter((item) => isSameItemHome(item.home, home));
  return itemsOfTheHome.sort((oneItem, otherItem) => oneItem.order - otherItem.order);
}

/**
 * Gives each item named in `orderedItemIds` the position it has in that list (the first
 * id gets 0, the next 1, ...). An item whose position does not change, and every item
 * not named (the items of other homes), is handed back as the very same object.
 * The caller must name every item of the home exactly once, or the home ends up with
 * two items in one position.
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
 * The item that comes right after the given one in its home, or undefined when the
 * given item is the last. This is where a rundown's cursor goes after a take.
 */
export function findItemThatFollows(items: Item[], itemBefore: Item): Item | undefined {
  const itemsInOrder = listItemsOfHomeInOrder(items, itemBefore.home);
  const positionOfItemBefore = itemsInOrder.findIndex((item) => item.id === itemBefore.id);
  return itemsInOrder[positionOfItemBefore + 1];
}
