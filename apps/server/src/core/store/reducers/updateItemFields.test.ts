/**
 * The updateItemFields reducer (apps/server)
 *
 * What this module is for:
 *   updateItemFields changes parts of a prepared item: some field values, its label,
 *   colour, notes or auto-out delay. A part the command leaves out stays as it is, and
 *   field values are merged key by key over the ones the item already has.
 *
 * What these tests prove:
 *   - Each part the command names is changed and every other part is kept.
 *   - A field value named in the command replaces the old one; a field not named stays.
 *   - `autoOutAfterMs: null` removes the delay; a number sets it.
 *   - The item keeps its id, rundown, position, graphic and layer.
 *   - An update that leaves the item exactly as it was hands back the very same slices,
 *     so nothing is saved or broadcast.
 *   - Other items, the rundowns and what is on air are untouched.
 *   - An item that does not exist is refused with a pt-BR reason.
 *
 * What these tests deliberately do not cover:
 *   - The command's shape; the shared schema tests cover it.
 *   - Which field may say takeTime; updateItemFieldsTakeTimeField.test.ts.
 *   - An instance already on air from this item: it keeps the data it was taken with,
 *     which takeItem.test.ts shows by never reading the item again after the take.
 */
import type { Command, Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroClockFields,
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildPodiumRundown,
  buildRaceDaySlicesWithRundown,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

/** Builds "Largada do enduro" with a 20 second auto-out, to test removing the delay. */
function buildEnduroStartItemWithAutoOut(): Item {
  return { ...buildEnduroStartItem(0), autoOutAfterMs: 20_000 };
}

const changedPartScenarios: Array<{
  name: string;
  itemBefore: Item;
  command: Command;
  expectedItemAfter: Item;
}> = [
  // The operator renames a row so it reads better in the rundown.
  {
    name: 'changes the label and keeps everything else',
    itemBefore: buildEnduroStartItem(0),
    command: {
      type: 'updateItemFields',
      itemId: 'item-largada-do-enduro',
      label: 'Largada — bandeira verde',
    },
    expectedItemAfter: { ...buildEnduroStartItem(0), label: 'Largada — bandeira verde' },
  },
  // Colour and notes are independent parts and can change in one command.
  {
    name: 'changes the colour and the notes together',
    itemBefore: buildEnduroStartItem(0),
    command: {
      type: 'updateItemFields',
      itemId: 'item-largada-do-enduro',
      color: 'info',
      notes: 'Conferir o horário com a cronometragem.',
    },
    expectedItemAfter: {
      ...buildEnduroStartItem(0),
      color: 'info',
      notes: 'Conferir o horário com a cronometragem.',
    },
  },
  // Merging key by key: the session name changes, the five other clock fields stay.
  {
    name: 'replaces only the field value the command names',
    itemBefore: buildEnduroStartItem(0),
    command: {
      type: 'updateItemFields',
      itemId: 'item-largada-do-enduro',
      fields: { sessionName: { kind: 'literal', value: 'Enduro — 2ª bateria' } },
    },
    expectedItemAfter: {
      ...buildEnduroStartItem(0),
      fields: {
        ...buildEnduroClockFields('green'),
        sessionName: { kind: 'literal', value: 'Enduro — 2ª bateria' },
      },
    },
  },
  // A field the item did not have yet is added by the same merge.
  {
    name: 'adds a field value the item did not have',
    itemBefore: buildEnduroStartItem(0),
    command: {
      type: 'updateItemFields',
      itemId: 'item-largada-do-enduro',
      fields: { lapsCompletedByLeader: { kind: 'literal', value: 12 } },
    },
    expectedItemAfter: {
      ...buildEnduroStartItem(0),
      fields: {
        ...buildEnduroClockFields('green'),
        lapsCompletedByLeader: { kind: 'literal', value: 12 },
      },
    },
  },
  // A number sets the delay on an item that stayed on air until cleared.
  {
    name: 'sets an auto-out delay of 8 seconds',
    itemBefore: buildEnduroStartItem(0),
    command: {
      type: 'updateItemFields',
      itemId: 'item-largada-do-enduro',
      autoOutAfterMs: 8_000,
    },
    expectedItemAfter: { ...buildEnduroStartItem(0), autoOutAfterMs: 8_000 },
  },
  // null is how the editor says "no auto-out any more"; leaving it out would keep it.
  {
    name: 'removes the auto-out delay when the command sends null',
    itemBefore: buildEnduroStartItemWithAutoOut(),
    command: {
      type: 'updateItemFields',
      itemId: 'item-largada-do-enduro',
      autoOutAfterMs: null,
    },
    expectedItemAfter: buildEnduroStartItem(0),
  },
  // Changing the label must not drop a delay the command did not mention.
  {
    name: 'keeps the auto-out delay when the command does not mention it',
    itemBefore: buildEnduroStartItemWithAutoOut(),
    command: {
      type: 'updateItemFields',
      itemId: 'item-largada-do-enduro',
      label: 'Largada — bandeira verde',
    },
    expectedItemAfter: {
      ...buildEnduroStartItemWithAutoOut(),
      label: 'Largada — bandeira verde',
    },
  },
];

describe('updateItemFields, changing parts of an item', () => {
  it.each(changedPartScenarios)('$name', ({ itemBefore, command, expectedItemAfter }) => {
    // Arrange: the main session with the item of this scenario and the yellow flag
    // after it, frozen so that changing it in place would throw.
    const yellowFlagItem = Object.freeze(buildYellowFlagItem(1));
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [itemBefore, yellowFlagItem],
    });

    // Act: update the first item.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheRundownCommand);

    // Assert: the first item is as expected and the second is the very same object.
    expect(outcome.status, 'the update must be applied').toBe('applied');
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.items[0], 'the item must hold the changed parts and keep the rest').toEqual(
      expectedItemAfter,
    );
    expect(slicesAfter?.items[1], 'the other item must be the very same object').toBe(
      yellowFlagItem,
    );
    expect(slicesAfter?.rundowns, 'an update must not change the rundowns').toBe(
      slicesBefore.rundowns,
    );
    expect(slicesAfter?.instances, 'an update must not change what is on air').toBe(
      slicesBefore.instances,
    );
  });

  it('leaves no autoOutAfterMs key behind when the delay is removed', () => {
    // Arrange: an item with a 20 second auto-out.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [buildEnduroStartItemWithAutoOut()],
    });

    // Act: remove the delay.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'updateItemFields', itemId: 'item-largada-do-enduro', autoOutAfterMs: null },
      contextOfTheRundownCommand,
    );

    // Assert: the key is gone, not set to null, which the item schema would refuse.
    const itemAfter = outcome.status === 'applied' ? outcome.slices.items[0] : undefined;
    expect(
      itemAfter !== undefined && 'autoOutAfterMs' in itemAfter,
      'a removed delay must leave no autoOutAfterMs key on the item',
    ).toBe(false);
  });
});

const unchangedItemScenarios: Array<{ name: string; command: Command }> = [
  // The schema accepts an update that names only the item; it has nothing to change.
  {
    name: 'an update that names only the item',
    command: { type: 'updateItemFields', itemId: 'item-largada-do-enduro' },
  },
  // The editor saved without the operator changing anything: same label, same colour.
  {
    name: 'an update that sends the values the item already has',
    command: {
      type: 'updateItemFields',
      itemId: 'item-largada-do-enduro',
      label: 'Largada do enduro',
      color: 'success',
      fields: { state: { kind: 'literal', value: 'green' } },
    },
  },
];

describe('updateItemFields, when nothing would change', () => {
  it.each(unchangedItemScenarios)('hands back the very same slices for $name', ({ command }) => {
    // Arrange: the main session with the start item.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [buildEnduroStartItem(0)] });

    // Act: send the update.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheRundownCommand);

    // Assert: accepted, and the slices are the very same object.
    expect(outcome.status, 'an update that changes nothing is still accepted').toBe('applied');
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'unchanged slices must be the very same object, so nothing is saved or broadcast',
    ).toBe(slicesBefore);
  });
});

describe('updateItemFields, when it must be refused', () => {
  it('refuses an item that does not exist, with a pt-BR reason', () => {
    // Arrange: the main session with one item, its cursor on it.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown('item-largada-do-enduro'), buildPodiumRundown(null)],
      items: [buildEnduroStartItem(0)],
    });

    // Act: update an item that was never created (or was deleted by another operator).
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'updateItemFields', itemId: 'item-volta-mais-rapida', label: 'Volta mais rápida' },
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
