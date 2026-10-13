/**
 * Which item to preview after a take (apps/control)
 *
 * What this module is for:
 *   João's ruling (gate 2 of BAJAOVRLAY-15): with "Prévia automática" on, a take that
 *   moves the rundown's cursor on also previews the item the cursor arrives on, so the
 *   operator's whole loop is Space, Space, Space, each item seen before it airs.
 *   `findItemIdToPreviewAfterTake` is the one place that decides it. It is told whether
 *   the switch is on and where the cursor was before the take and is after it, and
 *   answers with the id of the item to preview, or null for "preview nothing".
 *
 * What these tests prove:
 *   - The item the cursor arrived on is previewed when the switch is on and the cursor
 *     is on a different item than before the take.
 *   - Nothing is previewed when the switch is off, when the cursor did not move (the
 *     take was of another row), or when the cursor is on nothing after the take (the
 *     last item was taken).
 *   - A cursor that was on nothing and is on an item after the take counts as moved.
 *
 * What these tests deliberately do not cover:
 *   - Sending the take and the preview, and waiting for the server in between:
 *     RundownPanelPreviewAfterTake.test.tsx, with a fake server.
 *   - A take that was refused: the caller never asks then; the same panel test proves it.
 */
import { describe, expect, it } from 'vitest';

import { findItemIdToPreviewAfterTake } from './itemToPreviewAfterTake';

const itemToPreviewScenarios: Array<{
  name: string;
  isAutoPreviewOn: boolean;
  cursorItemIdBeforeTake: string | null;
  cursorItemIdAfterTake: string | null;
  expectedItemIdToPreview: string | null;
}> = [
  // The loop: Space took the start, the cursor moved on to the yellow flag.
  {
    name: 'previews the item the cursor moved on to',
    isAutoPreviewOn: true,
    cursorItemIdBeforeTake: 'item-largada-do-enduro',
    cursorItemIdAfterTake: 'item-bandeira-amarela',
    expectedItemIdToPreview: 'item-bandeira-amarela',
  },
  // The operator switched "Prévia automática" off: a take is only a take.
  {
    name: 'previews nothing while "Prévia automática" is off',
    isAutoPreviewOn: false,
    cursorItemIdBeforeTake: 'item-largada-do-enduro',
    cursorItemIdAfterTake: 'item-bandeira-amarela',
    expectedItemIdToPreview: null,
  },
  // "Disparar" on a row that is not the next one: the plan (the cursor) did not change,
  // so there is no new next item to look at.
  {
    name: 'previews nothing when the take left the cursor where it was',
    isAutoPreviewOn: true,
    cursorItemIdBeforeTake: 'item-bandeira-amarela',
    cursorItemIdAfterTake: 'item-bandeira-amarela',
    expectedItemIdToPreview: null,
  },
  // The last item of the rundown was taken: there is no next item.
  {
    name: 'previews nothing when the cursor is on nothing after the take',
    isAutoPreviewOn: true,
    cursorItemIdBeforeTake: 'item-chegada-do-enduro',
    cursorItemIdAfterTake: null,
    expectedItemIdToPreview: null,
  },
  // A cursor on nothing stays on nothing through a take; nothing to preview either.
  {
    name: 'previews nothing when the cursor was on nothing and still is',
    isAutoPreviewOn: true,
    cursorItemIdBeforeTake: null,
    cursorItemIdAfterTake: null,
    expectedItemIdToPreview: null,
  },
  // Not something a take does today, but the rule must not read "was on nothing" as
  // "did not move": if the cursor is on a new item, that item is the next one.
  {
    name: 'previews the item when the cursor was on nothing before and is on an item after',
    isAutoPreviewOn: true,
    cursorItemIdBeforeTake: null,
    cursorItemIdAfterTake: 'item-largada-do-enduro',
    expectedItemIdToPreview: 'item-largada-do-enduro',
  },
];

describe('findItemIdToPreviewAfterTake', () => {
  it.each(itemToPreviewScenarios)(
    '$name',
    ({
      isAutoPreviewOn,
      cursorItemIdBeforeTake,
      cursorItemIdAfterTake,
      expectedItemIdToPreview,
    }) => {
      // Arrange: the switch and the two cursor positions of this row.
      const takeThatWasAccepted = {
        isAutoPreviewOn,
        cursorItemIdBeforeTake,
        cursorItemIdAfterTake,
      };

      // Act: ask which item to preview.
      const itemIdToPreview = findItemIdToPreviewAfterTake(takeThatWasAccepted);

      // Assert: the item of this row, or null for "preview nothing".
      expect(
        itemIdToPreview,
        'only a cursor that moved on to an item, with the switch on, may be previewed',
      ).toBe(expectedItemIdToPreview);
    },
  );
});
