import { type DataSnapshot, type DataSource, SlicesSchema } from '@bajaovrlay/shared';

import type { DataSnapshotRowChanges } from '../../core/db/dataSnapshotRowStorage.js';
import type { DataSnapshotRow, SliceRow } from '../../core/db/tables.js';
import type { ServerLogger } from '../../core/logger/createLogger.js';
import { loadDataSnapshotsAtBoot } from './loadDataSnapshotsAtBoot.js';
import { buildSeededDataSources } from './seedDataSources.js';

/** The data sources and snapshots a boot starts with, and the rows it must still save. */
export type DataSourceSlicesAtBoot = {
  dataSources: DataSource[];
  dataSnapshots: DataSnapshot[];
  /** The `dataSources` row when it was seeded or changed at boot; nothing otherwise. */
  rowsToSaveAtBoot: SliceRow[];
  /** The snapshot rows split out of a legacy row, and those of dropped snapshots. */
  dataSnapshotRowChangesAtBoot: DataSnapshotRowChanges;
  /** `['dataSnapshots']` when a legacy row of every snapshot is to be removed. */
  sliceRowNamesToDeleteAtBoot: string[];
};

/**
 * Reads the `dataSources` slice from the stored rows and the `dataSnapshots` slice from
 * the snapshot rows, one per source (loadDataSnapshotsAtBoot.ts, which also splits the
 * one `dataSnapshots` row a database written before BAJAOVRLAY-40 has).
 * - No source (the row missing, or an empty list): the simulator is seeded, off. So the
 *   "Fontes" page is never empty, also after every source was deleted (decision D12).
 * - A source that was on comes back stale: its snapshot is kept, but it is data from
 *   before the restart, late until the next good poll (rule 4).
 * - No source comes back recording: a restart closes the recordings (decision D13).
 * - A stored snapshot that fails today's schema (written before a rule got stricter) is
 *   dropped with a warning; its source stays, and shows its data at the next good poll.
 *   Snapshots can be thrown away, sources cannot (gate 2 on PR #16).
 * A `dataSources` row that fails its schema throws, which stops the boot. The caller saves
 * `rowsToSaveAtBoot` and the snapshot changes with its other boot rows, in one
 * transaction, so the database holds what memory holds.
 * The `recordings` slice is not read here: it is never saved.
 */
export function loadOrSeedDataSourceSlices(
  storedRows: SliceRow[],
  storedSnapshotRows: DataSnapshotRow[],
  updatedAt: string,
  logger: ServerLogger,
): DataSourceSlicesAtBoot {
  const snapshotsAtBoot = loadDataSnapshotsAtBoot(
    storedRows,
    storedSnapshotRows,
    updatedAt,
    logger,
  );
  const dataSnapshots: DataSnapshot[] = snapshotsAtBoot.dataSnapshots;

  const sourcesRow = storedRows.find((row) => row.name === 'dataSources');
  const storedSources = SlicesSchema.shape.dataSources.parse(sourcesRow?.json ?? []);
  if (storedSources.length === 0) {
    const seededSources = buildSeededDataSources();
    const seededLabels = seededSources.map((source) => `"${source.label}"`).join(', ');
    logger.info(`no stored data source; seeded ${seededLabels}, off`);
    return {
      dataSources: seededSources,
      dataSnapshots,
      rowsToSaveAtBoot: [{ name: 'dataSources', json: seededSources, updatedAt }],
      dataSnapshotRowChangesAtBoot: snapshotsAtBoot.dataSnapshotRowChanges,
      sliceRowNamesToDeleteAtBoot: snapshotsAtBoot.sliceRowNamesToDelete,
    };
  }

  const dataSources = storedSources.map(bringSourceBackAfterRestart);
  const isAnySourceChanged = dataSources.some((source, index) => source !== storedSources[index]);
  const sourceRowsToSave: SliceRow[] = isAnySourceChanged
    ? [{ name: 'dataSources', json: dataSources, updatedAt }]
    : [];
  return {
    dataSources,
    dataSnapshots,
    rowsToSaveAtBoot: sourceRowsToSave,
    dataSnapshotRowChangesAtBoot: snapshotsAtBoot.dataSnapshotRowChanges,
    sliceRowNamesToDeleteAtBoot: snapshotsAtBoot.sliceRowNamesToDelete,
  };
}

/**
 * One source as it comes back after a restart: on → stale; recording → not recording.
 * A source that needs neither is handed back as the very same object.
 */
function bringSourceBackAfterRestart(storedSource: DataSource): DataSource {
  const isStaleAfterTheRestart = storedSource.isEnabled || storedSource.status.isStale;
  const isUnchanged =
    storedSource.status.isStale === isStaleAfterTheRestart && !storedSource.isRecording;
  if (isUnchanged) {
    return storedSource;
  }
  return {
    ...storedSource,
    isRecording: false,
    status: { ...storedSource.status, isStale: isStaleAfterTheRestart },
  };
}
