import { sql } from 'drizzle-orm';

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
 * Writes the rows a boot produces (the first-boot seed, the refreshed graphics) in one
 * transaction: all of them or none.
 */
export function writeBootSliceRows(database: ServerDatabase, bootRows: SliceRow[]): void {
  const writeAllBootRows = database.$client.transaction(() => writeSliceRows(database, bootRows));
  writeAllBootRows();
}

/**
 * Saves the slices one command changed, in one transaction, with no event-log row: the
 * one exception to "every command is logged", for a routine data-source poll (decision
 * D11; see createStateStore.ts). Every other command saves through saveCommandOutcome.
 */
export function saveSliceRowsWithoutEventLogRow(
  database: ServerDatabase,
  changedSliceRows: SliceRow[],
): void {
  const writeAllChangedRows = database.$client.transaction(() =>
    writeSliceRows(database, changedSliceRows),
  );
  writeAllChangedRows();
}
