import type { UpsertEntityCommand } from '@bajaovrlay/shared';

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
import { readRecordOfUpsert } from './recordsOfCommand.js';

/**
 * upsertEntity: adds the record to its slice, or replaces the one of the same key in its
 * place, leaving every other slice as it was. A record saved exactly as stored changes
 * nothing (the same slices come back, so nothing is saved, logged or broadcast). The
 * refresher then rewrites on-air fields that reference the record (modules/bindings).
 * Refused with MEDIA_NOT_FOUND when the record names an image the media store does not
 * hold, so the library never points at a file that is not on disk.
 */
export function reduceUpsertEntity(
  slices: SlicesChangedByCommands,
  command: UpsertEntityCommand,
): ReducerOutcome {
  const refusal = findRefusalOfImagesNotInTheStore(slices.media, [readRecordOfUpsert(command)]);
  if (refusal !== undefined) {
    return { status: 'refused', error: refusal };
  }
  switch (command.entityType) {
    case 'team':
      return writeTeams(slices, upsertRecordsByKey(slices.teams, [command.record], readKeyOfTeam));
    case 'person':
      return writePeople(
        slices,
        upsertRecordsByKey(slices.people, [command.record], readKeyOfPerson),
      );
    case 'sponsor':
      return writeSponsors(
        slices,
        upsertRecordsByKey(slices.sponsors, [command.record], readKeyOfSponsor),
      );
    case 'scheduleSlot':
      return writeScheduleSlots(
        slices,
        upsertRecordsByKey(slices.scheduleSlots, [command.record], readKeyOfScheduleSlot),
      );
  }
}
