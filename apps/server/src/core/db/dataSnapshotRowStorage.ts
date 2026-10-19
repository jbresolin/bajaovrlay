import { inArray, sql } from 'drizzle-orm';

import type { ServerDatabase } from './openDatabase.js';
import { type DataSnapshotRow, dataSnapshotRows } from './tables.js';

/**
 * What one state change does to the data_snapshots table: the rows of the sources whose
 * snapshot is new or changed (written over the old row), and the sources whose snapshot
 * is gone (their row deleted). Both lists are empty for a change that left every
 * snapshot as it was.
 */
export type DataSnapshotRowChanges = {
  rowsToWrite: DataSnapshotRow[];
  sourceIdsToDelete: string[];
};

/** A change that touches no snapshot row: both lists empty, new lists each time. */
export function buildNoDataSnapshotRowChanges(): DataSnapshotRowChanges {
  return { rowsToWrite: [], sourceIdsToDelete: [] };
}

/**
 * Reads every row of the data_snapshots table, in the order the rows were first written.
 * A row written over keeps its place (SQLite keeps the rowid of an upserted row), which
 * is the order the in-memory list keeps too: a changed snapshot stays where it was.
 */
export function readAllDataSnapshotRows(database: ServerDatabase): DataSnapshotRow[] {
  return database
    .select()
    .from(dataSnapshotRows)
    .orderBy(sql`rowid`)
    .all();
}

/**
 * Applies the changes inside the caller's transaction (or on their own if there is none):
 * each row to write replaces the row of the same source, then each listed source's row is
 * deleted. A source listed in both is a caller bug; it would end up deleted.
 */
export function writeDataSnapshotRowChanges(
  database: ServerDatabase,
  changes: DataSnapshotRowChanges,
): void {
  for (const row of changes.rowsToWrite) {
    database
      .insert(dataSnapshotRows)
      .values(row)
      .onConflictDoUpdate({
        target: dataSnapshotRows.sourceId,
        set: { json: row.json, updatedAt: row.updatedAt },
      })
      .run();
  }
  if (changes.sourceIdsToDelete.length > 0) {
    database
      .delete(dataSnapshotRows)
      .where(inArray(dataSnapshotRows.sourceId, changes.sourceIdsToDelete))
      .run();
  }
}
