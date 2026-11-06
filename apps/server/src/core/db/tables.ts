import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * One row per slice (layers, graphics, instances), holding the whole slice as JSON.
 * The eventLog slice is not stored here: event_log is its source of truth.
 */
export const sliceRows = sqliteTable('slices', {
  name: text('name').primaryKey(),
  json: text('json', { mode: 'json' }).$type<unknown>().notNull(),
  /** When the slice was last written, as an ISO 8601 timestamp. */
  updatedAt: text('updatedAt').notNull(),
});

/** A row of the slices table as read back. */
export type SliceRow = typeof sliceRows.$inferSelect;

/**
 * One row per data source holding that source's last good snapshot as JSON (the whole
 * DataSnapshot, sourceId included). The in-memory `dataSnapshots` slice is saved here,
 * not in `slices`, so a poll of one source rewrites only that source's row and deleting
 * a source deletes only its row (BAJAOVRLAY-40). A database written before this table
 * existed kept every snapshot in one `dataSnapshots` row of `slices`; the boot splits
 * that row into these rows once and removes it (modules/dataSources).
 */
export const dataSnapshotRows = sqliteTable('data_snapshots', {
  sourceId: text('sourceId').primaryKey(),
  json: text('json', { mode: 'json' }).$type<unknown>().notNull(),
  /** When the snapshot row was last written, as an ISO 8601 timestamp. */
  updatedAt: text('updatedAt').notNull(),
});

/** A row of the data_snapshots table as read back. */
export type DataSnapshotRow = typeof dataSnapshotRows.$inferSelect;

/**
 * The append-only event log: one row per command that changed something (ok) or was
 * refused (failed). The autoincrement id gives the order commands ran in; ids are never reused, even after a row is deleted.
 */
export const eventLogRows = sqliteTable('event_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** When the command was applied, as an ISO 8601 timestamp. */
  ts: text('ts').notNull(),
  actor: text('actor').notNull(),
  command: text('command').notNull(),
  payload: text('payload', { mode: 'json' }).$type<unknown>().notNull(),
  /** `{"status":"ok"}`, or `{"status":"failed","error":{code, message}}`. */
  result: text('result', { mode: 'json' }).$type<unknown>().notNull(),
  /**
   * What the server knew when it applied the command (EventLogDetails: where a take put its
   * item; gate 2 of PR #44), or NULL when there is nothing to add, as in every older row.
   */
  details: text('details', { mode: 'json' }).$type<unknown>(),
});

/** A row of the event_log table as read back. */
export type EventLogRow = typeof eventLogRows.$inferSelect;

/** A row to insert into event_log; SQLite assigns the id. */
export type NewEventLogRow = typeof eventLogRows.$inferInsert;
