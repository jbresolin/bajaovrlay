import {
  type DataSnapshotRowChanges,
  writeDataSnapshotRowChanges,
} from './dataSnapshotRowStorage.js';
import type { ServerDatabase } from './openDatabase.js';
import { writeSeedNamesDone } from './seedDoneRowStorage.js';
import { deleteSliceRows, writeSliceRows } from './sliceRowStorage.js';
import type { SliceRow } from './tables.js';

/** Everything a boot writes: slice rows, slice rows it removes, and snapshot rows. */
export type BootRowWrites = {
  /** The first-boot seed, the refreshed graphics, the sources brought back stale. */
  sliceRowsToWrite: SliceRow[];
  /** Slice rows whose content moved elsewhere: the legacy `dataSnapshots` row, once. */
  sliceRowNamesToDelete: string[];
  /** The snapshots split out of the legacy row, and the rows of dropped snapshots. */
  dataSnapshotRowChanges: DataSnapshotRowChanges;
  /** The one-off seeds this boot applied (`channelLogo`), recorded with the rows they wrote. */
  seedNamesDone: string[];
  /** When this boot ran, as an ISO 8601 timestamp: the seeds' `doneAt`. */
  bootedAt: string;
};

/**
 * Writes what a boot produces in one transaction: all of it or none. So the split of a
 * legacy `dataSnapshots` row can never leave both the old row and the new rows behind,
 * nor neither of them, if the server stops half way through; and a one-off seed is never
 * recorded as done without what it added, nor added twice.
 */
export function writeBootRows(database: ServerDatabase, bootWrites: BootRowWrites): void {
  const writeEverythingTogether = database.$client.transaction(() => {
    writeSliceRows(database, bootWrites.sliceRowsToWrite);
    deleteSliceRows(database, bootWrites.sliceRowNamesToDelete);
    writeDataSnapshotRowChanges(database, bootWrites.dataSnapshotRowChanges);
    writeSeedNamesDone(database, bootWrites.seedNamesDone, bootWrites.bootedAt);
  });
  writeEverythingTogether();
}
