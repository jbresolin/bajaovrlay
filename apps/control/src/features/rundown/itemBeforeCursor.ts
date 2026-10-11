import type { Item } from '@bajaovrlay/shared';

/**
 * Answers which item the Left arrow moves the rundown's cursor to, given the rundown's
 * items from first to last. Returns that item's id, or `null` for "do not move". It
 * mirrors findItemIdAfterCursor (the Right arrow) at the other end of the list:
 * - on the first item the cursor stays (no wrapping round to the last item);
 * - with no cursor, or a cursor on an item that is not in the list, it goes to the
 *   LAST item: "no cursor" is what the rundown has after its last item was fired, so
 *   the cursor is past the end and one step back from there is the last item;
 * - an empty rundown has nowhere to go.
 */
export function findItemIdBeforeCursor(
  itemsInOrder: Item[],
  cursorItemId: string | null,
): string | null {
  const lastItem = itemsInOrder[itemsInOrder.length - 1];
  if (lastItem === undefined) {
    return null;
  }

  const positionOfCursor = itemsInOrder.findIndex((item) => item.id === cursorItemId);
  const isCursorOnNoItemOfTheList = positionOfCursor === -1;
  if (isCursorOnNoItemOfTheList) {
    return lastItem.id;
  }

  const isCursorOnTheFirstItem = positionOfCursor === 0;
  if (isCursorOnTheFirstItem) {
    return null;
  }
  const itemBeforeCursor = itemsInOrder[positionOfCursor - 1];
  // Cannot happen after the two checks above; the compiler asks for it all the same.
  if (itemBeforeCursor === undefined) {
    return null;
  }
  return itemBeforeCursor.id;
}
