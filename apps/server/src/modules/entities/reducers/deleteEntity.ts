import type { DeleteEntityCommand } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
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
import { removeRecordByKey } from './recordsByKey.js';

/**
 * deleteEntity: removes the record of that key from its slice. Allowed while items
 * reference it (BAJAOVRLAY-19): such an item then refuses its take, naming the record,
 * and what is on air from it keeps its last value (rule 4: nothing on air is blanked).
 * A record that is not there changes nothing and is answered ok.
 */
export function reduceDeleteEntity(
  slices: SlicesChangedByCommands,
  command: DeleteEntityCommand,
): ReducerOutcome {
  switch (command.entityType) {
    case 'team':
      return writeTeams(slices, removeRecordByKey(slices.teams, command.carNumber, readKeyOfTeam));
    case 'person':
      return writePeople(
        slices,
        removeRecordByKey(slices.people, command.personId, readKeyOfPerson),
      );
    case 'sponsor':
      return writeSponsors(
        slices,
        removeRecordByKey(slices.sponsors, command.sponsorId, readKeyOfSponsor),
      );
    case 'scheduleSlot':
      return writeScheduleSlots(
        slices,
        removeRecordByKey(slices.scheduleSlots, command.slotId, readKeyOfScheduleSlot),
      );
  }
}
