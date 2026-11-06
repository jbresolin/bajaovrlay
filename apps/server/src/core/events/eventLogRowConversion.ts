import { type EventLogEntry, EventLogEntrySchema } from '@bajaovrlay/shared';

import type { EventLogRow } from '../db/tables.js';

/**
 * Turns an event_log row read from SQLite into a slice entry, checking it against the
 * shared schema so a damaged row is caught at load time, not on a client's screen. A row
 * with no details (NULL, as in every row written before gate 2 of PR #44) becomes an entry
 * without the field, as the schema has it.
 */
export function convertEventLogRowToEntry(row: EventLogRow): EventLogEntry {
  const { details, ...rowWithoutDetails } = row;
  if (details === null) {
    return EventLogEntrySchema.parse(rowWithoutDetails);
  }
  return EventLogEntrySchema.parse(row);
}
