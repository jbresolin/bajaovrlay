import { and, count, desc, eq, lt, sql } from 'drizzle-orm';

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

/**
 * Reads the newest row of the event log for `commandName` that was accepted (status ok),
 * however old, or undefined when there is none: "Última cópia" (BAJAOVRLAY-33).
 */
export function readNewestAcceptedEventLogRowOfCommand(
  database: ServerDatabase,
  commandName: string,
): EventLogRow | undefined {
  // A refused claim (an operator sending recordBackup) is logged too; it must not hide
  // the real copy behind it. No index on command: read newest first, SQLite stops at the
  // first match, and a race day's log is some tens of thousands of rows.
  const isAccepted = sql`json_extract(${eventLogRows.result}, '$.status') = 'ok'`;
  return database
    .select()
    .from(eventLogRows)
    .where(and(eq(eventLogRows.command, commandName), isAccepted))
    .orderBy(desc(eventLogRows.id))
    .limit(1)
    .get();
}
