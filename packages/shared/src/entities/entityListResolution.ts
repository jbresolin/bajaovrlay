import { buildMediaUrl } from '../media/mediaId.js';
import type { EntityLibrary } from './entityLibrary.js';
import type { EntityListFieldValue } from './entityListFieldValue.js';
import type { ScheduleSlotListItem, SponsorListItem } from './entityListItems.js';
import { ptBREntities } from './ptBREntities.js';
import type { ScheduleSlot } from './scheduleSlot.js';
import type { Sponsor } from './sponsor.js';
import { findPlaceOfSponsorLevelInRound } from './sponsorLevels.js';

/**
 * What reading one entity list gives, as for an entity reference:
 * - `resolved`: the items, in the list's order;
 * - `valueAbsent`: the list is empty (no sponsor with a logo, no slot); the take leaves an
 *   optional field out and refuses a required one, naming it with this pt-BR sentence.
 * Never `unresolvable`: a kind of record always exists, even with no record in it.
 */
export type EntityListResolution =
  | { status: 'resolved'; value: SponsorListItem[] | ScheduleSlotListItem[] }
  | { status: 'valueAbsent'; problem: string };

/**
 * Reads every record of the list's kind from the library now, as plain items (an image
 * as its /media URL): the sponsors in round order, then by roll weight from high to low,
 * then by name, each sponsor without a logo left out (a roll cannot draw it); the slots
 * by start. Pure: it never throws and reads only what it is given.
 */
export function resolveEntityListAgainstLibrary(
  list: EntityListFieldValue,
  library: EntityLibrary,
): EntityListResolution {
  switch (list.entityType) {
    case 'sponsor': {
      const items = listSponsorItemsInRoundOrder(library.sponsors);
      return items.length === 0
        ? { status: 'valueAbsent', problem: ptBREntities.entityListProblems.noSponsorWithALogo }
        : { status: 'resolved', value: items };
    }
    case 'scheduleSlot': {
      const items = listScheduleSlotItemsByStart(library.scheduleSlots);
      return items.length === 0
        ? { status: 'valueAbsent', problem: ptBREntities.entityListProblems.noScheduleSlot }
        : { status: 'resolved', value: items };
    }
  }
}

/** The sponsors that have a logo, as items, in round order, weight and name. */
function listSponsorItemsInRoundOrder(sponsors: Sponsor[]): SponsorListItem[] {
  const sponsorsWithALogo = sponsors.filter((sponsor) => sponsor.logoMediaId !== undefined);
  const sponsorsInOrder = [...sponsorsWithALogo].sort(compareSponsorsForTheRound);
  return sponsorsInOrder.map((sponsor) => ({
    name: sponsor.name,
    level: sponsor.tier,
    logoUrl: buildMediaUrl(sponsor.logoMediaId ?? ''),
    logoOnLightPlate: sponsor.logoOnLightPlate ?? false,
    rollWeight: sponsor.rollWeight,
  }));
}

/**
 * Round order first, then the heavier weight first, then the name as pt-BR reads it, so
 * "Ângela" sits with the A's (as Cadastros lists them).
 */
function compareSponsorsForTheRound(first: Sponsor, second: Sponsor): number {
  const levelDifference =
    findPlaceOfSponsorLevelInRound(first.tier) - findPlaceOfSponsorLevelInRound(second.tier);
  if (levelDifference !== 0) {
    return levelDifference;
  }
  const weightDifference = second.rollWeight - first.rollWeight;
  if (weightDifference !== 0) {
    return weightDifference;
  }
  return first.name.localeCompare(second.name, 'pt-BR', { sensitivity: 'base' });
}

/**
 * The slots as items, by start; two slots at the same moment keep the order Cadastros
 * holds them in (the sort is stable). An end or a place is written only when the slot has
 * one, so a graphic's data never holds `undefined`.
 */
function listScheduleSlotItemsByStart(slots: ScheduleSlot[]): ScheduleSlotListItem[] {
  const slotsByStart = [...slots].sort((first, second) => first.startsAtMs - second.startsAtMs);
  return slotsByStart.map((slot) => {
    const item: ScheduleSlotListItem = {
      slotId: slot.slotId,
      sessionName: slot.sessionName,
      sessionKind: slot.sessionKind,
      startsAtMs: slot.startsAtMs,
    };
    if (slot.endsAtMs !== undefined) {
      item.endsAtMs = slot.endsAtMs;
    }
    if (slot.place !== undefined) {
      item.place = slot.place;
    }
    return item;
  });
}
