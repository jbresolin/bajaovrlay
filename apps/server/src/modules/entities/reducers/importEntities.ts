import type { ImportEntitiesCommand } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { findRefusalOfImagesNotInTheStore } from '../../media/index.js';
import {
  readKeyOfPerson,
  readKeyOfScheduleSlot,
  readKeyOfSponsor,
  readKeyOfTeam,
  writePeople,
  writeScheduleSlots,
  writeSponsors,
  writeTeams,
} from './entitySliceWrites.js';
import { upsertRecordsByKey } from './recordsByKey.js';
import { listRecordsOfImport } from './recordsOfCommand.js';

/**
 * importEntities: upserts every record of the import into its slice in one change (a
 * record of a key already stored replaces it in its place, a new key is added at the
 * end), and keeps the records of that type the import does not name. The command schema
 * already refused an import naming one key twice, so no record of it is lost to another.
 * Refused as a whole (MEDIA_NOT_FOUND) when any record names an image the store does not
 * hold; an import is never half applied.
 */
export function reduceImportEntities(
  slices: SlicesChangedByCommands,
  command: ImportEntitiesCommand,
): ReducerOutcome {
  const refusal = findRefusalOfImagesNotInTheStore(slices.media, listRecordsOfImport(command));
  if (refusal !== undefined) {
    return { status: 'refused', error: refusal };
  }
  switch (command.entityType) {
    case 'team':
      return writeTeams(slices, upsertRecordsByKey(slices.teams, command.records, readKeyOfTeam));
    case 'person':
      return writePeople(
        slices,
        upsertRecordsByKey(slices.people, command.records, readKeyOfPerson),
      );
    case 'sponsor':
      return writeSponsors(
        slices,
        upsertRecordsByKey(slices.sponsors, command.records, readKeyOfSponsor),
      );
    case 'scheduleSlot':
      return writeScheduleSlots(
        slices,
        upsertRecordsByKey(slices.scheduleSlots, command.records, readKeyOfScheduleSlot),
      );
  }
}
