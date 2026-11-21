/**
 * Which items get "Escolher carros" (BAJAOVRLAY-82), and with which boxes: an item whose
 * graphic declares car groups that a car of the positions can fill (the battle card's
 * two cars), one number box per such group, and "Pela posição" when one of them runs
 * right behind another. An item filled by an event (a template) never gets it: its cars
 * come from the event it shows.
 */
import {
  canCarGroupBeFilledFromThePositions,
  type CarGroup,
  type Graphic,
  type Item,
  readCarGroupsOfManifest,
} from '@bajaovrlay/shared';

import { isItemTakenOnlyThroughAnEvent } from '@/features/events/itemTakenThroughAnEvent';

/** The two cars of a battle: the car ahead, and the group that runs right behind it. */
export type BattleOfCarGroups = { carGroupAhead: CarGroup; carGroupBehind: CarGroup };

/** What "Escolher carros" offers for one item. */
export type CarGroupsToPickQuickly = {
  /** The groups a car of the positions fills, in the manifest's order: one box each. */
  carGroups: CarGroup[];
  /** The graphic's data schema, which every binding written is checked against. */
  dataSchema: unknown;
  /** The battle "Pela posição" sets at once, or undefined for a graphic with none. */
  battle: BattleOfCarGroups | undefined;
};

/** The first group said to run right behind another group of the list, with that group. */
function findBattleAmongCarGroups(carGroups: CarGroup[]): BattleOfCarGroups | undefined {
  for (const carGroupBehind of carGroups) {
    const idOfTheGroupAhead = carGroupBehind.rightBehindGroup;
    if (idOfTheGroupAhead === undefined) {
      continue;
    }
    const carGroupAhead = carGroups.find((candidate) => candidate.id === idOfTheGroupAhead);
    if (carGroupAhead !== undefined) {
      return { carGroupAhead, carGroupBehind };
    }
  }
  return undefined;
}

/**
 * What "Escolher carros" offers for the item, or undefined when it offers nothing there:
 * an event template, an unknown graphic, a graphic whose car groups are missing or
 * refused, or whose every group needs a team record (the team card).
 */
export function findCarGroupsToPickQuickly(
  item: Item,
  graphics: Graphic[],
): CarGroupsToPickQuickly | undefined {
  if (isItemTakenOnlyThroughAnEvent(item)) {
    return undefined;
  }
  const graphic = graphics.find((candidate) => candidate.id === item.graphicId);
  if (graphic === undefined) {
    return undefined;
  }
  const reading = readCarGroupsOfManifest(graphic.manifest);
  if (reading.status !== 'groups') {
    return undefined;
  }
  const carGroups = reading.carGroups.filter(canCarGroupBeFilledFromThePositions);
  if (carGroups.length === 0) {
    return undefined;
  }
  return {
    carGroups,
    dataSchema: graphic.manifest.schema,
    battle: findBattleAmongCarGroups(carGroups),
  };
}
