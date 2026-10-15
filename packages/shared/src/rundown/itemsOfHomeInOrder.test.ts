/**
 * Items of one rundown, in firing order (packages/shared, itemsOfHomeInOrder.ts)
 *
 * What this module is for:
 *   The `items` slice holds every item of every rundown in one list, each item saying
 *   which rundown it belongs to and its position there (`order`, from 0). The server's
 *   reducers and the control page's rundown column both need just the items of one
 *   rundown, first to last. `listItemsOfRundownInOrder` is the one place that does it,
 *   so the server and the page can never disagree about the order.
 *
 * What these tests prove:
 *   - Only the items of the asked rundown are listed.
 *   - They come out by `order`, whatever order the list held them in.
 *   - A rundown with no items gives an empty list.
 *   - The list handed in is left as it was (the store owns it).
 *
 * What these tests deliberately do not cover:
 *   - Keeping `order` as 0, 1, 2 with no gaps; the reducers in apps/server do that
 *     (itemOrdering.ts) and their own tests cover it.
 *   - Drawing the rows; RundownPanel.test.tsx in apps/control does that.
 */
import { describe, expect, it } from 'vitest';

import type { Item } from './item.js';
import { listItemsOfRundownInOrder } from './itemsOfHomeInOrder.js';

/** What makes one race clock item different from another in these tests. */
type RaceClockItemDescription = {
  id: string;
  rundownId: string;
  order: number;
  label: string;
};

/** Builds one prepared use of the race clock on the clock layer. */
function buildRaceClockItem(description: RaceClockItemDescription): Item {
  return {
    id: description.id,
    home: { kind: 'rundown', rundownId: description.rundownId },
    order: description.order,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: { sessionName: { kind: 'literal', value: 'Enduro de Resistência' } },
    label: description.label,
    color: 'neutral',
    notes: '',
  };
}

/** Builds the start, a yellow flag and the finish of the endurance race, in that order. */
function buildThreeItemsOfTheEnduranceRace(): Item[] {
  return [
    buildRaceClockItem({
      id: 'item-largada-do-enduro',
      rundownId: 'sessao-principal',
      order: 0,
      label: 'Largada do enduro',
    }),
    buildRaceClockItem({
      id: 'item-bandeira-amarela',
      rundownId: 'sessao-principal',
      order: 1,
      label: 'Bandeira amarela',
    }),
    buildRaceClockItem({
      id: 'item-chegada-do-enduro',
      rundownId: 'sessao-principal',
      order: 2,
      label: 'Chegada do enduro',
    }),
  ];
}

describe('listItemsOfRundownInOrder', () => {
  it('lists the items by their order even when the list holds them shuffled', () => {
    // Arrange: the three endurance items, held last one first.
    const itemsAsHeld = buildThreeItemsOfTheEnduranceRace().reverse();

    // Act: ask for the main rundown's items.
    const itemsInOrder = listItemsOfRundownInOrder(itemsAsHeld, 'sessao-principal');

    // Assert: start, yellow flag, finish.
    expect(
      itemsInOrder.map((item) => item.label),
      'the items must come out by their `order`, not in the order the list held them',
    ).toEqual(['Largada do enduro', 'Bandeira amarela', 'Chegada do enduro']);
  });

  it('leaves out the items of every other rundown', () => {
    // Arrange: the three endurance items plus one podium item of the awards rundown.
    const podiumItemOfTheAwardsRundown = buildRaceClockItem({
      id: 'item-podio-geral',
      rundownId: 'premiacao',
      order: 0,
      label: 'Pódio geral',
    });
    const itemsAsHeld = [...buildThreeItemsOfTheEnduranceRace(), podiumItemOfTheAwardsRundown];

    // Act: ask for the main rundown's items.
    const itemsInOrder = listItemsOfRundownInOrder(itemsAsHeld, 'sessao-principal');

    // Assert: the podium item is not among them.
    expect(
      itemsInOrder.map((item) => item.label),
      'an item of the awards rundown must not show up in the main rundown',
    ).toEqual(['Largada do enduro', 'Bandeira amarela', 'Chegada do enduro']);
  });

  it('gives an empty list for a rundown that has no items', () => {
    // Arrange: the three endurance items, and a qualifying rundown nobody has filled yet.
    const itemsAsHeld = buildThreeItemsOfTheEnduranceRace();

    // Act: ask for the items of the empty rundown.
    const itemsInOrder = listItemsOfRundownInOrder(itemsAsHeld, 'classificatoria');

    // Assert: nothing is listed, and nothing is borrowed from the main rundown.
    expect(itemsInOrder, 'a rundown with no items must give an empty list').toEqual([]);
  });

  it('does not reorder the list it was given', () => {
    // Arrange: the three endurance items, held last one first.
    const itemsAsHeld = buildThreeItemsOfTheEnduranceRace().reverse();

    // Act: ask for the main rundown's items.
    listItemsOfRundownInOrder(itemsAsHeld, 'sessao-principal');

    // Assert: the list that was passed in still has the finish first.
    expect(
      itemsAsHeld.map((item) => item.label),
      'the list from the store must be left exactly as it was handed in',
    ).toEqual(['Chegada do enduro', 'Bandeira amarela', 'Largada do enduro']);
  });
});
