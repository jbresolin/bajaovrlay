/**
 * How "Escolher carros" opens for an item (apps/control)
 *
 * What this module is for:
 *   "Escolher carros" (BAJAOVRLAY-82) opens with the cars the item stores, so the same
 *   battle is one press away, and with the source and "Ao vivo / Congelado" every pick
 *   keeps.
 *
 * What these tests prove:
 *   - The leaders' card (cars 31 and 38 by number) opens "Por número" with 31 and 38.
 *   - A card stored as the battle for 2nd place opens "Pela posição" with 2.
 *   - A card typed by hand opens "Por número" with empty boxes.
 *   - The source is the item's, frozen when the item is frozen; a card typed by hand gets
 *     the only source sending positions, live.
 *
 * What these tests deliberately do not cover:
 *   - Reading a stored pick field by field: carGroupPicksOfStoredItem.test.ts.
 */
import type { Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildBattleCardGraphic,
  buildBattleCardOfTheLeadersItem,
  buildSlicesWithTheBattleCardOfTheLeaders,
} from '@/features/items/battleCardOfTheLeaders.testSupport';
import { buildItemFieldsOfCarPicks } from '@/features/schemaForm';
import { seededSimulatorId } from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { type CarGroupsToPickQuickly, findCarGroupsToPickQuickly } from './carGroupsToPickQuickly';
import { readSourceOfQuickCarPick, readStartOfQuickCarPick } from './quickCarPickStart';

/** What "Escolher carros" offers for the battle card. */
function readBattleCardOffer(): CarGroupsToPickQuickly {
  const offer = findCarGroupsToPickQuickly(buildBattleCardOfTheLeadersItem(), [
    buildBattleCardGraphic(),
  ]);
  if (offer?.battle === undefined) {
    throw new Error('the battle card must offer two cars and a battle');
  }
  return offer;
}

/** The leaders' card stored instead as the battle for 2nd place, frozen at the take. */
function buildBattleForSecondPlaceFrozenItem(): Item {
  const offer = readBattleCardOffer();
  const battle = offer.battle;
  if (battle === undefined) {
    throw new Error('the battle card must offer a battle');
  }
  const fields = buildItemFieldsOfCarPicks(offer.dataSchema, [
    {
      carGroup: battle.carGroupAhead,
      pick: { pickedBy: 'place', sourceId: seededSimulatorId, placeNumber: 2, isLive: false },
    },
    {
      carGroup: battle.carGroupBehind,
      pick: { pickedBy: 'place', sourceId: seededSimulatorId, placeNumber: 3, isLive: false },
    },
  ]);
  if (fields.status !== 'fields') {
    throw new Error('the battle for 2nd place must build');
  }
  return { ...buildBattleCardOfTheLeadersItem(), fields: fields.fields };
}

describe('readStartOfQuickCarPick', () => {
  it('opens the leaders’ card by number, with cars 31 and 38', () => {
    // Arrange: the card stored on cars 31 and 38 by number.
    const item = buildBattleCardOfTheLeadersItem();

    // Act: read how the box opens.
    const start = readStartOfQuickCarPick(item, readBattleCardOffer());

    // Assert: "Por número", both boxes filled.
    expect(start, 'the box must open with the cars the item stores').toEqual({
      way: 'carNumber',
      carNumberTextOfEachGroup: { ahead: '31', behind: '38' },
      placeText: '',
    });
  });

  it('opens a card stored as the battle for 2nd place by place, with 2', () => {
    // Arrange: the card stored on the 2nd and 3rd places.
    const item = buildBattleForSecondPlaceFrozenItem();

    // Act: read how the box opens.
    const start = readStartOfQuickCarPick(item, readBattleCardOffer());

    // Assert: "Pela posição" with 2, and empty number boxes.
    expect(start, 'a battle stored by place must open on its place').toEqual({
      way: 'place',
      carNumberTextOfEachGroup: { ahead: '', behind: '' },
      placeText: '2',
    });
  });

  it('opens a card typed by hand by number, with empty boxes', () => {
    // Arrange: the card with nothing stored for its cars.
    const item = { ...buildBattleCardOfTheLeadersItem(), fields: {} };

    // Act: read how the box opens.
    const start = readStartOfQuickCarPick(item, readBattleCardOffer());

    // Assert: "Por número", nothing in the boxes.
    expect(start, 'a card with no cars picked must open empty').toEqual({
      way: 'carNumber',
      carNumberTextOfEachGroup: { ahead: '', behind: '' },
      placeText: '',
    });
  });
});

describe('readSourceOfQuickCarPick', () => {
  it('keeps the item’s source and its frozen choice', () => {
    // Arrange: the battle for 2nd place, frozen at the take on the simulator.
    const item = buildBattleForSecondPlaceFrozenItem();

    // Act: read the source of the picks.
    const source = readSourceOfQuickCarPick(
      item,
      readBattleCardOffer(),
      buildSlicesWithTheBattleCardOfTheLeaders(),
    );

    // Assert: the simulator, by its name, frozen.
    expect(source, 'a pick must keep the item’s source and "Congelado"').toEqual({
      status: 'source',
      source: { sourceId: seededSimulatorId, sourceLabel: 'Simulador — Enduro', isLive: false },
    });
  });

  it('gives a card typed by hand the only source sending positions, live', () => {
    // Arrange: the card with nothing stored for its cars.
    const item = { ...buildBattleCardOfTheLeadersItem(), fields: {} };

    // Act: read the source of the picks.
    const source = readSourceOfQuickCarPick(
      item,
      readBattleCardOffer(),
      buildSlicesWithTheBattleCardOfTheLeaders(),
    );

    // Assert: the simulator, live, as the editor's picker starts.
    expect(source, 'the only source with positions must be used, live').toEqual({
      status: 'source',
      source: { sourceId: seededSimulatorId, sourceLabel: 'Simulador — Enduro', isLive: true },
    });
  });
});
