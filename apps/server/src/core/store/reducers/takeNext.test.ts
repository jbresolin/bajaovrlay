/**
 * The takeNext reducer (apps/server)
 *
 * What this module is for:
 *   takeNext is what the Space key sends: "take whatever is next in this rundown". It
 *   takes the item the rundown's cursor is on, through the same code as takeItem, so
 *   the cursor then moves on to the following item.
 *
 * What these tests prove:
 *   - takeNext gives exactly the slices a takeItem of the cursor item gives.
 *   - Pressing it three times walks a three-item rundown in order and ends with the
 *     cursor on nothing.
 *   - With the cursor on nothing it is refused with a pt-BR message that tells the
 *     operator what to do; a rundown that does not exist is refused too.
 *
 * What these tests deliberately do not cover:
 *   - What the instance on air looks like; takeItem.test.ts covers it.
 */
import type { Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';
import {
  buildEnduroFinishItem,
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildPodiumRundown,
  buildRaceDaySlicesWithRundown,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
  mainSessionRundownId,
} from './rundownSlices.testSupport.js';

/** Builds the main session's three items in their usual order: start, yellow, finish. */
function buildThreeEnduroItems(): Item[] {
  return [buildEnduroStartItem(0), buildYellowFlagItem(1), buildEnduroFinishItem(2)];
}

/** Builds the main session with three items and its cursor on the given item. */
function buildMainSessionWithCursorOn(cursorItemId: string | null): SlicesChangedByCommands {
  return buildRaceDaySlicesWithRundown({
    rundowns: [buildMainSessionRundown(cursorItemId), buildPodiumRundown(null)],
    items: buildThreeEnduroItems(),
  });
}

describe('takeNext, with the cursor on an item', () => {
  it('gives exactly the slices a takeItem of the cursor item gives', () => {
    // Arrange: the cursor on the yellow flag item, and what takeItem of it gives.
    const slicesBefore = buildMainSessionWithCursorOn('item-bandeira-amarela');
    const outcomeOfTakeItem = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-bandeira-amarela' },
      contextOfTheRundownCommand,
    );

    // Act: press Space.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeNext', rundownId: mainSessionRundownId },
      contextOfTheRundownCommand,
    );

    // Assert: applied, and equal to the takeItem in every slice.
    expect(outcome.status, 'the cursor item must be taken').toBe('applied');
    expect(outcome, 'takeNext must do exactly what takeItem of the cursor item does').toEqual(
      outcomeOfTakeItem,
    );
  });

  it('walks the rundown in order when pressed three times, ending with no next item', () => {
    // Arrange: the cursor on the first of three items, nothing on air.
    let slices = buildMainSessionWithCursorOn('item-largada-do-enduro');
    const itemIdsPutOnAir: Array<string | undefined> = [];

    // Act: press Space three times, each press starting from what the last one left.
    for (let pressNumber = 1; pressNumber <= 3; pressNumber += 1) {
      const outcome = reduceCommand(
        slices,
        { type: 'takeNext', rundownId: mainSessionRundownId },
        contextOfTheRundownCommand,
      );
      if (outcome.status === 'applied') {
        slices = outcome.slices;
        itemIdsPutOnAir.push(slices.instances[0]?.itemId);
      }
    }

    // Assert: the three items went on air in rundown order, and nothing is next.
    expect(itemIdsPutOnAir, 'the three presses must take the items in rundown order').toEqual([
      'item-largada-do-enduro',
      'item-bandeira-amarela',
      'item-chegada-do-enduro',
    ]);
    expect(
      slices.rundowns[0]?.cursorItemId,
      'after the last item the cursor must be on nothing',
    ).toBeNull();
  });
});

describe('takeNext, when it must be refused', () => {
  it('refuses a rundown whose cursor is on nothing, telling the operator what to do', () => {
    // Arrange: three items, but the cursor on nothing, as after the last take.
    const slicesBefore = buildMainSessionWithCursorOn(null);

    // Act: press Space.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeNext', rundownId: mainSessionRundownId },
      contextOfTheRundownCommand,
    );

    // Assert: refused in pt-BR; nothing goes on air.
    expect(outcome, 'an empty cursor must refuse the take with a pt-BR message').toEqual({
      status: 'refused',
      error: {
        code: 'RUNDOWN_CURSOR_EMPTY',
        message:
          'O rundown "Sessão principal" não tem próximo item: o cursor não está em nenhum ' +
          'item. Escolha o próximo item antes de colocar no ar.',
      },
    });
  });

  it('refuses a rundown that does not exist, with a pt-BR reason', () => {
    // Arrange: the main session with its cursor on the first item.
    const slicesBefore = buildMainSessionWithCursorOn('item-largada-do-enduro');

    // Act: press Space for a rundown that is not there.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeNext', rundownId: 'treino-livre' },
      contextOfTheRundownCommand,
    );

    // Assert: refused with a stable code and the pt-BR reason.
    expect(outcome, 'an unknown rundown must be refused').toEqual({
      status: 'refused',
      error: { code: 'RUNDOWN_NOT_FOUND', message: 'O rundown "treino-livre" não existe.' },
    });
  });
});
