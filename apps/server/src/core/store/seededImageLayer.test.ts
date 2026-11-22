/**
 * The seeded "Imagem" layer, once per database (apps/server)
 *
 * What this module is for:
 *   The image graphic (BAJAOVRLAY-84, packages/graphics/image) goes on its own layer,
 *   "Imagem", at the top of program (z 60, above the fullscreen boards), so a picture the
 *   operator placed by hand shows where it was put whatever else is on air, and never
 *   replaces another graphic. The layer comes alone: no panel and no item, since there is
 *   no picture to seed. It is seeded once per database, as the channel logo's is:
 *   `seeds_done` remembers it, so a layer the operator deleted later never comes back.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder):
 *   - A new database has the layer at z 60 on program, the last of the stack, not
 *     persistent, and no item on it.
 *   - A database written before it (with outputs) gains it at its next boot, the rows are
 *     written and an info line says so.
 *   - Once the operator deleted it, it does not come back after a restart.
 *   - A database where the operator already has a layer of their own at z 60 gains no
 *     layer, keeps theirs, and logs a warning naming the height.
 *
 * What these tests deliberately do not cover:
 *   - The graphic itself: packages/graphics/image's own tests.
 *   - A database from before outputs, whose missing seeded layers are all caught up at
 *     once: loadInitialSlicesNewSeededLayer.test.ts and outputsAtBoot.test.ts.
 */
import type { Layer } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows, writeSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

const silentLogger = createLogger({ level: 'silent' });

/** 21 November 2026, 09:00 UTC: the boot of the server with the image graphic. */
const bootTime = new Date('2026-11-21T09:00:00.000Z');

/** The "Imagem" layer as the server seeds it. */
const seededImageLayer: Layer = {
  id: 'image',
  outputId: 'program',
  name: 'Imagem',
  zIndex: 60,
  replacePolicy: 'out-then-in',
  persistent: false,
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

/**
 * A database as the server of BAJAOVRLAY-82 left it: booted once, then the image layer and
 * its seed mark taken out again, so it holds what an operator's database held before this
 * update (outputs included, so the old catch-up of missing seeded layers does not run).
 */
function openDatabaseOfAServerBeforeTheImageLayer() {
  const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
  const { database } = openTemporaryDatabase();
  const slicesOfTheOldBoot = loadSlicesAtBoot({ database, graphicPackagesFolder });
  writeSliceRows(database, [
    {
      name: 'layers',
      json: slicesOfTheOldBoot.layers.filter((layer) => layer.id !== 'image'),
      updatedAt: '2026-11-20T22:10:00.000Z',
    },
  ]);
  database.$client.prepare("DELETE FROM seeds_done WHERE name = 'imageLayer'").run();
  return { database, graphicPackagesFolder };
}

describe('a new database', () => {
  it('has the "Imagem" layer at the top of program, and no item on it', () => {
    // Arrange: an empty database.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const { database } = openTemporaryDatabase();

    // Act: boot for the first time.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: the layer as seeded, last of the stack, and nothing seeded on it.
    expect(
      slices.layers.find((layer) => layer.id === 'image'),
      'the layer is seeded at z 60 on program, not persistent',
    ).toEqual(seededImageLayer);
    expect(
      slices.layers.map((layer) => layer.id).slice(-2),
      'the image layer sits above the fullscreen boards, at the top',
    ).toEqual(['fullscreen', 'image']);
    expect(
      slices.items.filter((item) => item.layerId === 'image'),
      'no item is seeded: there is no picture to put in one',
    ).toEqual([]);
  });
});

describe('a database written before the image layer', () => {
  it('gains the layer at its next boot, writes the row and says so', () => {
    // Arrange: the operator's database from before this update, and a logger we can read.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeTheImageLayer();
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot the updated server on it.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: the layer added on top, the row written, and an info line.
    expect(
      slices.layers.find((layer) => layer.id === 'image'),
      'the layer is added exactly as seeded',
    ).toEqual(seededImageLayer);
    expect(
      readAllSliceRows(database).find((row) => row.name === 'layers')?.json,
      'the layers row is written with the new layer',
    ).toEqual(slices.layers);
    expect(readRecordedLines(), 'an info line says what was seeded').toContainEqual(
      expect.objectContaining({ level: 'info', message: 'seeded the "Imagem" layer' }),
    );
  });

  it('does not bring the layer back after the operator deleted it', () => {
    // Arrange: a database that got the layer, then the operator deleted it.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeTheImageLayer();
    const slicesWithTheLayer = loadSlicesAtBoot({ database, graphicPackagesFolder });
    writeSliceRows(database, [
      {
        name: 'layers',
        json: slicesWithTheLayer.layers.filter((layer) => layer.id !== 'image'),
        updatedAt: '2026-11-21T10:00:00.000Z',
      },
    ]);

    // Act: restart.
    const slicesAfterTheRestart = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: it did not come back.
    expect(
      slicesAfterTheRestart.layers.map((layer) => layer.id),
      'a deleted layer is not seeded again',
    ).not.toContain('image');
  });

  it('gains no layer when the operator already has one at z 60, and warns', () => {
    // Arrange: the operator's database with their own layer at 60.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeTheImageLayer();
    const storedLayers = readAllSliceRows(database).find((row) => row.name === 'layers')
      ?.json as Layer[];
    const operatorsLayerAtSixty: Layer = {
      id: 'vinheta-propria',
      outputId: 'program',
      name: 'Vinheta própria',
      zIndex: 60,
      replacePolicy: 'out-then-in',
      persistent: false,
    };
    writeSliceRows(database, [
      {
        name: 'layers',
        json: [...storedLayers, operatorsLayerAtSixty],
        updatedAt: '2026-11-20T22:20:00.000Z',
      },
    ]);
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot the updated server on it.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: the operator's layer keeps 60, no image layer, and one warning naming 60.
    expect(
      slices.layers.find((layer) => layer.zIndex === 60)?.id,
      'the operator’s layer keeps its height',
    ).toBe('vinheta-propria');
    expect(
      slices.layers.map((layer) => layer.id),
      'no image layer is added on top of the operator’s',
    ).not.toContain('image');
    expect(
      readRecordedLines().filter(
        (line) => line.level === 'warn' && line.message.includes('"Imagem"'),
      ),
      'one warning naming the height',
    ).toEqual([expect.objectContaining({ z_index: 60 })]);
  });
});
