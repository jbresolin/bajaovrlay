/**
 * Loading or seeding the slices at boot (apps/server)
 *
 * What this module is for:
 *   At boot the store needs its slices. If the database already has them, they are
 *   loaded as they are. If it is empty (the very first boot), it is seeded: the five
 *   fixed layers (bug, ticker, clock, lower-third, fullscreen, bottom to top) and the
 *   race-clock graphic, read from its built OGraf manifest. The race clock is built by
 *   another package (BAJAOVRLAY-10), so a missing manifest is a warning, not a crash.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - An empty database is seeded with the five layers in ascending z-order, each with
 *     its pt-BR name, `out-then-in` swaps, and only the logo and clock persistent;
 *     the seed is saved, not only held in memory.
 *   - A present manifest registers the race clock with it; a missing one logs a
 *     warning and boot carries on without it; a broken one logs an error and carries on.
 *   - A database that already has slices is never seeded again.
 *   - A stored slice that fails its schema stops the boot instead of running on it.
 *
 * What these tests deliberately do not cover:
 *   - Loading back slices changed by commands; storeRestart.test.ts covers it.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, onTestFinished } from 'vitest';

import { readAllSliceRows, writeSliceRows } from '../db/sliceRowStorage.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
  openTemporaryDatabase,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';
import {
  missingRaceClockManifestPath,
  raceClockManifestForTests,
  writeTemporaryRaceClockManifest,
} from './raceClockManifest.testSupport.js';

const silentLogger = createLogger({ level: 'silent' });

/** Writes a manifest file that is not JSON at all, as a half-finished build might leave. */
function writeBrokenRaceClockManifest(): string {
  const temporaryFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-manifesto-quebrado-'));
  onTestFinished(() => rmSync(temporaryFolder, { recursive: true, force: true }));
  const manifestPath = join(temporaryFolder, 'race-clock.ograf.json');
  writeFileSync(manifestPath, '{ "id": "baja-race-clock", ');
  return manifestPath;
}

describe('loadInitialSlices on an empty database', () => {
  it('seeds the five layers in ascending z-order and saves them', () => {
    // Arrange: a brand-new database file.
    const { database } = openTemporaryDatabase();

    // Act: load the slices, as the first boot does.
    const slices = loadInitialSlices({
      database,
      logger: silentLogger,
      raceClockManifestPath: writeTemporaryRaceClockManifest(),
    });

    // Assert: the five layers, bottom to top, and the seed is in the slices table.
    // Every layer swaps out-then-in (two graphics never overlap); only the logo and the
    // clock are persistent, the two things meant to stay on screen all day.
    expect(slices.layers, 'the seeded layers must be exactly these five').toEqual([
      { id: 'bug', name: 'Logo', zIndex: 10, replacePolicy: 'out-then-in', persistent: true },
      {
        id: 'ticker',
        name: 'Letreiro',
        zIndex: 20,
        replacePolicy: 'out-then-in',
        persistent: false,
      },
      { id: 'clock', name: 'Relógio', zIndex: 30, replacePolicy: 'out-then-in', persistent: true },
      {
        id: 'lower-third',
        name: 'Tarja',
        zIndex: 40,
        replacePolicy: 'out-then-in',
        persistent: false,
      },
      {
        id: 'fullscreen',
        name: 'Tela cheia',
        zIndex: 50,
        replacePolicy: 'out-then-in',
        persistent: false,
      },
    ]);
    const zIndexes = slices.layers.map((layer) => layer.zIndex);
    expect(zIndexes, 'each layer must sit above the one before').toEqual(
      [...zIndexes].sort((lower, higher) => lower - higher),
    );
    expect(new Set(zIndexes).size, 'no two layers may share a z-index').toBe(5);
    expect(
      readAllSliceRows(database).map((row) => row.name),
      'the seed must be saved so the next boot loads it instead of seeding again',
    ).toEqual(['layers', 'graphics', 'instances']);
    expect(slices.instances, 'nothing is on air on the first boot').toEqual([]);
  });

  it('registers the race clock from its built manifest when it is present', () => {
    // Arrange: a brand-new database and a built race-clock manifest.
    const { database } = openTemporaryDatabase();

    // Act: load the slices.
    const slices = loadInitialSlices({
      database,
      logger: silentLogger,
      raceClockManifestPath: writeTemporaryRaceClockManifest(),
    });

    // Assert: one graphic, the race clock, carrying the manifest as written.
    expect(slices.graphics, 'the race clock must be registered with its manifest').toEqual([
      {
        id: 'race-clock',
        manifest: raceClockManifestForTests,
        defaultLayerId: 'clock',
        category: 'clock',
        thumbnailUrl: null,
        defaultFields: {},
      },
    ]);
  });

  it('boots without the race clock and logs a warning when its manifest is missing', () => {
    // Arrange: a brand-new database, no race-clock build, and a logger we can read.
    const { database } = openTemporaryDatabase();
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: load the slices.
    const slices = loadInitialSlices({
      database,
      logger,
      raceClockManifestPath: missingRaceClockManifestPath,
    });

    // Assert: no graphics, the layers are still seeded, and a warning names the path.
    expect(slices.graphics, 'no graphic can be registered without a manifest').toEqual([]);
    expect(slices.layers.length, 'the layers are seeded anyway').toBe(5);
    expect(readRecordedLines(), 'a warning must say the manifest was not found').toContainEqual(
      expect.objectContaining({
        level: 'warn',
        message: 'race-clock manifest not found; booting without the race clock graphic',
        manifest_path: missingRaceClockManifestPath,
      }),
    );
  });

  it('boots without the race clock and logs an error when its manifest is broken', () => {
    // Arrange: a brand-new database and a manifest that is cut off half way.
    const { database } = openTemporaryDatabase();
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: load the slices.
    const slices = loadInitialSlices({
      database,
      logger,
      raceClockManifestPath: writeBrokenRaceClockManifest(),
    });

    // Assert: no graphics and an error line; a broken build must not stop the show.
    expect(slices.graphics, 'a broken manifest must not be registered').toEqual([]);
    expect(readRecordedLines(), 'an error must say the manifest is unreadable').toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: 'race-clock manifest is unreadable; booting without the race clock graphic',
      }),
    );
  });
});

describe('loadInitialSlices on a database that already has slices', () => {
  it('loads them as they are and never seeds again', () => {
    // Arrange: a first boot without the race clock build, then a restart with it.
    const databasePath = createTemporaryDatabasePath();
    const firstDatabase = openDatabaseForTests(databasePath);
    loadInitialSlices({
      database: firstDatabase,
      logger: silentLogger,
      raceClockManifestPath: missingRaceClockManifestPath,
    });
    firstDatabase.$client.close();
    const secondDatabase = openDatabaseForTests(databasePath);

    // Act: load the slices on the second boot, with the manifest now present.
    const slicesOnSecondBoot = loadInitialSlices({
      database: secondDatabase,
      logger: silentLogger,
      raceClockManifestPath: writeTemporaryRaceClockManifest(),
    });

    // Assert: still no graphics, because a database with slices is never re-seeded.
    expect(slicesOnSecondBoot.graphics, 'a non-empty database must not be seeded again').toEqual(
      [],
    );
    expect(slicesOnSecondBoot.layers.length, 'the saved layers must load back').toBe(5);
  });

  it('stops the boot when a stored slice fails its schema', () => {
    // Arrange: a seeded database whose instances row was damaged into something that
    // is not a list of instances, as a hand edit or a bad disk might leave it.
    const { database } = openTemporaryDatabase();
    loadInitialSlices({
      database,
      logger: silentLogger,
      raceClockManifestPath: missingRaceClockManifestPath,
    });
    writeSliceRows(database, [
      {
        name: 'instances',
        json: [{ id: 'relogio-no-ar', layerId: 'clock' }],
        updatedAt: '2026-10-09T14:32:05.000Z',
      },
    ]);

    // Act: load the slices, as the next boot does.
    const loadTheDamagedSlices = () =>
      loadInitialSlices({
        database,
        logger: silentLogger,
        raceClockManifestPath: missingRaceClockManifestPath,
      });

    // Assert: the boot stops; running on state it cannot read could put the wrong
    // thing on air.
    expect(loadTheDamagedSlices, 'a damaged slice must stop the boot').toThrow();
  });
});
