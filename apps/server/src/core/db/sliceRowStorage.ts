import { sql } from 'drizzle-orm';

import type { ServerDatabase } from './openDatabase.js';
import { type SliceRow, sliceRows } from './tables.js';

/** Reads every row of the slices table, in the order they were first written. */
export function readAllSliceRows(database: ServerDatabase): SliceRow[] {
  return database.select().from(sliceRows).orderBy(sql`rowid`).all();
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

/** Writes the seed slices of a first boot in one transaction: all of them or none. */
export function writeSeedSliceRows(database: ServerDatabase, seedRows: SliceRow[]): void {
  const writeAllSeedRows = database.$client.transaction(() => writeSliceRows(database, seedRows));
  writeAllSeedRows();
}
