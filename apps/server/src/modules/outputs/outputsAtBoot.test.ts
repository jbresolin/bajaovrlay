/**
 * Outputs and layers at boot (apps/server)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-49 every layer belongs to an output, and the `outputs` slice always
 *   holds `program` ("Programa", the output OBS's main browser source draws). A new
 *   database is seeded with program and the nine layers on it. An operator's database
 *   written before outputs existed has a layers row without `outputId` and no outputs
 *   row: it gains program at boot, with every layer it had assigned to it, so the show
 *   looks exactly as it did. From then on the layers are the operator's own, edited on
 *   "Saídas e camadas": a seeded layer the operator deleted does not come back.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder):
 *   - The first boot seeds program and the nine layers on it, and writes both rows.
 *   - A database written before outputs boots with program and every stored layer on it,
 *     names and heights as they were; both rows are written, stamped with this boot, and
 *     an info line counts the layers assigned.
 *   - A database written before outputs and before the notice gains the notice too, on
 *     program: the seed catch-up of BAJAOVRLAY-22 still runs on such a database.
 *   - A database written before outputs whose layers row is damaged (not a list) stops
 *     the boot, rather than booting on a fresh seed as if nothing were wrong (gate 2).
 *   - A database with outputs keeps a layer list without the tower as it is: the seed is
 *     not caught up any more, so a deletion sticks across a restart.
 *   - A PiP output and its frame come back from the database as they were saved.
 *
 * What these tests deliberately do not cover:
 *   - Graphics, instances and the other slices at boot; loadInitialSlices.test.ts.
 *   - The commands that edit outputs and layers; outputAndLayerCommands.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../../core/db/openDatabase.js';
import {
  deleteSliceRows,
  readAllSliceRows,
  writeSliceRows,
} from '../../core/db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../../core/logger/createLogger.js';
import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from '../../core/store/loadInitialSlices.js';

const silentLogger = createLogger({ level: 'silent' });

/** 25 October 2026, 20:00 UTC, the boot after the update: every test's clock. */
const bootTime = new Date('2026-10-25T20:00:00.000Z');

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

/** The ids of the program output's layers, bottom to top, as the seed has them. */
const seededLayerIdsBottomToTop = [
  'bug',
  'channel-logo',
  'bracket-match',
  'ticker',
  'clock',
  'tower',
  'lower-third',
  'notice',
  'fullscreen',
];

/**
 * The layers of a server before outputs: the seed of that time, without the channel logo
 * and the match bug's layer (BAJAOVRLAY-63, BAJAOVRLAY-65), both seeded since.
 */
const layerIdsOfAServerBeforeOutputs = seededLayerIdsBottomToTop.filter(
  (layerId) => layerId !== 'channel-logo' && layerId !== 'bracket-match',
);

/**
 * A database as the server of BAJAOVRLAY-44 left it: booted once, then its layers row
 * written again without any `outputId` and the outputs row removed, so it holds what an
 * operator's database held before this update. The operator had renamed the lower third
 * to "Tarja de piloto", which must survive.
 */
function openDatabaseOfAServerBeforeOutputs(
  layerIdsLeft: string[] = layerIdsOfAServerBeforeOutputs,
) {
  const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
  const { database } = openTemporaryDatabase();
  const slicesOfTheOldBoot = loadSlicesAtBoot({ database, graphicPackagesFolder });
  const layersWithoutAnOutput = slicesOfTheOldBoot.layers
    .filter((layer) => layerIdsLeft.includes(layer.id))
    .map((layer) => ({
      id: layer.id,
      name: layer.id === 'lower-third' ? 'Tarja de piloto' : layer.name,
      zIndex: layer.zIndex,
      replacePolicy: layer.replacePolicy,
      persistent: layer.persistent,
    }));
  writeSliceRows(database, [
    { name: 'layers', json: layersWithoutAnOutput, updatedAt: '2026-10-24T22:10:00.000Z' },
  ]);
  deleteSliceRows(database, ['outputs']);
  return { database, graphicPackagesFolder };
}

describe('the first boot', () => {
  it('seeds the program output and the nine layers on it, and writes both rows', () => {
    // Arrange: an empty database.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const { database } = openTemporaryDatabase();

    // Act: boot for the first time.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: program alone, the nine layers on it, and the same in the database.
    expect(slices.outputs, 'a new database has the program output only').toEqual([
      { outputId: 'program', name: 'Programa', order: 0 },
    ]);
    expect(
      slices.layers.map((layer) => [layer.id, layer.outputId]),
      'every seeded layer belongs to program',
    ).toEqual(seededLayerIdsBottomToTop.map((layerId) => [layerId, 'program']));
    const storedRows = readAllSliceRows(database);
    expect(
      storedRows.find((row) => row.name === 'outputs')?.json,
      'the outputs row is written on the first boot',
    ).toEqual(slices.outputs);
    expect(
      storedRows.find((row) => row.name === 'layers')?.json,
      'the layers row is written with each layer naming program',
    ).toEqual(slices.layers);
  });
});

describe('a database written before outputs existed', () => {
  it('gains program with every stored layer on it, as it was, and says so', () => {
    // Arrange: the operator's database from before this update, and a logger we can read.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeOutputs();
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot the updated server on it.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: program exists, every layer is on it with its name and height kept (the
    // channel logo, seeded since, added at 15), both rows are written with this boot's
    // stamp, and an info line counts the layers.
    expect(slices.outputs, 'the program output is added').toEqual([
      { outputId: 'program', name: 'Programa', order: 0 },
    ]);
    expect(
      slices.layers.map((layer) => [layer.id, layer.outputId, layer.zIndex]),
      'every stored layer is assigned to program at its old height',
    ).toEqual([
      ['bug', 'program', 10],
      ['channel-logo', 'program', 15],
      ['bracket-match', 'program', 17],
      ['ticker', 'program', 20],
      ['clock', 'program', 30],
      ['tower', 'program', 35],
      ['lower-third', 'program', 40],
      ['notice', 'program', 45],
      ['fullscreen', 'program', 50],
    ]);
    expect(
      slices.layers.find((layer) => layer.id === 'lower-third')?.name,
      "the operator's own name for a layer is kept",
    ).toBe('Tarja de piloto');
    const storedRows = readAllSliceRows(database);
    const storedLayersRow = storedRows.find((row) => row.name === 'layers');
    expect(storedLayersRow?.json, 'the layers row is written with the outputs').toEqual(
      slices.layers,
    );
    expect(storedLayersRow?.updatedAt, 'the layers row carries this boot').toBe(
      '2026-10-25T20:00:00.000Z',
    );
    expect(
      storedRows.find((row) => row.name === 'outputs')?.json,
      'the outputs row is written',
    ).toEqual(slices.outputs);
    expect(readRecordedLines(), 'an info line counts the layers assigned').toContainEqual(
      expect.objectContaining({
        level: 'info',
        message: 'stored layers assigned to the program output',
        layers_assigned: 7,
      }),
    );
  });

  it('also gains a seeded layer it lacked, on program, as before outputs', () => {
    // Arrange: a database of a server before the notice (BAJAOVRLAY-44) and before outputs.
    const layerIdsBeforeTheNotice = layerIdsOfAServerBeforeOutputs.filter(
      (layerId) => layerId !== 'notice',
    );
    const { database, graphicPackagesFolder } =
      openDatabaseOfAServerBeforeOutputs(layerIdsBeforeTheNotice);

    // Act: boot the updated server on it.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: the notice is there at 45, on program, exactly as seeded.
    expect(
      slices.layers.find((layer) => layer.id === 'notice'),
      'the seed catch-up still runs on a database from before outputs',
    ).toEqual({
      id: 'notice',
      outputId: 'program',
      name: 'Aviso',
      zIndex: 45,
      replacePolicy: 'out-then-in',
      persistent: false,
    });
  });
});

describe('a damaged layers row', () => {
  it('stops the boot of a database written before outputs', () => {
    // Arrange: a database from before outputs whose layers row holds an object, not a list.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeOutputs();
    writeSliceRows(database, [
      { name: 'layers', json: { broken: true }, updatedAt: '2026-10-24T22:10:00.000Z' },
    ]);

    // Act: boot the updated server on it.
    const bootOnTheDamagedRow = () => loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: the boot stops; running on a fresh seed would hide that the row was lost.
    expect(
      bootOnTheDamagedRow,
      'the boot stops because the layers schema wants a list and finds an object',
    ).toThrow('Invalid input: expected array, received object');
  });
});

describe('a database with outputs', () => {
  it('keeps a deleted seeded layer deleted across a restart', () => {
    // Arrange: a database of this server whose operator deleted the tower on "Saídas e
    // camadas" (written here as the layers row without it).
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const { database } = openTemporaryDatabase();
    const slicesOfTheFirstBoot = loadSlicesAtBoot({ database, graphicPackagesFolder });
    const layersWithoutTheTower = slicesOfTheFirstBoot.layers.filter(
      (layer) => layer.id !== 'tower',
    );
    writeSliceRows(database, [
      { name: 'layers', json: layersWithoutTheTower, updatedAt: '2026-10-25T19:30:00.000Z' },
    ]);

    // Act: restart.
    const slicesAfterTheRestart = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: still no tower, and the layers row is left as the operator saved it.
    expect(
      slicesAfterTheRestart.layers.map((layer) => layer.id),
      'a layer the operator deleted must not come back at boot',
    ).not.toContain('tower');
    expect(
      readAllSliceRows(database).find((row) => row.name === 'layers')?.updatedAt,
      'the layers row is not rewritten',
    ).toBe('2026-10-25T19:30:00.000Z');
  });

  it('brings back a PiP output and its frame as they were saved', () => {
    // Arrange: a database where João added "PiP" and its "Moldura" layer.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const { database } = openTemporaryDatabase();
    const slicesOfTheFirstBoot = loadSlicesAtBoot({ database, graphicPackagesFolder });
    const outputsWithPip = [
      ...slicesOfTheFirstBoot.outputs,
      { outputId: 'pip', name: 'PiP', order: 1 },
    ];
    const layersWithTheFrame = [
      ...slicesOfTheFirstBoot.layers,
      {
        id: 'moldura-pip',
        outputId: 'pip',
        name: 'Moldura',
        zIndex: 10,
        replacePolicy: 'cut',
        persistent: true,
      },
    ];
    writeSliceRows(database, [
      { name: 'outputs', json: outputsWithPip, updatedAt: '2026-10-25T19:30:00.000Z' },
      { name: 'layers', json: layersWithTheFrame, updatedAt: '2026-10-25T19:30:00.000Z' },
    ]);

    // Act: restart.
    const slicesAfterTheRestart = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: both outputs and every layer, the frame on pip, as saved.
    expect(slicesAfterTheRestart.outputs, 'the PiP output is kept').toEqual(outputsWithPip);
    expect(slicesAfterTheRestart.layers, 'the frame is kept on pip').toEqual(layersWithTheFrame);
  });
});
