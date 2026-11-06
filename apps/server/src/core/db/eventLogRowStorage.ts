import { count, desc, lt } from 'drizzle-orm';

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

/**
 * Reads up to `limit` rows of the event log below the row id `beforeId` (from the newest
 * when it is undefined), newest first: one batch of the history's older pages
 * (GET /api/v1/event-log, BAJAOVRLAY-30).
 */
export function readEventLogRowsBelow(
  database: ServerDatabase,
  beforeId: number | undefined,
  limit: number,
): EventLogRow[] {
  const query = database.select().from(eventLogRows);
  const rowsBelow = beforeId === undefined ? query : query.where(lt(eventLogRows.id, beforeId));
  return rowsBelow.orderBy(desc(eventLogRows.id)).limit(limit).all();
}
