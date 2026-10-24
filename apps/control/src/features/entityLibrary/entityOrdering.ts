import type {
  EntityLibrary,
  EntityType,
  Person,
  ScheduleSlot,
  Sponsor,
  SponsorTier,
  Team,
} from '@bajaovrlay/shared';

import type { AnyEntityRecord } from './entityRecordsOfType';

/**
 * The order each tab lists its records in, the table and the CSV export alike: teams by
 * car number, people by name, sponsors by tier (master first) then name, the schedule by
 * its start ("ordenada pelo início", the brief). Names compare as pt-BR reads them, so
 * "Ângela" sits with the A's.
 */

const tierOrder: SponsorTier[] = ['master', 'ouro', 'prata', 'bronze', 'apoio'];
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

/** The sponsors by tier, master first, then by name within a tier. */
export function sortSponsors(sponsors: Sponsor[]): Sponsor[] {
  return [...sponsors].sort((first, second) => {
    const tierDifference = tierOrder.indexOf(first.tier) - tierOrder.indexOf(second.tier);
    if (tierDifference !== 0) {
      return tierDifference;
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
