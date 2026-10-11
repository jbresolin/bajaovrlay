/**
 * The item the Left arrow moves the cursor to (apps/control)
 *
 * What this module is for:
 *   The rundown has a cursor on the item that goes on air next. The Left arrow key moves
 *   that cursor one item BACK without putting anything on air, so the operator can line
 *   up again an item that was skipped or has to be repeated. This function answers
 *   "which item does the cursor go to?", or `null` for "nowhere: send no command".
 *   It is the mirror image of itemAfterCursor.ts, which serves the Right arrow.
 *
 * What these tests prove:
 *   - From any item but the first, the cursor goes to the item right before it.
 *   - On the first item the answer is null: the cursor stays, it does not wrap round to
 *     the bottom (as the Right arrow does not wrap round to the top).
 *   - With no cursor (nothing is next, as after the last item was fired) it goes to the
 *     LAST item: "nothing is next" means the cursor is past the end, and one step back
 *     from there is the last item. So does a cursor that points at an item that is gone.
 *   - In an empty rundown the answer is null.
 *
 * What these tests deliberately do not cover:
 *   - Listening to the key and sending `moveCursor`; RundownPanelCursor.test.tsx does.
 *   - The Right arrow; itemAfterCursor.test.ts does.
 */
import type { Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildThreeItemsOfTheEnduranceRace } from '@/state/rundownLikeTheServerSends.testSupport';

import { findItemIdBeforeCursor } from './itemBeforeCursor';

describe('findItemIdBeforeCursor', () => {
  const cursorScenarios = [
    // The everyday case: the take moved the cursor on, and the operator wants the item
    // that was just fired lined up again.
    {
      name: 'goes from the second item back to the first',
      cursorItemId: 'item-bandeira-amarela',
      expectedItemId: 'item-largada-do-enduro',
    },
    // From the last to the middle, to prove it is "the one before", not "the first".
    {
      name: 'goes from the last item back to the second',
      cursorItemId: 'item-chegada-do-enduro',
      expectedItemId: 'item-bandeira-amarela',
    },
    // The top of the list: stay there, never wrap round to the finish.
    {
      name: 'stays put on the first item',
      cursorItemId: 'item-largada-do-enduro',
      expectedItemId: null,
    },
    // Nothing is next (the last item was just fired): one step back is the last item.
    {
      name: 'goes to the last item when there is no cursor',
      cursorItemId: null,
      expectedItemId: 'item-chegada-do-enduro',
    },
    // The cursor names an item this page does not have (the items slice with the delete
    // arrived before the rundowns slice with the corrected cursor): treated as no cursor.
    {
      name: 'goes to the last item when the cursor points at an item that is gone',
      cursorItemId: 'item-vinheta-do-patrocinador',
      expectedItemId: 'item-chegada-do-enduro',
    },
  ];

  it.each(cursorScenarios)('$name', ({ cursorItemId, expectedItemId }) => {
    // Arrange: the rundown with the start, the yellow flag and the finish, in that order.
    const itemsInOrder = buildThreeItemsOfTheEnduranceRace();

    // Act: ask where the Left arrow takes the cursor.
    const itemIdBeforeCursor = findItemIdBeforeCursor(itemsInOrder, cursorItemId);

    // Assert: the expected item, or null for "do not move".
    expect(
      itemIdBeforeCursor,
      'the cursor must move one item back, stop at the top and start at the bottom when unset',
    ).toBe(expectedItemId);
  });

  it('gives null in a rundown with no items', () => {
    // Arrange: a rundown nobody has prepared yet.
    const noItems: Item[] = [];

    // Act: ask where the Left arrow takes the cursor.
    const itemIdBeforeCursor = findItemIdBeforeCursor(noItems, null);

    // Assert: nowhere.
    expect(itemIdBeforeCursor, 'an empty rundown has no item to move the cursor to').toBeNull();
  });
});
