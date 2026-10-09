import { count, desc } from 'drizzle-orm';

import type { ServerDatabase } from './openDatabase.js';
import { type EventLogRow, eventLogRows } from './tables.js';

/**
 * Reads the newest `limit` rows of the event log, returned oldest first so they read
 * in the order the commands ran.
 */
export function readNewestEventLogRows(database: ServerDatabase, limit: number): EventLogRow[] {
  const newestFirst = database
    .select()
    .from(eventLogRows)
    .orderBy(desc(eventLogRows.id))
    .limit(limit)
    .all();
  return newestFirst.reverse();
}

/** Counts every row of the event log, however old. */
export function countEventLogRows(database: ServerDatabase): number {
  const countRow = database.select({ rowCount: count() }).from(eventLogRows).get();
  return countRow?.rowCount ?? 0;
}
