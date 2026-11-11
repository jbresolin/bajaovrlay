import type { Item } from './item.js';

/**
 * Lists the items of one rundown from first to last. The `items` slice holds the items
 * of every rundown and every quick-fire panel in no promised order, each with its home
 * and its position there in `order` (from 0). Items of a panel are never listed here.
 * Pure, and the list given is not reordered: it belongs to the store.
 * It lives in shared because the server's reducers and the control page's rundown
 * column must agree on the order; two copies could drift apart.
 */
export function listItemsOfRundownInOrder(items: Item[], rundownId: string): Item[] {
  // `filter` already makes a new list, so sorting it leaves the list handed in alone.
  const itemsOfTheRundown = items.filter(
    (item) => item.home.kind === 'rundown' && item.home.rundownId === rundownId,
  );
  return itemsOfTheRundown.sort((oneItem, otherItem) => oneItem.order - otherItem.order);
}

/**
 * Lists the items (the buttons) of one quick-fire panel from first to last, the same
 * way listItemsOfRundownInOrder lists a rundown's. Items of a rundown are never listed.
 */
export function listItemsOfQuickFirePanelInOrder(items: Item[], panelId: string): Item[] {
  const itemsOfThePanel = items.filter(
    (item) => item.home.kind === 'quickFire' && item.home.panelId === panelId,
  );
  return itemsOfThePanel.sort((oneItem, otherItem) => oneItem.order - otherItem.order);
}

/**
 * Lists the event templates ("Modelos de evento", BAJAOVRLAY-67) from first to last, the
 * same way listItemsOfRundownInOrder lists a rundown's.
 */
export function listEventTemplatesInOrder(items: Item[]): Item[] {
  const eventTemplates = items.filter((item) => item.home.kind === 'eventTemplates');
  return eventTemplates.sort((oneItem, otherItem) => oneItem.order - otherItem.order);
}
