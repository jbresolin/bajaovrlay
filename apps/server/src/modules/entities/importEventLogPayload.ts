// What the event log keeps of an import: the type and the keys, not the records.
import type { ImportEntitiesCommand } from '@bajaovrlay/shared';

/** The payload of an importEntities row: the type, how many records and their keys. */
export type ImportEventLogPayload = {
  type: 'importEntities';
  entityType: ImportEntitiesCommand['entityType'];
  recordCount: number;
  recordKeys: Array<number | string>;
};

/**
 * Trims an import for its event-log row: the keys say which records it wrote (car
 * numbers or ids), and the records themselves stay in their slices. A hundred teams in
 * the row would ride along in the eventLog slice that every operator page is sent again
 * after each command, for as long as the row is among the newest 200, as a poll's
 * shapes did before gate 2 on PR #16.
 */
export function trimImportForTheEventLog(command: ImportEntitiesCommand): ImportEventLogPayload {
  const recordKeys = readKeysOfImportedRecords(command);
  return {
    type: 'importEntities',
    entityType: command.entityType,
    recordCount: recordKeys.length,
    recordKeys,
  };
}

/** The key of each record of the import, in its order. */
function readKeysOfImportedRecords(command: ImportEntitiesCommand): Array<number | string> {
  switch (command.entityType) {
    case 'team':
      return command.records.map((team) => team.carNumber);
    case 'person':
      return command.records.map((person) => person.personId);
    case 'sponsor':
      return command.records.map((sponsor) => sponsor.sponsorId);
    case 'scheduleSlot':
      return command.records.map((slot) => slot.slotId);
  }
}

/** The payload of the failed row of an import its schema refused: no record at all. */
export type InvalidImportEventLogPayload = {
  type: 'importEntities';
  entityType: unknown;
  recordCount: number;
};

/**
 * Trims an import the command schema refused for its failed event-log row: its type, the
 * entityType as it was sent (it may be wrong; it is why the import failed) and how many
 * records it carried, never the records. A refused import of a thousand teams would
 * otherwise sit whole in the eventLog slice (gate 2 of PR #23), as a malformed poll's
 * shapes would (trimInvalidPollForTheEventLog).
 */
export function trimInvalidImportForTheEventLog(
  commandInput: Record<string, unknown>,
): InvalidImportEventLogPayload {
  const records = commandInput.records;
  return {
    type: 'importEntities',
    entityType: commandInput.entityType,
    recordCount: Array.isArray(records) ? records.length : 0,
  };
}
