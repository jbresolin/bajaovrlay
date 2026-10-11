import type { Item } from '@bajaovrlay/shared';

/**
 * Lists the items of one rundown from first to last. The `items` slice holds the items
 * of every rundown in no promised order, each with its position in `order` (from 0).
 * The slice itself is not reordered: it belongs to the store.
 */
export function listItemsOfRundownInOrder(items: Item[], rundownId: string): Item[] {
  // `filter` already makes a new list, so sorting it leaves the store's list alone.
  const itemsOfTheRundown = items.filter((item) => item.rundownId === rundownId);
  return itemsOfTheRundown.sort((oneItem, otherItem) => oneItem.order - otherItem.order);
}
