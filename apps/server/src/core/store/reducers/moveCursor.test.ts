/**
 * The moveCursor reducer (apps/server)
 *
 * What this module is for:
 *   Each rundown has a cursor on the item that goes on air next. moveCursor puts it on
 *   another item of the same rundown, or on nothing, without taking anything.
 *
 * What these tests prove:
 *   - The cursor moves to the item named, and to nothing when the command sends null.
 *   - Only the rundown named changes; items and what is on air are untouched.
 *   - Moving the cursor to where it already is hands back the very same slices.
 *   - An item of another rundown is refused, and so are an item and a rundown that do
 *     not exist, each with a pt-BR reason.
 *
 * What these tests deliberately do not cover:
 *   - The cursor moving on its own after a take; takeItem.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildPodiumRundown,
  buildPodiumTeamItem,
  buildRaceDaySlicesWithRundown,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
  mainSessionRundownId,
} from './rundownSlices.testSupport.js';

const movedCursorScenarios: Array<{
  name: string;
  cursorBefore: string | null;
  itemIdInCommand: string | null;
}> = [
  // The operator presses the right arrow: "next" becomes the following item.
  {
    name: 'moves the cursor from the start item to the yellow flag item',
    cursorBefore: 'item-largada-do-enduro',
    itemIdInCommand: 'item-bandeira-amarela',
  },
  // After the last take the cursor is on nothing; the operator points it at an item again.
  {
    name: 'puts an empty cursor on the start item',
    cursorBefore: null,
    itemIdInCommand: 'item-largada-do-enduro',
  },
  // null is how the page says "nothing is next", so Space cannot fire by accident.
  {
    name: 'takes the cursor off every item when the command sends null',
    cursorBefore: 'item-bandeira-amarela',
    itemIdInCommand: null,
  },
];

describe('moveCursor, when the cursor can move', () => {
  it.each(movedCursorScenarios)('$name', ({ cursorBefore, itemIdInCommand }) => {
    // Arrange: the main session with two items and the cursor of this scenario; the
    // podium rundown has its cursor on its own item.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown(cursorBefore), buildPodiumRundown('item-podio-baja-ufpr')],
      items: [buildEnduroStartItem(0), buildYellowFlagItem(1), buildPodiumTeamItem(0)],
    });

    // Act: move the main session's cursor.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'moveCursor', rundownId: mainSessionRundownId, itemId: itemIdInCommand },
      contextOfTheRundownCommand,
    );

    // Assert: only the main session's cursor changed; nothing else did.
    expect(outcome.status, 'the cursor must move').toBe('applied');
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.rundowns, 'only the cursor of the rundown named may change').toEqual([
      buildMainSessionRundown(itemIdInCommand),
      buildPodiumRundown('item-podio-baja-ufpr'),
    ]);
    expect(slicesAfter?.items, 'moving the cursor must not change the items').toBe(
      slicesBefore.items,
    );
    expect(slicesAfter?.instances, 'moving the cursor must not take anything').toBe(
      slicesBefore.instances,
    );
  });

  it('hands back the very same slices when the cursor is already there', () => {
    // Arrange: the main session with its cursor on the yellow flag item.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown('item-bandeira-amarela'), buildPodiumRundown(null)],
      items: [buildEnduroStartItem(0), buildYellowFlagItem(1)],
    });

    // Act: move the cursor to the item it is already on.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'moveCursor', rundownId: mainSessionRundownId, itemId: 'item-bandeira-amarela' },
      contextOfTheRundownCommand,
    );

    // Assert: accepted, with the very same slices.
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'a cursor that did not move must hand back the same slices',
    ).toBe(slicesBefore);
  });
});

const refusedCursorScenarios: Array<{
  name: string;
  rundownId: string;
  itemId: string;
  expectedError: { code: string; message: string };
}> = [
  // The podium item exists, but pointing the enduro's cursor at it would make Space
  // fire a graphic that is not in the list the operator is looking at.
  {
    name: 'refuses an item that belongs to another rundown',
    rundownId: mainSessionRundownId,
    itemId: 'item-podio-baja-ufpr',
    expectedError: {
      code: 'ITEM_NOT_IN_RUNDOWN',
      message: 'O item "Pódio — Baja UFPR" pertence a outro rundown, não a "Sessão principal".',
    },
  },
  // The item was deleted by another operator a moment ago.
  {
    name: 'refuses an item that does not exist',
    rundownId: mainSessionRundownId,
    itemId: 'item-volta-mais-rapida',
    expectedError: {
      code: 'ITEM_NOT_FOUND',
      message: 'O item "item-volta-mais-rapida" não existe; ele pode ter sido excluído.',
    },
  },
  // A rundown that does not exist has no cursor to move.
  {
    name: 'refuses a rundown that does not exist',
    rundownId: 'treino-livre',
    itemId: 'item-largada-do-enduro',
    expectedError: { code: 'RUNDOWN_NOT_FOUND', message: 'O rundown "treino-livre" não existe.' },
  },
];

describe('moveCursor, when it must be refused', () => {
  it.each(refusedCursorScenarios)('$name', ({ rundownId, itemId, expectedError }) => {
    // Arrange: two items in the main session and one in the podium rundown.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [buildEnduroStartItem(0), buildYellowFlagItem(1), buildPodiumTeamItem(0)],
    });

    // Act: try to move the cursor as this scenario says.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'moveCursor', rundownId, itemId },
      contextOfTheRundownCommand,
    );

    // Assert: refused with a stable code and the pt-BR reason.
    expect(outcome, 'the move must be refused with the pt-BR reason').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});
