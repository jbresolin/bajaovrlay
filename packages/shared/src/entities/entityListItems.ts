import type { EntityListType } from './entityListFieldValue.js';
import type { SponsorLevel } from './sponsorLevels.js';

/**
 * One sponsor of an entity list, as a graphic draws it (the sponsor roll, the
 * intermission's sponsor line). Every key is always there: a sponsor without a logo is
 * left out of the list, and a plate choice left unsaid reads as no.
 */
export type SponsorListItem = {
  name: string;
  level: SponsorLevel;
  /** The logo's address on the server, /media/<mediaId>, drawn with <img> only. */
  logoUrl: string;
  logoOnLightPlate: boolean;
  rollWeight: number;
};

/**
 * One slot of the schedule in an entity list, as the sessions board draws it. No status:
 * it changes with the clock, and nothing refreshes the air when only time passes, so the
 * graphic works it out itself (findStatusOfScheduleSlot).
 */
export type ScheduleSlotListItem = {
  slotId: string;
  sessionName: string;
  sessionKind: string;
  startsAtMs: number;
  /** Only when the slot has an end. */
  endsAtMs?: number;
  /** Only when the slot has a place. */
  place?: string;
};

/** One key of the items of an entity list, and whether every item carries it. */
export type EntityListItemKey = { itemKey: string; isCarriedByEveryItem: boolean };

/**
 * The keys of each kind of list's items, listed by hand in the order entityListResolution.ts
 * writes them (as entityAttributes.ts lists a record's attributes). A list fits a graphic's
 * array field only when its items always carry every key the field's `items.required`
 * names (entityListFitsGraphicField.ts); entityListFitsGraphicField.test.ts checks these
 * against what the resolution really gives.
 */
const keysOfTheItemsOfEachList: Record<EntityListType, EntityListItemKey[]> = {
  sponsor: [
    { itemKey: 'name', isCarriedByEveryItem: true },
    { itemKey: 'level', isCarriedByEveryItem: true },
    { itemKey: 'logoUrl', isCarriedByEveryItem: true },
    { itemKey: 'logoOnLightPlate', isCarriedByEveryItem: true },
    { itemKey: 'rollWeight', isCarriedByEveryItem: true },
  ],
  scheduleSlot: [
    { itemKey: 'slotId', isCarriedByEveryItem: true },
    { itemKey: 'sessionName', isCarriedByEveryItem: true },
    { itemKey: 'sessionKind', isCarriedByEveryItem: true },
    { itemKey: 'startsAtMs', isCarriedByEveryItem: true },
    { itemKey: 'endsAtMs', isCarriedByEveryItem: false },
    { itemKey: 'place', isCarriedByEveryItem: false },
  ],
};

/** Every key the items of one kind of list may have, in the order they are written. */
export function listKeysOfTheItemsOfEntityList(listType: EntityListType): EntityListItemKey[] {
  return keysOfTheItemsOfEachList[listType];
}

/** The keys every item of one kind of list always carries. */
export function listKeysEveryItemOfEntityListCarries(listType: EntityListType): string[] {
  return keysOfTheItemsOfEachList[listType]
    .filter((key) => key.isCarriedByEveryItem)
    .map((key) => key.itemKey);
}
