import { inArray, sql } from 'drizzle-orm';

import type { ServerDatabase } from './openDatabase.js';
import { type SliceRow, sliceRows } from './tables.js';

/** Reads every row of the slices table, in the order they were first written. */
export function readAllSliceRows(database: ServerDatabase): SliceRow[] {
  return database
    .select()
    .from(sliceRows)
    .orderBy(sql`rowid`)
    .all();
}

/**
 * Writes slice rows inside the caller's transaction (or on their own if there is
 * none), replacing a row that already has the same name.
 */
export function writeSliceRows(database: ServerDatabase, rowsToWrite: SliceRow[]): void {
  for (const row of rowsToWrite) {
    database
      .insert(sliceRows)
      .values(row)
      .onConflictDoUpdate({
        target: sliceRows.name,
        set: { json: row.json, updatedAt: row.updatedAt },
      })
      .run();
  }
}

/**
 * Deletes the slice rows of the given names, inside the caller's transaction (or on its
 * own if there is none). Only the boot uses it, to remove a row whose slice moved to its
 * own table (the legacy `dataSnapshots` row, BAJAOVRLAY-40).
 */
export function deleteSliceRows(database: ServerDatabase, sliceNames: string[]): void {
  if (sliceNames.length === 0) {
    return;
  }
  database.delete(sliceRows).where(inArray(sliceRows.name, sliceNames)).run();
}
