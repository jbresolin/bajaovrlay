/**
 * Commands that run a rundown: reorderItems, moveCursor, takeItem, takeNext (packages/shared)
 *
 * What this module is for:
 *   During a session the operator drags items into a new order (`reorderItems`), moves
 *   the "next" cursor without putting anything on air (`moveCursor`), puts one item on
 *   air (`takeItem`) or puts the item under the cursor on air (`takeNext`, the Space
 *   key). These schemas say what each command must look like before the server looks
 *   at its state.
 *
 * What these tests prove:
 *   - Each of the four commands is accepted unchanged in its real shape, including a
 *     moveCursor to nothing (null) and a reorderItems of a rundown with no items.
 *   - A reorderItems is refused, naming `orderedItemIds`, when the list names the same
 *     item twice, contains an empty id or is missing.
 *   - A moveCursor must write its item id (an id or null); leaving it out is refused.
 *   - A takeItem needs an item id and a takeNext needs a rundown id.
 *
 * What these tests deliberately do not cover:
 *   - The full "is this a permutation of the rundown's items?" rule of reorderItems. The
 *     schema can only see the list itself, so it refuses what is wrong in any rundown (a
 *     repeated id, an empty id). A list that leaves an item out, or names an item of
 *     another rundown, can only be refused by comparing it with the rundown, which the
 *     reorderItems reducer in apps/server does (error code ITEMS_NOT_A_PERMUTATION).
 *   - Whether the rundown or item exists, whether the cursor's item belongs to the
 *     rundown, and what a take puts on air; the reducers in apps/server check those.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from '../commands/command.js';

const enduroClockItemId = 'b1f7c2d0-93a4-4e1b-8c55-0d2a6f3e7a10';
const podiumLowerThirdItemId = 'e4a9d6c1-27b8-4f3a-b0d2-5c8e1f7a9b32';
const sponsorCardItemId = '0c3f8e2a-6d14-4a79-9e5b-b7d1c4f2a680';

describe('the rundown commands in their real shape', () => {
  const acceptedRundownCommandScenarios = [
    // The operator dragged the sponsor card from last to first: the full new order is sent.
    {
      name: 'accepts reorderItems with the full list of the rundown in its new order',
      command: {
        type: 'reorderItems',
        rundownId: 'sessao-principal',
        orderedItemIds: [sponsorCardItemId, enduroClockItemId, podiumLowerThirdItemId],
      },
    },
    // A rundown with no items has exactly one order: the empty one.
    {
      name: 'accepts reorderItems with an empty list, for a rundown with no items',
      command: { type: 'reorderItems', rundownId: 'sessao-principal', orderedItemIds: [] },
    },
    // The right-arrow key: the cursor goes to the next item and nothing goes on air.
    {
      name: 'accepts moveCursor to an item',
      command: {
        type: 'moveCursor',
        rundownId: 'sessao-principal',
        itemId: podiumLowerThirdItemId,
      },
    },
    // After the last item there is no next one; the cursor is put on nothing.
    {
      name: 'accepts moveCursor to nothing',
      command: { type: 'moveCursor', rundownId: 'sessao-principal', itemId: null },
    },
    // The "take" button on a rundown row.
    {
      name: 'accepts takeItem for one item',
      command: { type: 'takeItem', itemId: enduroClockItemId },
    },
    // The Space key: take whatever the cursor is on.
    {
      name: 'accepts takeNext for the main session',
      command: { type: 'takeNext', rundownId: 'sessao-principal' },
    },
  ];

  it.each(acceptedRundownCommandScenarios)('$name', ({ command }) => {
    // Arrange: the command as the control page sends it (from the table above).
    const commandFromControlPage = command;

    // Act: check the command.
    const result = CommandSchema.safeParse(commandFromControlPage);

    // Assert: it is accepted unchanged.
    expect(result.success, 'a rundown command in its real shape must be accepted').toBe(true);
    expect(result.data, 'a rundown command has no defaults to fill in').toEqual(command);
  });
});

describe('reorderItems and lists that can never be a permutation', () => {
  const refusedReorderScenarios = [
    // An item cannot be in two positions; a drag-and-drop bug could send this.
    {
      name: 'refuses a list that names the same item twice, naming orderedItemIds',
      orderedItemIds: [enduroClockItemId, podiumLowerThirdItemId, enduroClockItemId],
    },
    // An empty id names no item at all.
    {
      name: 'refuses a list that contains an empty id, naming orderedItemIds',
      orderedItemIds: [enduroClockItemId, ''],
    },
    // The new order is the whole point of the command; without it there is nothing to do.
    {
      name: 'refuses a reorderItems with no list, naming orderedItemIds',
      orderedItemIds: undefined,
    },
  ];

  it.each(refusedReorderScenarios)('$name', ({ orderedItemIds }) => {
    // Arrange: a reorder of the main session with the bad list from the table above.
    const reorderWithBadList = {
      type: 'reorderItems',
      rundownId: 'sessao-principal',
      orderedItemIds,
    };

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(reorderWithBadList);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at the list.
    expect(result.success, 'a list that fits no rundown must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the list').toContain('orderedItemIds');
  });

  it('puts the list first in the failure of a repeated id, so the server names that field', () => {
    // Arrange: the same item in the first and the last position.
    const reorderWithRepeatedItem = {
      type: 'reorderItems',
      rundownId: 'sessao-principal',
      orderedItemIds: [enduroClockItemId, podiumLowerThirdItemId, enduroClockItemId],
    };

    // Act: check it and read where the first problem was found.
    const result = CommandSchema.safeParse(reorderWithRepeatedItem);
    const pathOfTheFirstProblem = result.error?.issues[0]?.path;

    // Assert: the server builds its pt-BR message from this path, so it must be the list.
    expect(pathOfTheFirstProblem, 'the first problem must be found at orderedItemIds').toEqual([
      'orderedItemIds',
    ]);
  });
});

describe('the rundown commands with a part missing', () => {
  const refusedRundownCommandScenarios = [
    // "Cursor on nothing" must be said with null; a missing id is more likely a bug.
    {
      name: 'refuses a moveCursor that leaves the item id out, naming itemId',
      command: { type: 'moveCursor', rundownId: 'sessao-principal' },
      fieldNamedInTheFailure: 'itemId',
    },
    // The cursor belongs to a rundown, so the command must say which.
    {
      name: 'refuses a moveCursor that does not say which rundown, naming rundownId',
      command: { type: 'moveCursor', itemId: enduroClockItemId },
      fieldNamedInTheFailure: 'rundownId',
    },
    // A take of nothing is refused before it reaches the state.
    {
      name: 'refuses a takeItem with an empty item id, naming itemId',
      command: { type: 'takeItem', itemId: '' },
      fieldNamedInTheFailure: 'itemId',
    },
    // Space takes the cursor item of one rundown; the command must say which rundown.
    {
      name: 'refuses a takeNext that does not say which rundown, naming rundownId',
      command: { type: 'takeNext' },
      fieldNamedInTheFailure: 'rundownId',
    },
  ];

  it.each(refusedRundownCommandScenarios)('$name', ({ command, fieldNamedInTheFailure }) => {
    // Arrange: the incomplete command from the table above.
    const incompleteCommand = command;

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(incompleteCommand);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at the missing part.
    expect(result.success, 'an incomplete rundown command must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain(fieldNamedInTheFailure);
  });
});
