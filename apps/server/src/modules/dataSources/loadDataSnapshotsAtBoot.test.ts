/**
 * Reading the snapshots back at boot, and splitting the legacy single row (apps/server)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-40 each source's last good snapshot is its own row of the
 *   data_snapshots table, so a poll of one source rewrites only that row. A database
 *   written before kept every snapshot in one `dataSnapshots` row of the slices table.
 *   At boot loadDataSnapshotsAtBoot reads the rows back and, when that old row is still
 *   there, splits it into one row per source, once, and asks for it to be removed.
 *
 * What these tests prove:
 *   - With no old row, the snapshot rows come back in their order and nothing is to be
 *     written or removed.
 *   - An old row of two snapshots becomes two rows to write, in the old row's order,
 *     and the old row is to be removed, with an info line saying so.
 *   - A snapshot in the old row that fails today's schema is dropped with a warning
 *     naming its source; the others are still split out.
 *   - An old row that is not a list at all is dropped whole, with one warning, and still
 *     removed.
 *   - When a database has both (an older server ran on it after this one), the old row's
 *     snapshot wins for its source, a source only the table has keeps its row, and a
 *     table row that fails the schema but is replaced from the old row is not deleted.
 *
 * What these tests deliberately do not cover:
 *   - The real SQLite file and the one boot transaction; dataSnapshotRowsAtBoot.test.ts
 *     boots a store on a database laid out as main wrote it.
 *   - The sources themselves (seeding, stale after a restart); loadDataSourceSlices.test.ts.
 */
import type { DataSnapshot } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { DataSnapshotRow, SliceRow } from '../../core/db/tables.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import { loadDataSnapshotsAtBoot } from './loadDataSnapshotsAtBoot.js';
import {
  buildSimulatorSnapshotReceivedAt,
  momentOfTheCommandMs,
} from './reducers/dataSourceSlices.testSupport.js';

const momentOfTheBoot = '2027-08-14T15:00:00.000Z';
const momentTheRowsWereWritten = '2027-08-14T14:32:05.000Z';
const silentLogger = createLogger({ level: 'silent' });

/** Builds the last good data of Friday's replay: car 42, Baja UFPR, leading after 3 laps. */
function buildFridayReplaySnapshotReceivedAt(receivedAtMs: number): DataSnapshot {
  return {
    sourceId: 'reproducao-sexta',
    receivedAtMs,
    shapes: {
      positions: {
        sessionId: 'treino-2027-sexta',
        updatedAtMs: receivedAtMs,
        entries: [
          {
            position: 1,
            carNumber: 42,
            teamName: 'Baja UFPR',
            schoolName: 'UFPR',
            laps: 3,
            lastLapMs: 278_293,
            status: 'running',
          },
        ],
      },
    },
  };
}

/** Builds the single `dataSnapshots` slice row a server built before BAJAOVRLAY-40 wrote. */
function buildLegacySnapshotsRow(snapshots: unknown): SliceRow {
  return { name: 'dataSnapshots', json: snapshots, updatedAt: momentTheRowsWereWritten };
}

/** Builds one source's row of the data_snapshots table, as this server writes it. */
function buildSnapshotRow(snapshot: unknown, sourceId: string): DataSnapshotRow {
  return { sourceId, json: snapshot, updatedAt: momentTheRowsWereWritten };
}

describe('loadDataSnapshotsAtBoot, on a database with no legacy row', () => {
  it('reads each source row back in its order and has nothing to write or remove', () => {
    // Arrange: the simulator's row first, then the replay's.
    const storedSnapshotRows = [
      buildSnapshotRow(buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs), 'simulador-enduro'),
      buildSnapshotRow(
        buildFridayReplaySnapshotReceivedAt(momentOfTheCommandMs),
        'reproducao-sexta',
      ),
    ];

    // Act: load at boot.
    const loaded = loadDataSnapshotsAtBoot([], storedSnapshotRows, momentOfTheBoot, silentLogger);

    // Assert: both snapshots, in the rows' order; no change to the database.
    expect(loaded.dataSnapshots, 'every stored snapshot must come back in its order').toEqual([
      buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs),
      buildFridayReplaySnapshotReceivedAt(momentOfTheCommandMs),
    ]);
    expect(loaded.dataSnapshotRowChanges, 'rows that read well are left as they are').toEqual({
      rowsToWrite: [],
      sourceIdsToDelete: [],
    });
    expect(loaded.sliceRowNamesToDelete, 'there is no legacy row to remove').toEqual([]);
  });
});

describe('loadDataSnapshotsAtBoot, on a database with the legacy single row', () => {
  it('splits the row into one row per source, in its order, and asks for it to be removed', () => {
    // Arrange: the old row holding the simulator's and the replay's snapshots, no table row.
    const storedSliceRows = [
      buildLegacySnapshotsRow([
        buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs),
        buildFridayReplaySnapshotReceivedAt(momentOfTheCommandMs),
      ]),
    ];
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: load at boot.
    const loaded = loadDataSnapshotsAtBoot(storedSliceRows, [], momentOfTheBoot, logger);

    // Assert: both snapshots in memory, a row each to write, the old row to remove, and a
    // line in the server log saying the split happened.
    expect(loaded.dataSnapshots, 'the split must lose no snapshot').toEqual([
      buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs),
      buildFridayReplaySnapshotReceivedAt(momentOfTheCommandMs),
    ]);
    expect(loaded.dataSnapshotRowChanges, 'each source must get its own row').toEqual({
      rowsToWrite: [
        {
          sourceId: 'simulador-enduro',
          json: buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs),
          updatedAt: momentOfTheBoot,
        },
        {
          sourceId: 'reproducao-sexta',
          json: buildFridayReplaySnapshotReceivedAt(momentOfTheCommandMs),
          updatedAt: momentOfTheBoot,
        },
      ],
      sourceIdsToDelete: [],
    });
    expect(loaded.sliceRowNamesToDelete, 'the legacy row must be removed').toEqual([
      'dataSnapshots',
    ]);
    const infoLines = readRecordedLines().filter((line) => line.level === 'info');
    expect(
      infoLines.map((line) => [line.message, line.split_snapshots]),
      'the server log must say the legacy row was split, and into how many rows',
    ).toEqual([['the legacy dataSnapshots row was split into one row per source and removed', 2]]);
  });

  it("drops, with a warning, a snapshot of the legacy row that fails today's schema", () => {
    // Arrange: the old row; the replay's snapshot was written before lap times had to be
    // positive (car 42's last lap reads 0 ms).
    const replaySnapshotWithAZeroLap = buildFridayReplaySnapshotReceivedAt(momentOfTheCommandMs);
    const firstEntry = replaySnapshotWithAZeroLap.shapes.positions?.entries[0];
    if (firstEntry !== undefined) {
      firstEntry.lastLapMs = 0;
    }
    const storedSliceRows = [
      buildLegacySnapshotsRow([
        buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs),
        replaySnapshotWithAZeroLap,
      ]),
    ];
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: load at boot.
    const loaded = loadDataSnapshotsAtBoot(storedSliceRows, [], momentOfTheBoot, logger);

    // Assert: the simulator's snapshot split out alone; a warning names the replay.
    expect(
      loaded.dataSnapshotRowChanges.rowsToWrite.map((row) => row.sourceId),
      "only the snapshot that passes today's schema gets a row",
    ).toEqual(['simulador-enduro']);
    expect(loaded.sliceRowNamesToDelete, 'the legacy row must still be removed').toEqual([
      'dataSnapshots',
    ]);
    const warnings = readRecordedLines().filter((line) => line.level === 'warn');
    expect(
      warnings.map((line) => [line.message, line.source_id]),
      'the dropped snapshot must leave a warning naming its source',
    ).toEqual([['stored data snapshot dropped: it fails the current schema', 'reproducao-sexta']]);
  });

  it('drops a legacy row that is not a list at all, with one warning, and still removes it', () => {
    // Arrange: an old row holding an object instead of a list (only a bug could write it).
    const storedSliceRows = [buildLegacySnapshotsRow({ 'simulador-enduro': 'sem dados' })];
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: load at boot.
    const loaded = loadDataSnapshotsAtBoot(storedSliceRows, [], momentOfTheBoot, logger);

    // Assert: no snapshot, nothing to write, the row removed, one warning.
    expect(loaded.dataSnapshots, 'an unreadable row gives no snapshot').toEqual([]);
    expect(loaded.dataSnapshotRowChanges.rowsToWrite, 'nothing to split out').toEqual([]);
    expect(loaded.sliceRowNamesToDelete, 'the unreadable row must not stay behind').toEqual([
      'dataSnapshots',
    ]);
    const warnings = readRecordedLines().filter((line) => line.level === 'warn');
    expect(
      warnings.map((line) => line.message),
      'the dropped row must leave exactly one warning',
    ).toEqual(['stored data snapshots dropped: the row is not a list']);
  });

  it("lets the legacy row's snapshot win for its source when the table has one too", () => {
    // Arrange: the table holds an unreadable simulator row and a good replay row; the old
    // row (written later, by an older server) holds the simulator's newer snapshot.
    const newerMomentMs = momentOfTheCommandMs + 60_000;
    const storedSliceRows = [
      buildLegacySnapshotsRow([buildSimulatorSnapshotReceivedAt(newerMomentMs)]),
    ];
    const storedSnapshotRows = [
      buildSnapshotRow({ sourceId: 'simulador-enduro', receivedAtMs: 'ontem' }, 'simulador-enduro'),
      buildSnapshotRow(
        buildFridayReplaySnapshotReceivedAt(momentOfTheCommandMs),
        'reproducao-sexta',
      ),
    ];

    // Act: load at boot.
    const loaded = loadDataSnapshotsAtBoot(
      storedSliceRows,
      storedSnapshotRows,
      momentOfTheBoot,
      silentLogger,
    );

    // Assert: the replay as the table had it, the simulator from the old row, written over
    // its unreadable row (so not deleted), and the old row removed.
    expect(loaded.dataSnapshots, 'the old row must win for the simulator only').toEqual([
      buildFridayReplaySnapshotReceivedAt(momentOfTheCommandMs),
      buildSimulatorSnapshotReceivedAt(newerMomentMs),
    ]);
    expect(
      loaded.dataSnapshotRowChanges,
      "the simulator's row is written over, and nothing is deleted",
    ).toEqual({
      rowsToWrite: [
        {
          sourceId: 'simulador-enduro',
          json: buildSimulatorSnapshotReceivedAt(newerMomentMs),
          updatedAt: momentOfTheBoot,
        },
      ],
      sourceIdsToDelete: [],
    });
    expect(loaded.sliceRowNamesToDelete, 'the legacy row must be removed').toEqual([
      'dataSnapshots',
    ]);
  });
});
