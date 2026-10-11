import type { Item } from '@bajaovrlay/shared';

/**
 * Answers which item the Right arrow moves the rundown's cursor to, given the rundown's
 * items from first to last. Returns that item's id, or `null` for "do not move":
 * - on the last item the cursor stays (no wrapping round to the first item, so one
 *   press too many never lines the opening up again);
 * - with no cursor, or a cursor on an item that is not in the list, it goes to the
 *   first item;
 * - an empty rundown has nowhere to go.
 */
export function findItemIdAfterCursor(
  itemsInOrder: Item[],
  cursorItemId: string | null,
): string | null {
  const firstItem = itemsInOrder[0];
  if (firstItem === undefined) {
    return null;
  }

  const positionOfCursor = itemsInOrder.findIndex((item) => item.id === cursorItemId);
  const isCursorOnNoItemOfTheList = positionOfCursor === -1;
  if (isCursorOnNoItemOfTheList) {
    return firstItem.id;
  }

  const itemAfterCursor = itemsInOrder[positionOfCursor + 1];
  if (itemAfterCursor === undefined) {
    return null;
  }
  return itemAfterCursor.id;
}
