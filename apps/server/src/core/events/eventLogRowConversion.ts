import { type EventLogEntry, EventLogEntrySchema } from '@bajaovrlay/shared';

import type { EventLogRow } from '../db/tables.js';

/**
 * Turns an event_log row read from SQLite into a slice entry, checking it against the
 * shared schema so a damaged row is caught at load time, not on a client's screen.
 */
export function convertEventLogRowToEntry(row: EventLogRow): EventLogEntry {
  return EventLogEntrySchema.parse(row);
}
