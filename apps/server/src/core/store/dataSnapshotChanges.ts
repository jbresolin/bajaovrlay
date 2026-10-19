import type { DataSnapshot } from '@bajaovrlay/shared';

import type { DataSnapshotRowChanges } from '../db/dataSnapshotRowStorage.js';

/**
 * One source's snapshot after a state change: the new snapshot, or null when the source
 * no longer has one (it was deleted). It is what the store saves as that source's row and
 * what the hub sends as a `dataSnapshot` message.
 */
export type DataSnapshotChange = { sourceId: string; snapshot: DataSnapshot | null };

/**
 * The snapshots one state change changed, one entry per source: those that are new or
 * replaced (in the order of the new list), then those that are gone (null). A reducer
 * hands back an untouched snapshot as the very same object, so comparing the objects is
 * enough. The same list handed back as it was gives no change at all.
 * What could go wrong: a reducer that rebuilt every snapshot object with equal contents
 * would make every source count as changed, rewriting and resending all of them; no
 * reducer does that (only recordDataSourcePoll and deleteDataSource touch the list).
 */
export function findChangedDataSnapshots(
  snapshotsBefore: DataSnapshot[],
  snapshotsAfter: DataSnapshot[],
): DataSnapshotChange[] {
  if (snapshotsBefore === snapshotsAfter) {
    return [];
  }
  const changes: DataSnapshotChange[] = [];
  for (const snapshotAfter of snapshotsAfter) {
    const snapshotBefore = snapshotsBefore.find(
      (candidate) => candidate.sourceId === snapshotAfter.sourceId,
    );
    if (snapshotBefore !== snapshotAfter) {
      changes.push({ sourceId: snapshotAfter.sourceId, snapshot: snapshotAfter });
    }
  }
  for (const snapshotBefore of snapshotsBefore) {
    const isStillThere = snapshotsAfter.some(
      (candidate) => candidate.sourceId === snapshotBefore.sourceId,
    );
    if (!isStillThere) {
      changes.push({ sourceId: snapshotBefore.sourceId, snapshot: null });
    }
  }
  return changes;
}

/**
 * The data_snapshots rows those changes write: a row for each new or replaced snapshot,
 * a delete for each one that is gone.
 */
export function buildRowChangesOfDataSnapshots(
  changes: DataSnapshotChange[],
  updatedAt: string,
): DataSnapshotRowChanges {
  const rowChanges: DataSnapshotRowChanges = { rowsToWrite: [], sourceIdsToDelete: [] };
  for (const change of changes) {
    if (change.snapshot === null) {
      rowChanges.sourceIdsToDelete.push(change.sourceId);
    } else {
      rowChanges.rowsToWrite.push({
        sourceId: change.sourceId,
        json: change.snapshot,
        updatedAt,
      });
    }
  }
  return rowChanges;
}
