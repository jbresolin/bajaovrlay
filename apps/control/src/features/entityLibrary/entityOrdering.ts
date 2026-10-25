import {
  type EntityLibrary,
  type EntityType,
  findPlaceOfSponsorLevelInRound,
  type Person,
  type ScheduleSlot,
  type Sponsor,
  type Team,
} from '@bajaovrlay/shared';

import type { AnyEntityRecord } from './entityRecordsOfType';

/**
 * The order each tab lists its records in, the table and the CSV export alike: teams by
 * car number, people by name, sponsors by level in round order (Diamante first, Realização
 * last, as on air: sponsorLevels.ts in shared) then name, the schedule by
 * its start ("ordenada pelo início", the brief). Names compare as pt-BR reads them, so
 * "Ângela" sits with the A's.
 */

const namesInPortugueseOrder = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/** The teams by car number. */
export function sortTeams(teams: Team[]): Team[] {
  return [...teams].sort((first, second) => first.carNumber - second.carNumber);
}

/** The people by name. */
export function sortPeople(people: Person[]): Person[] {
  return [...people].sort((first, second) =>
    namesInPortugueseOrder.compare(first.name, second.name),
  );
}

/** The sponsors by level, Diamante first, then by name within a level. */
export function sortSponsors(sponsors: Sponsor[]): Sponsor[] {
  return [...sponsors].sort((first, second) => {
    const levelDifference =
      findPlaceOfSponsorLevelInRound(first.tier) - findPlaceOfSponsorLevelInRound(second.tier);
    if (levelDifference !== 0) {
      return levelDifference;
    }
    return namesInPortugueseOrder.compare(first.name, second.name);
  });
}

/** The schedule by its start, the earliest first. */
export function sortScheduleSlots(slots: ScheduleSlot[]): ScheduleSlot[] {
  return [...slots].sort((first, second) => first.startsAtMs - second.startsAtMs);
}

/** The records of one tab, in the tab's order. */
export function listRecordsOfTypeInOrder(
  library: EntityLibrary,
  entityType: EntityType,
): AnyEntityRecord[] {
  switch (entityType) {
    case 'team':
      return sortTeams(library.teams);
    case 'person':
      return sortPeople(library.people);
    case 'sponsor':
      return sortSponsors(library.sponsors);
    case 'scheduleSlot':
      return sortScheduleSlots(library.scheduleSlots);
  }
}
