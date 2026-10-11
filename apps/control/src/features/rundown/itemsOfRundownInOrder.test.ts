/**
 * Items of one rundown, in firing order (apps/control)
 *
 * What this module is for:
 *   The server sends every item of every rundown in one list, the `items` slice, each
 *   item saying which rundown it belongs to and its position there (`order`, from 0).
 *   The rundown column needs just the items of the rundown it shows, first to last.
 *
 * What these tests prove:
 *   - Only the items of the asked rundown are listed.
 *   - They come out by `order`, whatever order the server listed them in.
 *   - The list the server sent is left as it was (the store owns it).
 *
 * What these tests deliberately do not cover:
 *   - Drawing the rows; RundownPanel.test.tsx does that.
 *   - Keeping `order` as 0, 1, 2 with no gaps, which is the server's job.
 */
import { describe, expect, it } from 'vitest';

import {
  buildRaceClockItem,
  buildThreeItemsOfTheEnduranceRace,
} from '@/state/rundownLikeTheServerSends.testSupport';

import { listItemsOfRundownInOrder } from './itemsOfRundownInOrder';

describe('listItemsOfRundownInOrder', () => {
  it('lists the items by their order even when the server sent them shuffled', () => {
    // Arrange: the three endurance items, sent last one first.
    const itemsAsSent = buildThreeItemsOfTheEnduranceRace().reverse();

    // Act: ask for the main rundown's items.
    const itemsInOrder = listItemsOfRundownInOrder(itemsAsSent, 'sessao-principal');

    // Assert: start, yellow flag, finish.
    expect(
      itemsInOrder.map((item) => item.label),
      'the items must come out by their `order`, not in the order they were sent',
    ).toEqual(['Largada do enduro', 'Bandeira amarela', 'Chegada do enduro']);
  });

  it('leaves out the items of every other rundown', () => {
    // Arrange: the three endurance items plus one podium item of the awards rundown.
    const podiumItemOfAnotherRundown = {
      ...buildRaceClockItem({
        id: 'item-podio-geral',
        order: 0,
        label: 'Pódio geral',
        color: 'highlight',
        flagState: 'finished',
      }),
      rundownId: 'premiacao',
    };
    const itemsAsSent = [...buildThreeItemsOfTheEnduranceRace(), podiumItemOfAnotherRundown];

    // Act: ask for the main rundown's items.
    const itemsInOrder = listItemsOfRundownInOrder(itemsAsSent, 'sessao-principal');

    // Assert: the podium item is not among them.
    expect(
      itemsInOrder.map((item) => item.label),
      'an item of the awards rundown must not show up in the main rundown',
    ).toEqual(['Largada do enduro', 'Bandeira amarela', 'Chegada do enduro']);
  });

  it('does not reorder the list it was given', () => {
    // Arrange: the three endurance items, sent last one first.
    const itemsAsSent = buildThreeItemsOfTheEnduranceRace().reverse();

    // Act: ask for the main rundown's items.
    listItemsOfRundownInOrder(itemsAsSent, 'sessao-principal');

    // Assert: the list that was passed in still has the finish first.
    expect(
      itemsAsSent.map((item) => item.label),
      'the list from the store must be left exactly as the server sent it',
    ).toEqual(['Chegada do enduro', 'Bandeira amarela', 'Largada do enduro']);
  });
});
