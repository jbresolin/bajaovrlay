import type {
  EntityRecordOfType,
  ImportEntitiesCommand,
  UpsertEntityCommand,
} from '@bajaovrlay/shared';

/**
 * The record an upsert writes, with its entity type, for the checks that read any kind of
 * record (the images it names). Written case by case so the compiler checks each record
 * goes with its own type.
 */
export function readRecordOfUpsert(command: UpsertEntityCommand): EntityRecordOfType {
  switch (command.entityType) {
    case 'team':
      return { entityType: 'team', record: command.record };
    case 'person':
      return { entityType: 'person', record: command.record };
    case 'sponsor':
      return { entityType: 'sponsor', record: command.record };
    case 'scheduleSlot':
      return { entityType: 'scheduleSlot', record: command.record };
  }
}

/** The records an import writes, each with its entity type, in the import's order. */
export function listRecordsOfImport(command: ImportEntitiesCommand): EntityRecordOfType[] {
  switch (command.entityType) {
    case 'team':
      return command.records.map((record) => ({ entityType: 'team', record }));
    case 'person':
      return command.records.map((record) => ({ entityType: 'person', record }));
    case 'sponsor':
      return command.records.map((record) => ({ entityType: 'sponsor', record }));
    case 'scheduleSlot':
      return command.records.map((record) => ({ entityType: 'scheduleSlot', record }));
  }
}
