/**
 * How "Escolher carros" (BAJAOVRLAY-82) opens for an item: the boxes filled with the cars
 * the item stores (so picking the same battle again is one press), the way that matches
 * them ("Pela posição" for a battle stored by place, the place right after, "Por número"
 * otherwise), and the source with "Ao vivo / Congelado" every pick keeps.
 */
import type { Item } from '@bajaovrlay/shared';

import {
  readCarPickStoredInItemFields,
  readSourceAndWhenOfCarGroupsInItemFields,
} from '@/features/schemaForm';

import type { CarGroupsToPickQuickly } from './carGroupsToPickQuickly';
import { chooseSourceForQuickCarPick, type SlicesForPositions } from './positionsOfTheSource';

/** The two ways of the box: a number per car, or the place of a battle. */
export type WayOfQuickCarPick = 'carNumber' | 'place';

/** What the box holds when it opens. */
export type StartOfQuickCarPick = {
  way: WayOfQuickCarPick;
  /** By group id: the number of the car the item stores by number, or ''. */
  carNumberTextOfEachGroup: Record<string, string>;
  /** The place of the battle the item stores by place, or ''. */
  placeText: string;
};

/** The source every pick is made on, as the box shows it. */
export type SourceOfQuickCarPick = { sourceId: string; sourceLabel: string; isLive: boolean };

/** Reads what the box opens with from the item's stored fields. */
export function readStartOfQuickCarPick(
  item: Item,
  offer: CarGroupsToPickQuickly,
): StartOfQuickCarPick {
  const carNumberTextOfEachGroup: Record<string, string> = {};
  for (const carGroup of offer.carGroups) {
    const storedPick = readCarPickStoredInItemFields(carGroup, offer.dataSchema, item.fields);
    carNumberTextOfEachGroup[carGroup.id] =
      storedPick?.pickedBy === 'number' ? storedPick.carNumberText : '';
  }

  const battle = offer.battle;
  if (battle !== undefined) {
    const pickAhead = readCarPickStoredInItemFields(
      battle.carGroupAhead,
      offer.dataSchema,
      item.fields,
    );
    const pickBehind = readCarPickStoredInItemFields(
      battle.carGroupBehind,
      offer.dataSchema,
      item.fields,
    );
    const isBattleStoredByPlace =
      pickAhead?.pickedBy === 'place' &&
      pickBehind?.pickedBy === 'place' &&
      pickAhead.placeNumber !== undefined &&
      pickBehind.placeNumber === pickAhead.placeNumber + 1;
    if (isBattleStoredByPlace) {
      return { way: 'place', carNumberTextOfEachGroup, placeText: String(pickAhead.placeNumber) };
    }
  }
  return { way: 'carNumber', carNumberTextOfEachGroup, placeText: '' };
}

/**
 * The source of the picks: the one the item's cars read, with their "Ao vivo / Congelado";
 * for cars typed by hand, the only source sending positions, live (the editor's default).
 * Undefined when no source can be told: the box then sends nothing.
 */
export function readSourceOfQuickCarPick(
  item: Item,
  offer: CarGroupsToPickQuickly,
  slices: SlicesForPositions,
): SourceOfQuickCarPick | undefined {
  const storedSourceAndWhen = readSourceAndWhenOfCarGroupsInItemFields(
    offer.carGroups,
    item.fields,
  );
  const sourceId = chooseSourceForQuickCarPick(storedSourceAndWhen?.sourceId, slices);
  if (sourceId === undefined) {
    return undefined;
  }
  const dataSource = slices.dataSources.find((candidate) => candidate.id === sourceId);
  return {
    sourceId,
    sourceLabel: dataSource?.label ?? sourceId,
    isLive: storedSourceAndWhen?.isLive ?? true,
  };
}
