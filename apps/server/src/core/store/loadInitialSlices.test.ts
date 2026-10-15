/**
 * Loading or seeding the slices at boot (apps/server)
 *
 * What this module is for:
 *   At boot the store needs its slices. Layers and instances are the operator's: they
 *   are loaded from the database as they are, or, on the very first boot (an empty
 *   database), seeded with the five fixed layers (bug, ticker, clock, lower-third,
 *   fullscreen, bottom to top) and nothing on air. Graphics are not the operator's: they
 *   describe what is built under packages/graphics, so they are rebuilt from the built
 *   OGraf manifests on every boot and saved. A package that is not built, or whose
 *   manifest is broken, is logged and left out; it never stops the boot.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder, both
 * in temporary folders):
 *   - An empty database is seeded with the five layers in ascending z-order, each with
 *     its pt-BR name, `out-then-in` swaps, and only the logo and clock persistent; the
 *     seed is saved, stamped with the store's clock rather than the machine's.
 *   - A built race clock is registered with its manifest, under its folder name; an
 *     unbuilt one logs a warning, a broken one logs an error, and the boot carries on.
 *   - A second boot registers a race clock built since the first, and saves it, while
 *     the stored layers and instances come back untouched.
 *   - A stored slice that fails its schema, or a damaged database with no layers row,
 *     stops the boot instead of running on it.
 *
 * What these tests deliberately do not cover:
 *   - Loading back slices changed by commands; storeRestart.test.ts covers it.
 *   - Which default layer and category a graphic gets (from its manifest, or fullscreen
 *     with a warning); loadInitialSlicesGraphicPlacement.test.ts covers it. The test
 *     "registers a package nobody has placed yet on the fullscreen layer" moved there.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows, writeSliceRows } from '../db/sliceRowStorage.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
  openTemporaryDatabase,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import {
  buildRaceClockInto,
  createGraphicsFolderWithBrokenRaceClockManifest,
  createGraphicsFolderWithBuiltRaceClock,
  createGraphicsFolderWithUnbuiltRaceClock,
  raceClockManifestForTests,
} from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

const silentLogger = createLogger({ level: 'silent' });

/** 9 October 2026, 08:00:00 UTC: the boot time every test's clock reports. */
const bootTime = new Date('2026-10-09T08:00:00.000Z');

/** The graphic the server registers for the stand-in race-clock build. */
const raceClockGraphic = {
  id: 'race-clock',
  manifest: raceClockManifestForTests,
  defaultLayerId: 'clock',
  category: 'clock',
  thumbnailUrl: null,
  defaultFields: {},
};

/** Boots the slices the way the store does, on a fixed clock. */
function loadSlicesAtBoot(options: {
  database: ServerDatabase;
  graphicPackagesFolder: string;
  logger?: ServerLogger;
}) {
  return loadInitialSlices({
    database: options.database,
    graphicPackagesFolder: options.graphicPackagesFolder,
    logger: options.logger ?? silentLogger,
    readCurrentTime: () => bootTime,
  });
}

/** Builds the race clock on air on program, as a take before a restart left it. */
function createRaceClockOnProgramInstance(): Instance {
  return {
    id: '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: { sessionName: 'Enduro de Resistência', state: 'green' },
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T07:45:00.000Z',
  };
}

describe('loadInitialSlices on an empty database', () => {
  it('seeds the five layers in ascending z-order and saves them, stamped with the store clock', () => {
    // Arrange: a brand-new database file.
    const { database } = openTemporaryDatabase();

    // Act: load the slices, as the first boot does.
    const slices = loadSlicesAtBoot({
      database,
      graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
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
      readAllSliceRows(database).map((row) => [row.name, row.updatedAt]),
      'the seed must be saved, stamped with the store clock, so the next boot loads it',
    ).toEqual([
      ['layers', '2026-10-09T08:00:00.000Z'],
      ['graphics', '2026-10-09T08:00:00.000Z'],
      ['instances', '2026-10-09T08:00:00.000Z'],
      // Seeded too since BAJAOVRLAY-13; loadRundownSlices.test.ts covers what they hold.
      ['rundowns', '2026-10-09T08:00:00.000Z'],
      ['items', '2026-10-09T08:00:00.000Z'],
      // Seeded too since BAJAOVRLAY-16; loadQuickFireAndMacroSlices.test.ts covers them.
      ['quickFirePanels', '2026-10-09T08:00:00.000Z'],
      ['macros', '2026-10-09T08:00:00.000Z'],
    ]);
    expect(slices.instances, 'nothing is on air on the first boot').toEqual([]);
  });

  it('registers the race clock from its built manifest, under its folder name', () => {
    // Arrange: a brand-new database and a graphics folder with the race clock built.
    const { database } = openTemporaryDatabase();

    // Act: load the slices.
    const slices = loadSlicesAtBoot({
      database,
      graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    });

    // Assert: one graphic, the race clock, carrying the manifest as written.
    expect(slices.graphics, 'the race clock must be registered with its manifest').toEqual([
      raceClockGraphic,
    ]);
  });

  it('boots without the race clock and logs a warning when it is not built', () => {
    // Arrange: a brand-new database, the race clock's source but no build, and a logger
    // we can read.
    const { database } = openTemporaryDatabase();
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: load the slices.
    const slices = loadSlicesAtBoot({
      database,
      graphicPackagesFolder: createGraphicsFolderWithUnbuiltRaceClock(),
      logger,
    });

    // Assert: no graphics, the layers are still seeded, and a warning names the package.
    expect(slices.graphics, 'no graphic can be registered without a build').toEqual([]);
    expect(slices.layers.length, 'the layers are seeded anyway').toBe(5);
    expect(readRecordedLines(), 'a warning must say the package is not built').toContainEqual(
      expect.objectContaining({
        level: 'warn',
        message: 'graphic package is not built; skipping it',
        graphic_package: 'race-clock',
      }),
    );
  });

  it('boots without the race clock and logs an error when its manifest is broken', () => {
    // Arrange: a brand-new database and a race-clock manifest cut off half way.
    const { database } = openTemporaryDatabase();
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: load the slices.
    const slices = loadSlicesAtBoot({
      database,
      graphicPackagesFolder: createGraphicsFolderWithBrokenRaceClockManifest(),
      logger,
    });

    // Assert: no graphics and an error line; a broken build must not stop the show.
    expect(slices.graphics, 'a broken manifest must not be registered').toEqual([]);
    expect(readRecordedLines(), 'an error must say the manifest is unreadable').toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: 'graphic manifest is unreadable; skipping it',
      }),
    );
  });
});

describe('loadInitialSlices on a database that already has slices', () => {
  it('registers the race clock on a second boot once its manifest is present', () => {
    // Arrange: a first boot before the race clock was built, then `pnpm build`.
    const databasePath = createTemporaryDatabasePath();
    const graphicPackagesFolder = createGraphicsFolderWithUnbuiltRaceClock();
    const firstDatabase = openDatabaseForTests(databasePath);
    loadSlicesAtBoot({ database: firstDatabase, graphicPackagesFolder });
    firstDatabase.$client.close();
    buildRaceClockInto(graphicPackagesFolder);
    const secondDatabase = openDatabaseForTests(databasePath);

    // Act: load the slices on the second boot.
    const slicesOnSecondBoot = loadSlicesAtBoot({
      database: secondDatabase,
      graphicPackagesFolder,
    });

    // Assert: the race clock is registered and saved, and the layers loaded back.
    expect(slicesOnSecondBoot.graphics, 'the race clock built since must be registered').toEqual([
      raceClockGraphic,
    ]);
    const storedGraphicsRow = readAllSliceRows(secondDatabase).find(
      (row) => row.name === 'graphics',
    );
    expect(storedGraphicsRow?.json, 'the refreshed graphics must be saved').toEqual([
      raceClockGraphic,
    ]);
    expect(slicesOnSecondBoot.layers.length, 'the saved layers must load back').toBe(5);
  });

  it('keeps the stored instances when it refreshes the graphics', () => {
    // Arrange: a database from an earlier boot with the race clock on program.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot({ database, graphicPackagesFolder });
    writeSliceRows(database, [
      {
        name: 'instances',
        json: [createRaceClockOnProgramInstance()],
        updatedAt: '2026-10-09T07:45:00.000Z',
      },
    ]);

    // Act: boot again, which refreshes the graphics.
    const slicesAfterRefresh = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: the race clock is still on program, both in memory and in the table.
    expect(slicesAfterRefresh.instances, 'what was on air must survive the refresh').toEqual([
      createRaceClockOnProgramInstance(),
    ]);
    const storedInstancesRow = readAllSliceRows(database).find((row) => row.name === 'instances');
    expect(storedInstancesRow?.updatedAt, 'the refresh must not rewrite the instances row').toBe(
      '2026-10-09T07:45:00.000Z',
    );
  });

  it('stops the boot when a stored slice fails its schema', () => {
    // Arrange: a seeded database whose instances row was damaged into something that
    // is not a list of instances, as a hand edit or a bad disk might leave it.
    const graphicPackagesFolder = createGraphicsFolderWithUnbuiltRaceClock();
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot({ database, graphicPackagesFolder });
    writeSliceRows(database, [
      {
        name: 'instances',
        json: [{ id: 'relogio-no-ar', layerId: 'clock' }],
        updatedAt: '2026-10-09T14:32:05.000Z',
      },
    ]);

    // Act: load the slices, as the next boot does.
    const loadTheDamagedSlices = () => loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: the boot stops; running on state it cannot read could put the wrong
    // thing on air.
    expect(loadTheDamagedSlices, 'a damaged slice must stop the boot').toThrow();
  });

  it('stops the boot, with a log line, when the slices table has rows but no layers row', () => {
    // Arrange: a database whose layers row was lost while the others remain, and a
    // logger we can read. Booting on would refuse every take for want of layers.
    const graphicPackagesFolder = createGraphicsFolderWithUnbuiltRaceClock();
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot({ database, graphicPackagesFolder });
    database.$client.prepare("DELETE FROM slices WHERE name = 'layers'").run();
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: load the slices, as the next boot does.
    const loadWithoutLayers = () => loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: the boot stops, and an error line says why.
    const expectedMessage =
      'the slices table has rows but no layers row; the database is damaged, so the boot stops';
    expect(loadWithoutLayers, 'a missing layers row must stop the boot').toThrow(expectedMessage);
    expect(readRecordedLines(), 'an error must say the layers row is missing').toContainEqual(
      expect.objectContaining({ level: 'error', message: expectedMessage }),
    );
  });
});
