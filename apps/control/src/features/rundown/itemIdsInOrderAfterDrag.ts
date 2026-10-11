/**
 * Works out the order of a rundown after one row was dragged and dropped on another:
 * the dragged item takes the place of the item it was dropped on, and the items between
 * them each shift one place to make room. Returns the ids of ALL the items in the new
 * order, which is what `reorderItems` needs, or `null` when there is nothing to send:
 * the row was dropped outside the list, back on itself, or one of the two items is not
 * in the rundown any more (deleted by someone else during the drag).
 */
export function listItemIdsInOrderAfterDrag(
  itemIdsInOrder: string[],
  draggedItemId: string,
  itemIdDroppedOnto: string | null,
): string[] | null {
  if (itemIdDroppedOnto === null || itemIdDroppedOnto === draggedItemId) {
    return null;
  }

  const positionBeforeTheDrag = itemIdsInOrder.indexOf(draggedItemId);
  const positionToLandOn = itemIdsInOrder.indexOf(itemIdDroppedOnto);
  const isEitherItemGone = positionBeforeTheDrag === -1 || positionToLandOn === -1;
  if (isEitherItemGone) {
    return null;
  }

  // Take the dragged id out, then put it back at the position of the item it was
  // dropped on. Because that position is read BEFORE the removal, a drag downwards
  // lands after the target and a drag upwards lands before it, which is what the
  // operator sees happen on screen. Done on a copy: the caller's list is left alone.
  const itemIdsAfterTheDrag = [...itemIdsInOrder];
  itemIdsAfterTheDrag.splice(positionBeforeTheDrag, 1);
  itemIdsAfterTheDrag.splice(positionToLandOn, 0, draggedItemId);
  return itemIdsAfterTheDrag;
}
