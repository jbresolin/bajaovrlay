/**
 * The item the Right arrow moves the cursor to (apps/control)
 *
 * What this module is for:
 *   The rundown has a cursor on the item that goes on air next. The Right arrow key moves
 *   that cursor one item forward WITHOUT putting anything on air, so the operator can
 *   skip an item. This function answers "which item does the cursor go to?", or `null`
 *   for "nowhere: send no command".
 *
 * What these tests prove:
 *   - From any item but the last, the cursor goes to the item right after it.
 *   - On the last item the answer is null: the cursor stays, it does not wrap round to
 *     the top (a second press by accident must not line the opening up again).
 *   - With no cursor (nothing is next, as after the last item was fired) it goes to the
 *     first item; so does a cursor that points at an item that is gone.
 *   - In an empty rundown the answer is null.
 *
 * What these tests deliberately do not cover:
 *   - Listening to the key and sending `moveCursor`; RundownPanelCursor.test.tsx does.
 *   - The cursor moving after a take: the server does that by itself.
 */
import type { Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildThreeItemsOfTheEnduranceRace } from '@/state/rundownLikeTheServerSends.testSupport';

import { findItemIdAfterCursor } from './itemAfterCursor';

describe('findItemIdAfterCursor', () => {
  const cursorScenarios = [
    // The everyday case: skip the item that is next.
    {
      name: 'goes from the first item to the second',
      cursorItemId: 'item-largada-do-enduro',
      expectedItemId: 'item-bandeira-amarela',
    },
    // From the middle to the last, to prove it is "the one after", not "the second".
    {
      name: 'goes from the second item to the last',
      cursorItemId: 'item-bandeira-amarela',
      expectedItemId: 'item-chegada-do-enduro',
    },
    // The end of the list: stay there, never wrap round to the opening.
    {
      name: 'stays put on the last item',
      cursorItemId: 'item-chegada-do-enduro',
      expectedItemId: null,
    },
    // Nothing is next (the last item was just fired): the arrow starts again at the top.
    {
      name: 'goes to the first item when there is no cursor',
      cursorItemId: null,
      expectedItemId: 'item-largada-do-enduro',
    },
    // The cursor names an item this page does not have (the items slice with the delete
    // arrived before the rundowns slice with the corrected cursor): treated as no cursor.
    {
      name: 'goes to the first item when the cursor points at an item that is gone',
      cursorItemId: 'item-vinheta-do-patrocinador',
      expectedItemId: 'item-largada-do-enduro',
    },
  ];

  it.each(cursorScenarios)('$name', ({ cursorItemId, expectedItemId }) => {
    // Arrange: the rundown with the start, the yellow flag and the finish, in that order.
    const itemsInOrder = buildThreeItemsOfTheEnduranceRace();

    // Act: ask where the Right arrow takes the cursor.
    const itemIdAfterCursor = findItemIdAfterCursor(itemsInOrder, cursorItemId);

    // Assert: the expected item, or null for "do not move".
    expect(
      itemIdAfterCursor,
      'the cursor must move one item forward, stop at the end and start at the top when unset',
    ).toBe(expectedItemId);
  });

  it('gives null in a rundown with no items', () => {
    // Arrange: a rundown nobody has prepared yet.
    const noItems: Item[] = [];

    // Act: ask where the Right arrow takes the cursor.
    const itemIdAfterCursor = findItemIdAfterCursor(noItems, null);

    // Assert: nowhere.
    expect(itemIdAfterCursor, 'an empty rundown has no item to move the cursor to').toBeNull();
  });
});
