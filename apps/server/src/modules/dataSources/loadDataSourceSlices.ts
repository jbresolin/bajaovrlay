import {
  type DataSnapshot,
  DataSnapshotSchema,
  type DataSource,
  SlicesSchema,
} from '@bajaovrlay/shared';

import type { SliceRow } from '../../core/db/tables.js';
import type { ServerLogger } from '../../core/logger/createLogger.js';
import { buildSeededDataSources } from './seedDataSources.js';

/** The data sources and snapshots a boot starts with, and the rows it must still save. */
export type DataSourceSlicesAtBoot = {
  dataSources: DataSource[];
  dataSnapshots: DataSnapshot[];
  /**
   * The `dataSources` row when it was seeded or changed at boot, and the `dataSnapshots`
   * row when a snapshot was dropped; nothing otherwise.
   */
  rowsToSaveAtBoot: SliceRow[];
};

/**
 * Reads the `dataSources` and `dataSnapshots` slices from the stored rows.
 * - No source (the row missing, or an empty list): the simulator is seeded, off. So the
 *   "Fontes" page is never empty, also after every source was deleted (decision D12).
 * - A source that was on comes back stale: its snapshot is kept, but it is data from
 *   before the restart, late until the next good poll (rule 4).
 * - No source comes back recording: a restart closes the recordings (decision D13).
 * - A stored snapshot that fails today's schema (written before a rule got stricter) is
 *   dropped with a warning; its source stays, and shows its data at the next good poll.
 *   Snapshots can be thrown away, sources cannot (gate 2 on PR #16).
 * A `dataSources` row that fails its schema throws, which stops the boot. The caller saves
 * `rowsToSaveAtBoot` with its other boot rows, so the database holds what memory holds.
 * The `recordings` slice is not read here: it is never saved.
 */
export function loadOrSeedDataSourceSlices(
  storedRows: SliceRow[],
  updatedAt: string,
  logger: ServerLogger,
): DataSourceSlicesAtBoot {
  const snapshotsRow = storedRows.find((row) => row.name === 'dataSnapshots');
  const storedSnapshots = keepTheStoredSnapshotsThatPassTheSchema(snapshotsRow?.json, logger);
  const dataSnapshots = storedSnapshots.snapshots;
  const snapshotRowsToSave: SliceRow[] = storedSnapshots.isAnySnapshotDropped
    ? [{ name: 'dataSnapshots', json: dataSnapshots, updatedAt }]
    : [];

  const sourcesRow = storedRows.find((row) => row.name === 'dataSources');
  const storedSources = SlicesSchema.shape.dataSources.parse(sourcesRow?.json ?? []);
  if (storedSources.length === 0) {
    const seededSources = buildSeededDataSources();
    const seededLabels = seededSources.map((source) => `"${source.label}"`).join(', ');
    logger.info(`no stored data source; seeded ${seededLabels}, off`);
    return {
      dataSources: seededSources,
      dataSnapshots,
      rowsToSaveAtBoot: [
        { name: 'dataSources', json: seededSources, updatedAt },
        ...snapshotRowsToSave,
      ],
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
    rowsToSaveAtBoot: [...sourceRowsToSave, ...snapshotRowsToSave],
  };
}

/**
 * The stored snapshots that pass today's DataSnapshotSchema, each checked on its own, and
 * whether any was dropped. Each dropped snapshot is logged as a warning naming its
 * source; a row that is not a list at all is dropped whole, with one warning.
 */
function keepTheStoredSnapshotsThatPassTheSchema(
  storedJson: unknown,
  logger: ServerLogger,
): { snapshots: DataSnapshot[]; isAnySnapshotDropped: boolean } {
  if (storedJson === undefined) {
    return { snapshots: [], isAnySnapshotDropped: false };
  }
  if (!Array.isArray(storedJson)) {
    logger.warn('stored data snapshots dropped: the row is not a list');
    return { snapshots: [], isAnySnapshotDropped: true };
  }
  const snapshots: DataSnapshot[] = [];
  for (const storedSnapshot of storedJson as unknown[]) {
    const snapshotCheck = DataSnapshotSchema.safeParse(storedSnapshot);
    if (snapshotCheck.success) {
      snapshots.push(snapshotCheck.data);
      continue;
    }
    const firstBadFieldPath = snapshotCheck.error.issues[0]?.path.join('.') ?? '';
    logger.warn(
      { source_id: readSourceIdOfStoredSnapshot(storedSnapshot), bad_field: firstBadFieldPath },
      'stored data snapshot dropped: it fails the current schema',
    );
  }
  return { snapshots, isAnySnapshotDropped: snapshots.length !== storedJson.length };
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
