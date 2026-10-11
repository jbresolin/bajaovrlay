/**
 * The deleteItem reducer (apps/server)
 *
 * What this module is for:
 *   deleteItem removes a prepared item from its rundown and closes the gap it leaves, so
 *   the rundown stays numbered 0, 1, 2, ... If the cursor ("next") was on the deleted
 *   item, it moves to the item that came after it, or to nothing when it was the last.
 *
 * What these tests prove:
 *   - The items after the deleted one move up by one; the items before it stay.
 *   - A cursor on the deleted item moves to the item that followed it, and becomes null
 *     when the deleted item was the last; a cursor on another item stays where it is.
 *   - A graphic already on air from the deleted item stays on air, still stamped with
 *     the item's id.
 *   - Items of another rundown are untouched.
 *   - An item that does not exist is refused with a pt-BR reason.
 *
 * What these tests deliberately do not cover:
 *   - An auto-out already scheduled for an instance of the deleted item; autoOut.test.ts
 *     covers the scheduler, which follows the instance and not the item.
 */
import type { Instance, Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroClockData,
  buildEnduroFinishItem,
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildPodiumRundown,
  buildPodiumTeamItem,
  buildRaceDaySlicesWithRundown,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
  mainSessionRundownId,
  readLabelsAndOrdersOfRundown,
} from './rundownSlices.testSupport.js';

/** Builds the main session's three items in their usual order: start, yellow, finish. */
function buildThreeEnduroItems(): Item[] {
  return [buildEnduroStartItem(0), buildYellowFlagItem(1), buildEnduroFinishItem(2)];
}

/** Builds the race clock on program as takeItem left it, stamped with the yellow flag item. */
function buildYellowFlagClockOnAir(): Instance {
  return {
    id: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: buildEnduroClockData('yellow'),
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T14:20:00.000Z',
    itemId: 'item-bandeira-amarela',
  };
}

const renumberingScenarios: Array<{
  name: string;
  deletedItemId: string;
  expectedRundown: Array<[string, number]>;
}> = [
  // Deleting the first item is the case where every other item must move up.
  {
    name: 'moves both later items up when the first item is deleted',
    deletedItemId: 'item-largada-do-enduro',
    expectedRundown: [
      ['Bandeira amarela', 0],
      ['Chegada do enduro', 1],
    ],
  },
  // Deleting from the middle must close the gap between 0 and 2.
  {
    name: 'closes the gap when the middle item is deleted',
    deletedItemId: 'item-bandeira-amarela',
    expectedRundown: [
      ['Largada do enduro', 0],
      ['Chegada do enduro', 1],
    ],
  },
  // Deleting the last item leaves nothing to renumber.
  {
    name: 'leaves the earlier items as they are when the last item is deleted',
    deletedItemId: 'item-chegada-do-enduro',
    expectedRundown: [
      ['Largada do enduro', 0],
      ['Bandeira amarela', 1],
    ],
  },
];

describe('deleteItem, renumbering the rundown', () => {
  it.each(renumberingScenarios)('$name', ({ deletedItemId, expectedRundown }) => {
    // Arrange: the main session with three items and one item in the podium rundown,
    // frozen so that changing it in place would throw.
    const podiumItem = Object.freeze(buildPodiumTeamItem(0));
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [...buildThreeEnduroItems(), podiumItem],
    });

    // Act: delete the item this scenario names.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteItem', itemId: deletedItemId },
      contextOfTheRundownCommand,
    );

    // Assert: two items left, numbered 0 and 1, and the podium item untouched.
    expect(outcome.status, 'the item must be deleted').toBe('applied');
    const itemsAfter = outcome.status === 'applied' ? outcome.slices.items : undefined;
    expect(
      readLabelsAndOrdersOfRundown(itemsAfter, mainSessionRundownId),
      'the rundown must hold the two remaining items, numbered 0 and 1',
    ).toEqual(expectedRundown);
    expect(
      itemsAfter?.find((item) => item.id === 'item-podio-baja-ufpr'),
      'an item of another rundown must be the very same object',
    ).toBe(podiumItem);
  });
});

const cursorScenarios: Array<{
  name: string;
  cursorBefore: string | null;
  deletedItemId: string;
  expectedCursorAfter: string | null;
}> = [
  // "Next" was the deleted item: the one that followed it is next now.
  {
    name: 'moves the cursor to the following item when the cursor item is deleted',
    cursorBefore: 'item-bandeira-amarela',
    deletedItemId: 'item-bandeira-amarela',
    expectedCursorAfter: 'item-chegada-do-enduro',
  },
  // Nothing follows the last item, so there is no next item any more.
  {
    name: 'leaves the cursor on nothing when the cursor item was the last one',
    cursorBefore: 'item-chegada-do-enduro',
    deletedItemId: 'item-chegada-do-enduro',
    expectedCursorAfter: null,
  },
  // Deleting some other item must not change what goes on air next.
  {
    name: 'keeps the cursor on its item when another item is deleted',
    cursorBefore: 'item-chegada-do-enduro',
    deletedItemId: 'item-largada-do-enduro',
    expectedCursorAfter: 'item-chegada-do-enduro',
  },
  // A cursor on nothing stays on nothing.
  {
    name: 'keeps an empty cursor empty',
    cursorBefore: null,
    deletedItemId: 'item-bandeira-amarela',
    expectedCursorAfter: null,
  },
];

describe('deleteItem and the cursor', () => {
  it.each(cursorScenarios)('$name', ({ cursorBefore, deletedItemId, expectedCursorAfter }) => {
    // Arrange: the main session with three items and the cursor of this scenario.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown(cursorBefore), buildPodiumRundown(null)],
      items: buildThreeEnduroItems(),
    });

    // Act: delete the item this scenario names.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteItem', itemId: deletedItemId },
      contextOfTheRundownCommand,
    );

    // Assert: the main session's cursor is where the scenario expects it.
    const rundownsAfter = outcome.status === 'applied' ? outcome.slices.rundowns : undefined;
    expect(rundownsAfter, 'the cursor must be where this scenario says').toEqual([
      buildMainSessionRundown(expectedCursorAfter),
      buildPodiumRundown(null),
    ]);
    // The store saves and broadcasts the rundowns only when they are a different array.
    expect(
      rundownsAfter === slicesBefore.rundowns,
      'the rundowns must be the very same array exactly when the cursor did not move',
    ).toBe(cursorBefore === expectedCursorAfter);
  });
});

describe('deleteItem and what is on air', () => {
  it('leaves a graphic taken from the deleted item on air, still stamped with its id', () => {
    // Arrange: the yellow flag clock on air, taken from the yellow flag item.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: buildThreeEnduroItems(),
      instances: [buildYellowFlagClockOnAir()],
    });

    // Act: delete the yellow flag item while its clock is on air.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteItem', itemId: 'item-bandeira-amarela' },
      contextOfTheRundownCommand,
    );

    // Assert: the instances slice is the very same array: nothing left the air.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.instances, 'deleting an item must never take a graphic off air').toBe(
      slicesBefore.instances,
    );
    expect(
      slicesAfter?.instances[0]?.itemId,
      'the instance keeps the id of the item it came from, although the item is gone',
    ).toBe('item-bandeira-amarela');
  });
});

describe('deleteItem, when it must be refused', () => {
  it('refuses an item that does not exist, with a pt-BR reason', () => {
    // Arrange: the main session with its three items.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: buildThreeEnduroItems() });

    // Act: delete an item that is not there, as a second press on "excluir" would.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteItem', itemId: 'item-volta-mais-rapida' },
      contextOfTheRundownCommand,
    );

    // Assert: refused with a stable code and the pt-BR reason.
    expect(outcome, 'an unknown item must be refused').toEqual({
      status: 'refused',
      error: {
        code: 'ITEM_NOT_FOUND',
        message: 'O item "item-volta-mais-rapida" não existe; ele pode ter sido excluído.',
      },
    });
  });
});
