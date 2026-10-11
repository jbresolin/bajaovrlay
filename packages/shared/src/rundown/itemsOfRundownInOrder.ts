import type { Item } from './item.js';

/**
 * Lists the items of one rundown from first to last. The `items` slice holds the items
 * of every rundown in no promised order, each with its position in `order` (from 0).
 * Pure, and the list given is not reordered: it belongs to the store.
 * It lives in shared because the server's reducers and the control page's rundown
 * column must agree on the order; two copies could drift apart.
 */
export function listItemsOfRundownInOrder(items: Item[], rundownId: string): Item[] {
  // `filter` already makes a new list, so sorting it leaves the list handed in alone.
  const itemsOfTheRundown = items.filter((item) => item.rundownId === rundownId);
  return itemsOfTheRundown.sort((oneItem, otherItem) => oneItem.order - otherItem.order);
}
