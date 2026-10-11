/**
 * Which hint the rundown shows while its cursor is on nothing (apps/control)
 *
 * What this module is for:
 *   With the cursor on nothing, Space has nothing to take. The panel says why, and the
 *   reason is one of two: the rundown was played to its end by the cursor ("Fim do
 *   rundown — …"), or nobody has placed the cursor yet ("Clique num item para posicionar
 *   o cursor"). The server tells the two apart with the rundown's
 *   `wasLastItemTakenAtCursor`; this function only reads it.
 *
 * What these tests prove:
 *   - A cursor on an item needs no hint.
 *   - An empty rundown needs no hint: there is no item to click, and the panel already
 *     says the rundown is empty.
 *   - A cursor on nothing with items gives "place the cursor" when the rundown is not
 *     marked (the mark absent or false), and "end of rundown" when it is.
 *
 * What these tests deliberately do not cover:
 *   - The words themselves and where they are drawn; RundownPanelEndOfRundownHint.test.tsx.
 *   - When the server sets the mark; the server's takeItem.test.ts.
 */
import type { Rundown } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { chooseEmptyCursorHint } from './emptyCursorHint';

/** The main session's rundown with the cursor and mark of one scenario. */
function buildMainRundownForHint(
  cursorItemId: string | null,
  wasLastItemTakenAtCursor: boolean | undefined,
): Rundown {
  const rundown: Rundown = {
    id: 'sessao-principal',
    name: 'Sessão principal',
    sessionLabel: '',
    cursorItemId,
  };
  if (wasLastItemTakenAtCursor !== undefined) {
    rundown.wasLastItemTakenAtCursor = wasLastItemTakenAtCursor;
  }
  return rundown;
}

const hintScenarios: Array<{
  name: string;
  cursorItemId: string | null;
  wasLastItemTakenAtCursor: boolean | undefined;
  numberOfItems: number;
  expectedHint: 'none' | 'placeTheCursor' | 'endOfRundown';
}> = [
  // The everyday case in a show: an item is next, so there is nothing to explain.
  {
    name: 'gives no hint while the cursor is on an item',
    cursorItemId: 'item-largada-do-enduro',
    wasLastItemTakenAtCursor: undefined,
    numberOfItems: 3,
    expectedHint: 'none',
  },
  // A new session with nothing prepared: the panel's "empty rundown" text covers it.
  {
    name: 'gives no hint in a rundown with no items',
    cursorItemId: null,
    wasLastItemTakenAtCursor: undefined,
    numberOfItems: 0,
    expectedHint: 'none',
  },
  // Items exist but the cursor was never placed (or was taken off by hand): a database
  // written before the mark existed looks like this too.
  {
    name: 'asks for the cursor to be placed when the rundown carries no mark',
    cursorItemId: null,
    wasLastItemTakenAtCursor: undefined,
    numberOfItems: 3,
    expectedHint: 'placeTheCursor',
  },
  // The same, with the mark written as false.
  {
    name: 'asks for the cursor to be placed when the mark says no',
    cursorItemId: null,
    wasLastItemTakenAtCursor: false,
    numberOfItems: 3,
    expectedHint: 'placeTheCursor',
  },
  // João's walk: the last item was fired with Space, so the rundown really ended.
  {
    name: 'says the rundown ended when its last item was taken at the cursor',
    cursorItemId: null,
    wasLastItemTakenAtCursor: true,
    numberOfItems: 3,
    expectedHint: 'endOfRundown',
  },
];

describe('chooseEmptyCursorHint', () => {
  it.each(hintScenarios)(
    '$name',
    ({ cursorItemId, wasLastItemTakenAtCursor, numberOfItems, expectedHint }) => {
      // Arrange: the main rundown as this row describes it.
      const rundown = buildMainRundownForHint(cursorItemId, wasLastItemTakenAtCursor);

      // Act: ask which hint the panel must show.
      const hint = chooseEmptyCursorHint(rundown, numberOfItems);

      // Assert: the hint of this row.
      expect(hint, 'the hint must follow the cursor, the items and the mark').toBe(expectedHint);
    },
  );
});
