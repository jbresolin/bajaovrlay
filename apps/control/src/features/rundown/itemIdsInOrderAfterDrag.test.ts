/**
 * The new order of a rundown after a drag (apps/control)
 *
 * What this module is for:
 *   When the operator drags a row of the rundown and drops it on another row, the page
 *   sends `reorderItems` with the ids of ALL the rundown's items in their new order (the
 *   server refuses a list that leaves any out). This function works that list out from
 *   three facts: the order before, the row that was dragged, the row it was dropped on.
 *
 * What these tests prove:
 *   - Dragging a row down or up puts it in the place of the row it was dropped on, and
 *     every other row keeps its relative order; the list always has every id once.
 *   - A drag that changes nothing (dropped outside the list, on itself, or involving a
 *     row that is no longer in the rundown) gives `null`, meaning "send no command".
 *
 * What these tests deliberately do not cover:
 *   - The dragging itself (mouse, keyboard, animation): that is dnd-kit's, and
 *     RundownPanelReorder.test.tsx drives it once through the keyboard to prove the
 *     panel hands a real drop to this function and sends the result. The many cases
 *     live here, on the pure function, because they need no browser layout to be read.
 *   - Whether the server accepts the new order.
 */
import { describe, expect, it } from 'vitest';

import { listItemIdsInOrderAfterDrag } from './itemIdsInOrderAfterDrag';

const rundownOrderBeforeTheDrag = [
  'item-largada-do-enduro',
  'item-bandeira-amarela',
  'item-chegada-do-enduro',
];

describe('listItemIdsInOrderAfterDrag', () => {
  const dragsThatChangeTheOrder = [
    // The everyday case: the operator pulls the first item one place down.
    {
      name: 'moves the first item below the second',
      draggedItemId: 'item-largada-do-enduro',
      itemIdDroppedOnto: 'item-bandeira-amarela',
      expectedOrder: ['item-bandeira-amarela', 'item-largada-do-enduro', 'item-chegada-do-enduro'],
    },
    // A long drag down: the row lands in the last place and BOTH others move up.
    {
      name: 'moves the first item to the end',
      draggedItemId: 'item-largada-do-enduro',
      itemIdDroppedOnto: 'item-chegada-do-enduro',
      expectedOrder: ['item-bandeira-amarela', 'item-chegada-do-enduro', 'item-largada-do-enduro'],
    },
    // Upwards works the other way round: the rows it passes move down.
    {
      name: 'moves the last item to the top',
      draggedItemId: 'item-chegada-do-enduro',
      itemIdDroppedOnto: 'item-largada-do-enduro',
      expectedOrder: ['item-chegada-do-enduro', 'item-largada-do-enduro', 'item-bandeira-amarela'],
    },
    // One place up, from the middle: the smallest upward move.
    {
      name: 'moves the middle item above the first',
      draggedItemId: 'item-bandeira-amarela',
      itemIdDroppedOnto: 'item-largada-do-enduro',
      expectedOrder: ['item-bandeira-amarela', 'item-largada-do-enduro', 'item-chegada-do-enduro'],
    },
  ];

  it.each(dragsThatChangeTheOrder)('$name', (scenario) => {
    // Arrange: the rundown as it was — start, yellow flag, finish.
    const itemIdsBeforeTheDrag = [...rundownOrderBeforeTheDrag];

    // Act: drop the dragged row on the other row.
    const itemIdsAfterTheDrag = listItemIdsInOrderAfterDrag(
      itemIdsBeforeTheDrag,
      scenario.draggedItemId,
      scenario.itemIdDroppedOnto,
    );

    // Assert: the full list in the new order, and the old list untouched.
    expect(
      itemIdsAfterTheDrag,
      'the dragged item must take the place of the item it was dropped on, with every id listed once',
    ).toEqual(scenario.expectedOrder);
    expect(itemIdsBeforeTheDrag, 'the list that was passed in must be left as it was').toEqual(
      rundownOrderBeforeTheDrag,
    );
  });

  const dragsThatChangeNothing = [
    // The operator let go outside the list: dnd-kit reports "dropped on nothing".
    {
      name: 'gives null when the item was dropped outside the list',
      draggedItemId: 'item-largada-do-enduro',
      itemIdDroppedOnto: null,
    },
    // Picked up and put back: sending the same order would only add noise to the event log.
    {
      name: 'gives null when the item was dropped back on itself',
      draggedItemId: 'item-bandeira-amarela',
      itemIdDroppedOnto: 'item-bandeira-amarela',
    },
    // Another operator deleted the dragged item while it was in the air.
    {
      name: 'gives null when the dragged item is no longer in the rundown',
      draggedItemId: 'item-vinheta-do-patrocinador',
      itemIdDroppedOnto: 'item-bandeira-amarela',
    },
    // Another operator deleted the item under the pointer just before the drop.
    {
      name: 'gives null when the item it was dropped on is no longer in the rundown',
      draggedItemId: 'item-largada-do-enduro',
      itemIdDroppedOnto: 'item-vinheta-do-patrocinador',
    },
  ];

  it.each(dragsThatChangeNothing)('$name', (scenario) => {
    // Arrange: the rundown as it was — start, yellow flag, finish.
    const itemIdsBeforeTheDrag = [...rundownOrderBeforeTheDrag];

    // Act: finish the drag as the scenario says.
    const itemIdsAfterTheDrag = listItemIdsInOrderAfterDrag(
      itemIdsBeforeTheDrag,
      scenario.draggedItemId,
      scenario.itemIdDroppedOnto,
    );

    // Assert: there is nothing to send.
    expect(
      itemIdsAfterTheDrag,
      'a drag that changes nothing must give null, so no reorderItems is sent',
    ).toBeNull();
  });
});
