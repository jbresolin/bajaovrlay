/**
 * A seeded layer added to a database written before it existed (apps/server)
 *
 * What this module is for:
 *   The fixed layers are seeded once, on the first boot, and loaded back as they are
 *   on every later boot. When a layer joins the seed afterwards (the tower,
 *   BAJAOVRLAY-22, at z-index 35 between the clock and the lower third), an operator's
 *   database written before it has no such layer, and no graphic could ever be placed
 *   there. The notice (BAJAOVRLAY-44, at 45 between the lower third and the fullscreen)
 *   is the second such layer. So the boot adds every seeded layer the stored layers lack,
 *   in its z-order place, writes the layers row again and says so in the log. Since
 *   BAJAOVRLAY-49 this catch-up runs only on a database written before outputs existed
 *   (such as these), where every layer is also put on program; outputsAtBoot.test.ts in
 *   modules/outputs covers that and the database with outputs, whose seed is not caught
 *   up any more.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder, both
 * in temporary folders):
 *   - A database whose layers row has the five layers of a server before the tower
 *     boots with seven, the tower between the clock and the lower third exactly as the
 *     seed defines it (and the notice); the row is rewritten, stamped with this boot, and
 *     an info line names the layers added.
 *   - A database of a server before the notice (six layers) gains the notice alone, at
 *     45, exactly as the seed defines it.
 *   - A database that already has every seeded layer comes back as it was: its layers
 *     row keeps its stamp and nothing is logged about adding a layer.
 *
 * What these tests deliberately do not cover:
 *   - The first-boot seed itself, the graphics and the instances at boot;
 *     loadInitialSlices.test.ts covers them.
 */
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import { deleteSliceRows, readAllSliceRows, writeSliceRows } from '../db/sliceRowStorage.js';
import type { SliceRow } from '../db/tables.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

const silentLogger = createLogger({ level: 'silent' });

/** 9 October 2026, 08:00:00 UTC: the boot time every test's clock reports. */
const bootTime = new Date('2026-10-09T08:00:00.000Z');

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

/**
 * The layers row as a server before BAJAOVRLAY-22 wrote it: the five layers of that
 * time, with no tower and no output (outputs arrived with BAJAOVRLAY-49). What an
 * operator's database holds after updating the server; the tests also remove the
 * outputs row, since such a database has none.
 */
function buildLayersRowOfAServerBeforeTheTower(): SliceRow {
  return {
    name: 'layers',
    json: [
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
    ],
    updatedAt: '2026-10-09T07:45:00.000Z',
  };
}

describe('loadInitialSlices on a database seeded before the tower layer existed', () => {
  it('adds the tower layer between the clock and the lower third, writes the row and logs it', () => {
    // Arrange: a database from an earlier boot whose layers row has the five layers of
    // a server before the tower, and a logger we can read.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot({ database, graphicPackagesFolder });
    writeSliceRows(database, [buildLayersRowOfAServerBeforeTheTower()]);
    deleteSliceRows(database, ['outputs']);
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot again, as the updated server does on the operator's database.
    const slicesAfterTheUpdate = loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: the tower is there, in its place in the z-order, exactly as seeded (the
    // notice too, added since); the layers row now holds the seven, stamped with this
    // boot; and an info line names them.
    expect(
      slicesAfterTheUpdate.layers.map((layer) => layer.id),
      'the tower must sit between the clock and the lower third',
    ).toEqual(['bug', 'ticker', 'clock', 'tower', 'lower-third', 'notice', 'fullscreen']);
    expect(
      slicesAfterTheUpdate.layers.find((layer) => layer.id === 'tower'),
      'the tower must be added exactly as the seed defines it',
    ).toEqual({
      id: 'tower',
      outputId: 'program',
      name: 'Torre',
      zIndex: 35,
      replacePolicy: 'out-then-in',
      persistent: true,
    });
    const storedLayersRow = readAllSliceRows(database).find((row) => row.name === 'layers');
    expect(storedLayersRow?.json, 'the layers row must be written with the tower in it').toEqual(
      slicesAfterTheUpdate.layers,
    );
    expect(storedLayersRow?.updatedAt, 'the rewritten row is stamped with this boot').toBe(
      '2026-10-09T08:00:00.000Z',
    );
    expect(readRecordedLines(), 'an info line must name the layer added').toContainEqual(
      expect.objectContaining({
        level: 'info',
        message: 'seeded layers missing from the stored layers were added',
        added_layer_ids: ['tower', 'notice'],
      }),
    );
  });

  it('adds the notice layer alone to a database of a server before the notice', () => {
    // Arrange: a database whose layers row has the six layers of BAJAOVRLAY-22, the
    // tower among them, and a logger we can read.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot({ database, graphicPackagesFolder });
    const rowBeforeTheTower = buildLayersRowOfAServerBeforeTheTower();
    const layersBeforeTheNotice = [
      ...(rowBeforeTheTower.json as object[]).slice(0, 3),
      { id: 'tower', name: 'Torre', zIndex: 35, replacePolicy: 'out-then-in', persistent: true },
      ...(rowBeforeTheTower.json as object[]).slice(3),
    ];
    writeSliceRows(database, [{ ...rowBeforeTheTower, json: layersBeforeTheNotice }]);
    deleteSliceRows(database, ['outputs']);
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot again, as the server of BAJAOVRLAY-44 does.
    const slicesAfterTheUpdate = loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: the notice at 45, exactly as seeded, and only it named as added.
    expect(
      slicesAfterTheUpdate.layers.find((layer) => layer.id === 'notice'),
      'the notice must be added exactly as the seed defines it',
    ).toEqual({
      id: 'notice',
      outputId: 'program',
      name: 'Aviso',
      zIndex: 45,
      replacePolicy: 'out-then-in',
      persistent: false,
    });
    expect(readRecordedLines(), 'an info line must name the notice alone').toContainEqual(
      expect.objectContaining({
        message: 'seeded layers missing from the stored layers were added',
        added_layer_ids: ['notice'],
      }),
    );
  });

  it('changes nothing on a database that already has every seeded layer', () => {
    // Arrange: a database seeded by this server (every layer, the tower included), its
    // layers row stamped a quarter of an hour before this boot.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const { database } = openTemporaryDatabase();
    const slicesOfTheFirstBoot = loadSlicesAtBoot({ database, graphicPackagesFolder });
    writeSliceRows(database, [
      { name: 'layers', json: slicesOfTheFirstBoot.layers, updatedAt: '2026-10-09T07:45:00.000Z' },
    ]);
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot again.
    const slicesOfTheSecondBoot = loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: the same six layers, the row left as it was, and no line about adding any.
    expect(slicesOfTheSecondBoot.layers, 'the stored layers must come back as they were').toEqual(
      slicesOfTheFirstBoot.layers,
    );
    const storedLayersRow = readAllSliceRows(database).find((row) => row.name === 'layers');
    expect(storedLayersRow?.updatedAt, 'the layers row must not be rewritten').toBe(
      '2026-10-09T07:45:00.000Z',
    );
    expect(
      readRecordedLines().map((line) => line.message),
      'nothing was added, so nothing says so',
    ).not.toContain('seeded layers missing from the stored layers were added');
  });
});
