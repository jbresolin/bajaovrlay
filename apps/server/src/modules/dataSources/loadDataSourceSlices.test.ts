/**
 * Loading the data-source slices at boot, and seeding the simulator (apps/server)
 *
 * What this module is for:
 *   At boot the store reads the `dataSources` and `dataSnapshots` rows back. A database
 *   with no source gets one, the simulator "Simulador — Enduro", off, so the "Fontes"
 *   page is never empty on a new machine (decision D12: also after every source was
 *   deleted). Every source that was on comes back stale, because its data is from before
 *   the restart (rule 4: kept, and marked), and no source comes back recording: a
 *   restart closes the recordings (D13).
 *
 * What these tests prove:
 *   - A missing `dataSources` row and an empty one both seed the simulator, off, with
 *     the default config and a 2 s interval, and ask for the row to be saved.
 *   - Stored sources and snapshots come back; a source that was on comes back stale and
 *     not recording, and its row is saved again; a source that was off is untouched.
 *   - A stored row that fails its schema throws, which stops the boot.
 *
 * What these tests deliberately do not cover:
 *   - The real restart on a SQLite file; dataSourceRestart.test.ts covers it.
 *   - The `recordings` slice, rebuilt from the recordings folder (commit 5).
 */
import { describe, expect, it } from 'vitest';

import type { SliceRow } from '../../core/db/tables.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { loadOrSeedDataSourceSlices } from './loadDataSourceSlices.js';
import {
  buildEnduroSimulatorTurnedOff,
  buildHealthyEnduroSimulator,
  buildSimulatorSnapshotReceivedAt,
  momentOfTheCommandMs,
} from './reducers/dataSourceSlices.testSupport.js';

const momentOfTheBoot = '2027-08-14T15:00:00.000Z';
const silentLogger = createLogger({ level: 'silent' });

describe('loadOrSeedDataSourceSlices, on a database with no source', () => {
  const noSourceScenarios = [
    // A first boot, or a database written before data sources existed.
    { name: 'seeds the simulator, off, when the row is missing', storedRows: [] },
    // The operator deleted every source: the simulator comes back (D12).
    {
      name: 'seeds the simulator, off, when the row is an empty list',
      storedRows: [{ name: 'dataSources', json: [], updatedAt: '2027-08-14T14:00:00.000Z' }],
    },
  ];

  it.each(noSourceScenarios)('$name', ({ storedRows }) => {
    // Arrange: this row's stored rows (built above).

    // Act: load at boot.
    const loaded = loadOrSeedDataSourceSlices(storedRows, momentOfTheBoot, silentLogger);

    // Assert: the seeded simulator, no snapshot, and the row to save.
    expect(loaded.dataSources, 'the simulator must be seeded, off').toEqual([
      buildEnduroSimulatorTurnedOff(),
    ]);
    expect(loaded.dataSnapshots, 'there is no data yet').toEqual([]);
    expect(loaded.rowsToSaveAtBoot, 'the seed must be saved').toContainEqual({
      name: 'dataSources',
      json: [buildEnduroSimulatorTurnedOff()],
      updatedAt: momentOfTheBoot,
    });
  });
});

describe('loadOrSeedDataSourceSlices, on a database with sources', () => {
  it('brings a source that was on back stale and not recording, with its snapshot', () => {
    // Arrange: the simulator was on, healthy and recording, with its last data.
    const storedRows: SliceRow[] = [
      {
        name: 'dataSources',
        json: [{ ...buildHealthyEnduroSimulator(), isRecording: true }],
        updatedAt: '2027-08-14T14:32:05.000Z',
      },
      {
        name: 'dataSnapshots',
        json: [buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs)],
        updatedAt: '2027-08-14T14:32:05.000Z',
      },
    ];

    // Act: load at boot.
    const loaded = loadOrSeedDataSourceSlices(storedRows, momentOfTheBoot, silentLogger);

    // Assert: stale and not recording, everything else as stored; the snapshot kept.
    const expectedSource = {
      ...buildHealthyEnduroSimulator(),
      isRecording: false,
      status: { ...buildHealthyEnduroSimulator().status, isStale: true },
    };
    expect(loaded.dataSources, 'data from before a restart must read as late').toEqual([
      expectedSource,
    ]);
    expect(loaded.dataSnapshots, 'the last good data must survive (rule 4)').toEqual([
      buildSimulatorSnapshotReceivedAt(momentOfTheCommandMs),
    ]);
    expect(loaded.rowsToSaveAtBoot, 'the stale source must be saved at once').toEqual([
      { name: 'dataSources', json: [expectedSource], updatedAt: momentOfTheBoot },
    ]);
  });

  it('leaves a source that was off untouched and saves nothing', () => {
    // Arrange: the simulator was off.
    const storedRows: SliceRow[] = [
      {
        name: 'dataSources',
        json: [buildEnduroSimulatorTurnedOff()],
        updatedAt: '2027-08-14T14:00:00.000Z',
      },
      { name: 'dataSnapshots', json: [], updatedAt: '2027-08-14T14:00:00.000Z' },
    ];

    // Act: load at boot.
    const loaded = loadOrSeedDataSourceSlices(storedRows, momentOfTheBoot, silentLogger);

    // Assert: as stored; no row to save.
    expect(loaded.dataSources, 'an off source comes back as it was').toEqual([
      buildEnduroSimulatorTurnedOff(),
    ]);
    expect(loaded.rowsToSaveAtBoot, 'nothing changed, nothing to save').toEqual([]);
  });

  it('throws on a stored source that fails its schema, which stops the boot', () => {
    // Arrange: a source whose poll interval is text (only a bug could write that).
    const storedRows: SliceRow[] = [
      {
        name: 'dataSources',
        json: [{ ...buildEnduroSimulatorTurnedOff(), pollIntervalMs: 'dois segundos' }],
        updatedAt: '2027-08-14T14:00:00.000Z',
      },
    ];

    // Act and assert: loading throws.
    expect(
      () => loadOrSeedDataSourceSlices(storedRows, momentOfTheBoot, silentLogger),
      'a damaged row must stop the boot, not be replaced silently',
    ).toThrow();
  });
});
