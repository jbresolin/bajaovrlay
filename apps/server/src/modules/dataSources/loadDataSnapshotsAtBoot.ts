import { type DataSnapshot, DataSnapshotSchema } from '@bajaovrlay/shared';

import type { DataSnapshotRowChanges } from '../../core/db/dataSnapshotRowStorage.js';
import type { DataSnapshotRow, SliceRow } from '../../core/db/tables.js';
import type { ServerLogger } from '../../core/logger/createLogger.js';

/** The name of the slices-table row that held every snapshot before BAJAOVRLAY-40. */
const legacySnapshotsSliceRowName = 'dataSnapshots';

/** The snapshots a boot starts with, and what it must still write to hold the same. */
export type DataSnapshotsAtBoot = {
  dataSnapshots: DataSnapshot[];
  /** The rows split out of the legacy row, and the rows of the snapshots dropped. */
  dataSnapshotRowChanges: DataSnapshotRowChanges;
  /** `['dataSnapshots']` when the legacy row was there and is to be removed, else empty. */
  sliceRowNamesToDelete: string[];
};

/**
 * Reads the snapshots back at boot, one row per source from the data_snapshots table.
 * - A row that fails today's DataSnapshotSchema (written before a rule got stricter) is
 *   dropped with a warning naming its source, and its row is deleted: snapshots can be
 *   thrown away, sources cannot (gate 2 on PR #16).
 * - A database written before BAJAOVRLAY-40 kept every snapshot in one `dataSnapshots`
 *   row of the slices table. That row is split here, once: each of its snapshots that
 *   passes the schema becomes its source's row, and the old row is removed. The caller
 *   writes both in the boot's one transaction, so a crash leaves the old row or the new
 *   rows, never both and never neither.
 * Deliberate: if a database has both (a server of an older main was run on it after this
 * one), the legacy row's snapshot wins for its source, because only an older server
 * still writes that row, so it is the newer data.
 */
export function loadDataSnapshotsAtBoot(
  storedSliceRows: SliceRow[],
  storedSnapshotRows: DataSnapshotRow[],
  updatedAt: string,
  logger: ServerLogger,
): DataSnapshotsAtBoot {
  const dataSnapshots: DataSnapshot[] = [];
  const sourceIdsToDelete: string[] = [];
  for (const storedRow of storedSnapshotRows) {
    const snapshot = readStoredSnapshotOrWarn(storedRow.json, logger);
    if (snapshot === undefined) {
      sourceIdsToDelete.push(storedRow.sourceId);
    } else {
      dataSnapshots.push(snapshot);
    }
  }

  const legacyRow = storedSliceRows.find((row) => row.name === legacySnapshotsSliceRowName);
  if (legacyRow === undefined) {
    return {
      dataSnapshots,
      dataSnapshotRowChanges: { rowsToWrite: [], sourceIdsToDelete },
      sliceRowNamesToDelete: [],
    };
  }

  const legacySnapshots = readLegacySnapshotsRow(legacyRow.json, logger);
  for (const legacySnapshot of legacySnapshots) {
    putSnapshotInItsSourcePlace(dataSnapshots, legacySnapshot);
  }
  const rowsToWrite: DataSnapshotRow[] = legacySnapshots.map((legacySnapshot) => ({
    sourceId: legacySnapshot.sourceId,
    json: legacySnapshot,
    updatedAt,
  }));
  // A source split out of the legacy row gets a fresh row, so it is no longer deleted.
  const sourceIdsStillToDelete = sourceIdsToDelete.filter((sourceId) => {
    return !legacySnapshots.some((legacySnapshot) => legacySnapshot.sourceId === sourceId);
  });
  logger.info(
    { split_snapshots: rowsToWrite.length },
    'the legacy dataSnapshots row was split into one row per source and removed',
  );
  return {
    dataSnapshots,
    dataSnapshotRowChanges: { rowsToWrite, sourceIdsToDelete: sourceIdsStillToDelete },
    sliceRowNamesToDelete: [legacySnapshotsSliceRowName],
  };
}

/**
 * The snapshots of the legacy row that pass today's schema, each checked on its own (a
 * bad one is warned about and left out). A row that is not a list at all is dropped
 * whole, with one warning.
 */
function readLegacySnapshotsRow(storedJson: unknown, logger: ServerLogger): DataSnapshot[] {
  if (!Array.isArray(storedJson)) {
    logger.warn('stored data snapshots dropped: the row is not a list');
    return [];
  }
  const snapshots: DataSnapshot[] = [];
  for (const storedSnapshot of storedJson as unknown[]) {
    const snapshot = readStoredSnapshotOrWarn(storedSnapshot, logger);
    if (snapshot !== undefined) {
      snapshots.push(snapshot);
    }
  }
  return snapshots;
}

/**
 * One stored snapshot checked against today's DataSnapshotSchema, or undefined after a
 * warning naming its source and the first bad field.
 */
function readStoredSnapshotOrWarn(
  storedSnapshot: unknown,
  logger: ServerLogger,
): DataSnapshot | undefined {
  const snapshotCheck = DataSnapshotSchema.safeParse(storedSnapshot);
  if (snapshotCheck.success) {
    return snapshotCheck.data;
  }
  const firstBadFieldPath = snapshotCheck.error.issues[0]?.path.join('.') ?? '';
  logger.warn(
    { source_id: readSourceIdOfStoredSnapshot(storedSnapshot), bad_field: firstBadFieldPath },
    'stored data snapshot dropped: it fails the current schema',
  );
  return undefined;
}

/** Replaces the snapshot of the same source in the list, or adds it at the end. */
function putSnapshotInItsSourcePlace(snapshots: DataSnapshot[], snapshot: DataSnapshot): void {
  const placeOfItsSource = snapshots.findIndex(
    (candidate) => candidate.sourceId === snapshot.sourceId,
  );
  if (placeOfItsSource === -1) {
    snapshots.push(snapshot);
  } else {
    snapshots[placeOfItsSource] = snapshot;
  }
}

/** The sourceId a stored snapshot names, for the log, or 'unknown' when it names none. */
function readSourceIdOfStoredSnapshot(storedSnapshot: unknown): string {
  const hasSourceId =
    typeof storedSnapshot === 'object' && storedSnapshot !== null && 'sourceId' in storedSnapshot;
  if (hasSourceId && typeof storedSnapshot.sourceId === 'string') {
    return storedSnapshot.sourceId;
  }
  return 'unknown';
}
