/**
 * The reorderItems reducer (apps/server)
 *
 * What this module is for:
 *   When the operator drags a row of the rundown, the control page sends reorderItems
 *   with the whole rundown in its new order, as a list of item ids. The reducer gives
 *   each item the position it has in that list. A list that is not exactly the
 *   rundown's items, once each, is refused: applying it would lose or invent an item.
 *
 * What these tests prove:
 *   - The full list is applied: every item gets its new position, numbered from 0.
 *   - The cursor stays on the same item wherever that item moved to.
 *   - Items of another rundown are untouched.
 *   - A list that leaves an item out, brings an unknown id or brings an item of another
 *     rundown is refused with a pt-BR reason; so is a rundown that does not exist.
 *   - A list that is already the current order hands back the very same slices.
 *
 * What these tests deliberately do not cover:
 *   - A list with the same id twice, or with an empty id: the shared schema refuses
 *     those before the reducer runs (packages/shared/src/rundown).
 */
import type { Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
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

const appliedOrderScenarios: Array<{
  name: string;
  orderedItemIds: string[];
  expectedRundown: Array<[string, number]>;
}> = [
  // The operator drags the last row to the top: every item changes position.
  {
    name: 'moves the last item to the top and the other two down',
    orderedItemIds: ['item-chegada-do-enduro', 'item-largada-do-enduro', 'item-bandeira-amarela'],
    expectedRundown: [
      ['Chegada do enduro', 0],
      ['Largada do enduro', 1],
      ['Bandeira amarela', 2],
    ],
  },
  // Two neighbours swap and the first item keeps its place.
  {
    name: 'swaps the last two items and leaves the first where it was',
    orderedItemIds: ['item-largada-do-enduro', 'item-chegada-do-enduro', 'item-bandeira-amarela'],
    expectedRundown: [
      ['Largada do enduro', 0],
      ['Chegada do enduro', 1],
      ['Bandeira amarela', 2],
    ],
  },
  // A complete reversal, the furthest a permutation can be from the current order.
  {
    name: 'reverses the whole rundown',
    orderedItemIds: ['item-chegada-do-enduro', 'item-bandeira-amarela', 'item-largada-do-enduro'],
    expectedRundown: [
      ['Chegada do enduro', 0],
      ['Bandeira amarela', 1],
      ['Largada do enduro', 2],
    ],
  },
];

describe('reorderItems, applying the new order', () => {
  it.each(appliedOrderScenarios)('$name', ({ orderedItemIds, expectedRundown }) => {
    // Arrange: the main session with three items and its cursor on the yellow flag,
    // and one podium item, frozen so that changing it in place would throw.
    const podiumItem = Object.freeze(buildPodiumTeamItem(0));
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown('item-bandeira-amarela'), buildPodiumRundown(null)],
      items: [...buildThreeEnduroItems(), podiumItem],
    });

    // Act: send the whole rundown in its new order.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'reorderItems', rundownId: mainSessionRundownId, orderedItemIds },
      contextOfTheRundownCommand,
    );

    // Assert: the rundown reads in the new order, the cursor is on the same item, and
    // the podium item is untouched.
    expect(outcome.status, 'the new order must be applied').toBe('applied');
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      readLabelsAndOrdersOfRundown(slicesAfter?.items, mainSessionRundownId),
      'every item must have the position it has in the list sent',
    ).toEqual(expectedRundown);
    expect(slicesAfter?.rundowns, 'reordering must leave the cursor on the same item').toBe(
      slicesBefore.rundowns,
    );
    expect(
      slicesAfter?.items.find((item) => item.id === 'item-podio-baja-ufpr'),
      'an item of another rundown must be the very same object',
    ).toBe(podiumItem);
  });

  it('hands back the very same slices when the list is already the current order', () => {
    // Arrange: the main session with its three items.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: buildThreeEnduroItems() });

    // Act: send the order the rundown already has, as a drag dropped where it started.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'reorderItems',
        rundownId: mainSessionRundownId,
        orderedItemIds: [
          'item-largada-do-enduro',
          'item-bandeira-amarela',
          'item-chegada-do-enduro',
        ],
      },
      contextOfTheRundownCommand,
    );

    // Assert: accepted, with the very same slices.
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'an unchanged order must hand back the same slices, so nothing is saved or broadcast',
    ).toBe(slicesBefore);
  });
});

const notAPermutationMessage =
  'A nova ordem do rundown "Sessão principal" não confere com os itens dele: ' +
  'ela precisa trazer todos os itens do rundown, cada um uma única vez.';

const refusedOrderScenarios: Array<{
  name: string;
  rundownId: string;
  orderedItemIds: string[];
  expectedError: { code: string; message: string };
}> = [
  // Another operator added an item while this one was dragging: the list is short.
  {
    name: 'refuses a list that leaves one of the rundown items out',
    rundownId: mainSessionRundownId,
    orderedItemIds: ['item-chegada-do-enduro', 'item-largada-do-enduro'],
    expectedError: { code: 'ITEMS_NOT_A_PERMUTATION', message: notAPermutationMessage },
  },
  // Another operator deleted an item meanwhile: the list names an item that is gone.
  {
    name: 'refuses a list that brings an item that does not exist',
    rundownId: mainSessionRundownId,
    orderedItemIds: [
      'item-largada-do-enduro',
      'item-bandeira-amarela',
      'item-chegada-do-enduro',
      'item-volta-mais-rapida',
    ],
    expectedError: { code: 'ITEMS_NOT_A_PERMUTATION', message: notAPermutationMessage },
  },
  // Right length, but one id belongs to the podium rundown: it would steal that item.
  {
    name: 'refuses a list with the right length that brings an item of another rundown',
    rundownId: mainSessionRundownId,
    orderedItemIds: ['item-largada-do-enduro', 'item-bandeira-amarela', 'item-podio-baja-ufpr'],
    expectedError: { code: 'ITEMS_NOT_A_PERMUTATION', message: notAPermutationMessage },
  },
  // An empty list is only right for an empty rundown; this one has three items.
  {
    name: 'refuses an empty list for a rundown that has items',
    rundownId: mainSessionRundownId,
    orderedItemIds: [],
    expectedError: { code: 'ITEMS_NOT_A_PERMUTATION', message: notAPermutationMessage },
  },
  // A rundown that does not exist has no items to put in order.
  {
    name: 'refuses a rundown that does not exist',
    rundownId: 'treino-livre',
    orderedItemIds: ['item-largada-do-enduro'],
    expectedError: { code: 'RUNDOWN_NOT_FOUND', message: 'O rundown "treino-livre" não existe.' },
  },
];

describe('reorderItems, when the list is not a permutation of the rundown', () => {
  it.each(refusedOrderScenarios)('$name', ({ rundownId, orderedItemIds, expectedError }) => {
    // Arrange: the main session with three items, and one item in the podium rundown.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [...buildThreeEnduroItems(), buildPodiumTeamItem(0)],
    });

    // Act: send the list of this scenario.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'reorderItems', rundownId, orderedItemIds },
      contextOfTheRundownCommand,
    );

    // Assert: refused with a stable code and the pt-BR reason.
    expect(outcome, 'the list must be refused with the pt-BR reason').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});
