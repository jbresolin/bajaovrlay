/**
 * The takePreview reducer: the rundown cursor (apps/server)
 *
 * What this module is for:
 *   The rundown's cursor is the plan: "what goes next". A take of the cursor item
 *   carries the plan out, so the cursor moves on; a take of any other item leaves the
 *   plan alone. takePreview puts an item on air just as takeItem does, so it follows the
 *   very same rule, with the same code: the cursor moves only if the item that was
 *   previewed is the cursor item at the moment of the take.
 *
 * What these tests prove:
 *   - Taking the preview of the cursor item moves the cursor to the item after it, and to
 *     nothing after the last item, which also marks the rundown as played to its end.
 *   - Taking the preview of any other item, or with the cursor on nothing, hands back the
 *     very same rundowns array.
 *   - A preview made by hand (no item), and a preview whose item was deleted meanwhile,
 *     leave the cursor alone; the instance on air still carries the deleted item's id.
 *
 * What these tests deliberately do not cover:
 *   - The instance and the data that go on air; takePreview.test.ts covers them.
 *   - The cursor rule of takeItem itself; takeItem.test.ts covers it.
 */
import type { Instance, Item, Rundown } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildTeam42LowerThirdOnPreview,
  buildYellowFlagItemOnPreview,
  contextOfTheLaterTake,
} from './previewSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroFinishItem,
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildPodiumRundown,
  buildRaceDaySlicesWithRundown,
  buildYellowFlagItem,
} from './rundownSlices.testSupport.js';

/** Builds the main session's three items in their usual order: start, yellow, finish. */
function buildThreeEnduroItems(): Item[] {
  return [buildEnduroStartItem(0), buildYellowFlagItem(1), buildEnduroFinishItem(2)];
}

/** Builds the two rundowns with the main session's cursor on the given item (or nothing). */
function buildRundownsWithMainCursorOn(cursorItemId: string | null): Rundown[] {
  return [buildMainSessionRundown(cursorItemId), buildPodiumRundown(null)];
}

describe('takePreview of the cursor item', () => {
  it('moves the cursor to the item after the one taken', () => {
    // Arrange: the cursor on the yellow flag item, which is also what is previewed.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: buildRundownsWithMainCursorOn('item-bandeira-amarela'),
      items: buildThreeEnduroItems(),
      instances: [buildYellowFlagItemOnPreview()],
    });

    // Act: press "Tomar" for the clock layer.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'clock' },
      contextOfTheLaterTake,
    );

    // Assert: the plan moved on to the finish; the podium rundown was not touched.
    const rundownsAfter = outcome.status === 'applied' ? outcome.slices.rundowns : undefined;
    expect(rundownsAfter, 'the cursor must move to the item after the one taken').toEqual([
      buildMainSessionRundown('item-chegada-do-enduro'),
      buildPodiumRundown(null),
    ]);
  });

  it('leaves the cursor on nothing after the last item and marks the rundown as played to its end', () => {
    // Arrange: only the yellow flag item in the main session, with the cursor on it and
    // the item previewed.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: buildRundownsWithMainCursorOn('item-bandeira-amarela'),
      items: [buildYellowFlagItem(0)],
      instances: [buildYellowFlagItemOnPreview()],
    });

    // Act: press "Tomar".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'clock' },
      contextOfTheLaterTake,
    );

    // Assert: no next item, so the cursor is on nothing, with the same end mark takeItem sets.
    const rundownsAfter = outcome.status === 'applied' ? outcome.slices.rundowns : undefined;
    expect(rundownsAfter?.[0], 'the rundown must be marked as played to its end').toEqual({
      ...buildMainSessionRundown(null),
      wasLastItemTakenAtCursor: true,
    });
  });
});

describe('takePreview that leaves the cursor alone', () => {
  const untouchedCursorScenarios: Array<{
    name: string;
    cursorItemId: string | null;
    items: Item[];
    previewInstance: Instance;
    layerId: string;
    expectedItemIdOnAir: string | undefined;
  }> = [
    // A row previewed ad hoc with its "Prévia" button while the plan points elsewhere.
    {
      name: 'does not move a cursor that is on another item',
      cursorItemId: 'item-largada-do-enduro',
      items: buildThreeEnduroItems(),
      previewInstance: buildYellowFlagItemOnPreview(),
      layerId: 'clock',
      expectedItemIdOnAir: 'item-bandeira-amarela',
    },
    // With the cursor on nothing no item is the cursor item, so every take is ad hoc.
    {
      name: 'does not put a cursor that is on nothing anywhere',
      cursorItemId: null,
      items: buildThreeEnduroItems(),
      previewInstance: buildYellowFlagItemOnPreview(),
      layerId: 'clock',
      expectedItemIdOnAir: 'item-bandeira-amarela',
    },
    // The item was deleted between the preview and the take. deleteItem already moved the
    // cursor on; the take finds no item and leaves it there. The instance keeps the id.
    {
      name: 'does not move the cursor when the previewed item was deleted meanwhile',
      cursorItemId: 'item-chegada-do-enduro',
      items: [buildEnduroStartItem(0), buildEnduroFinishItem(1)],
      previewInstance: buildYellowFlagItemOnPreview(),
      layerId: 'clock',
      expectedItemIdOnAir: 'item-bandeira-amarela',
    },
    // A preview made from "Edição rápida" belongs to no item, so no plan was carried out.
    {
      name: 'does not move the cursor for a preview made by hand',
      cursorItemId: 'item-bandeira-amarela',
      items: buildThreeEnduroItems(),
      previewInstance: buildTeam42LowerThirdOnPreview(),
      layerId: 'lower-third',
      expectedItemIdOnAir: undefined,
    },
  ];

  it.each(untouchedCursorScenarios)(
    '$name',
    ({ cursorItemId, items, previewInstance, layerId, expectedItemIdOnAir }) => {
      // Arrange: the cursor, the items and the preview of this row.
      const slicesBefore = buildRaceDaySlicesWithRundown({
        rundowns: buildRundownsWithMainCursorOn(cursorItemId),
        items,
        instances: [previewInstance],
      });

      // Act: press "Tomar" for the layer of the row.
      const outcome = reduceCommand(
        slicesBefore,
        { type: 'takePreview', layerId },
        contextOfTheLaterTake,
      );

      // Assert: the take happened, the very same rundowns array came back (so nothing
      // about the rundown is saved or broadcast), and the instance names its item.
      const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
      expect(slicesAfter?.rundowns, 'the cursor must stay exactly where it was').toBe(
        slicesBefore.rundowns,
      );
      expect(
        slicesAfter?.instances.map((instance) => [instance.target, instance.itemId]),
        'the preview must be on air, carrying the item id it was previewed with',
      ).toEqual([['program', expectedItemIdOnAir]]);
    },
  );
});
