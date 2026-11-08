import type { EventLogEntry } from '@bajaovrlay/shared';

import {
  readEventLogRowsBelow,
  readNewestAcceptedEventLogRowOfCommand,
} from '../db/eventLogRowStorage.js';
import type { ServerDatabase } from '../db/openDatabase.js';
import { convertEventLogRowToEntry } from '../events/eventLogRowConversion.js';

/** The store's reads of the event log in the database, which keeps every row. */
export type EventLogReaders = {
  /**
   * Up to `limit` event-log entries below the row id `beforeId` (from the newest when it
   * is undefined), newest first; for the history's older pages (BAJAOVRLAY-30).
   */
  readEventLogEntriesBelow: (beforeId: number | undefined, limit: number) => EventLogEntry[];
  /** The newest accepted entry of one command, however old: "Última cópia" (BAJAOVRLAY-33). */
  readNewestAcceptedEventLogEntryOfCommand: (commandName: string) => EventLogEntry | undefined;
};

/**
 * Builds the store's two reads of the event log: the history's older pages
 * (BAJAOVRLAY-30) and the newest accepted row of one command, "Última cópia"
 * (BAJAOVRLAY-33). Reading only: neither changes anything.
 */
export function createEventLogReaders(database: ServerDatabase): EventLogReaders {
  return {
    readEventLogEntriesBelow: (beforeId, limit) =>
      readEventLogRowsBelow(database, beforeId, limit).map(convertEventLogRowToEntry),
    readNewestAcceptedEventLogEntryOfCommand: (commandName) => {
      const row = readNewestAcceptedEventLogRowOfCommand(database, commandName);
      return row === undefined ? undefined : convertEventLogRowToEntry(row);
    },
  };
}
