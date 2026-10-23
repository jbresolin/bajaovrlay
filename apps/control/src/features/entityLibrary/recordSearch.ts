import type {
  EntityLibrary,
  EntityType,
  Person,
  ScheduleSlot,
  Sponsor,
  Team,
} from '@bajaovrlay/shared';

import { listRecordsOfTypeInOrder } from './entityOrdering';
import type { AnyEntityRecord } from './entityRecordsOfType';

/**
 * Text as a search compares it: lower case, accents taken off ("Biguá" finds "bigua"),
 * spaces at the ends dropped. An operator on a tablet types fast and without accents.
 */
function writeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** The texts a record is found by: a team by car number, team or school; the rest by name. */
function listSearchableTextsOfRecord(entityType: EntityType, record: AnyEntityRecord): string[] {
  switch (entityType) {
    case 'team': {
      const team = record as Team;
      return [String(team.carNumber), team.teamName, team.schoolName];
    }
    case 'person': {
      const person = record as Person;
      return [person.name, person.role];
    }
    case 'sponsor':
      return [(record as Sponsor).name];
    case 'scheduleSlot':
      return [(record as ScheduleSlot).sessionName];
  }
}

/**
 * The records of one kind that a search finds, in the tab's order: a team whose car
 * number is the typed number, or whose team or school name holds the text; a person,
 * sponsor or slot whose name holds it. An empty search finds every record. What the item
 * editor's "Cadastro" picker lists.
 */
export function listRecordsFoundBySearch(
  library: EntityLibrary,
  entityType: EntityType,
  searchText: string,
): AnyEntityRecord[] {
  const query = writeForSearch(searchText);
  const records = listRecordsOfTypeInOrder(library, entityType);
  if (query === '') {
    return records;
  }
  return records.filter((record) =>
    listSearchableTextsOfRecord(entityType, record).some((text) => {
      const searchableText = writeForSearch(text);
      // A car number is found whole: "4" must not list car 42 before car 4.
      const isCarNumber = entityType === 'team' && /^\d+$/.test(text);
      return isCarNumber ? searchableText === query : searchableText.includes(query);
    }),
  );
}
