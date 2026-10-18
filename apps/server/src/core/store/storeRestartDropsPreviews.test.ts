/**
 * Restarting the server: what is previewed is not kept (apps/server)
 *
 * What this module is for:
 *   A restart must lose nothing the show depends on, so what is on the program output
 *   comes back from the database. A preview is different: it is scaffolding, something
 *   the operator was looking at before deciding. After a restart nobody remembers why it
 *   was there, and a stale preview one "Tomar" away from air is a trap. So the boot
 *   drops every instance of the preview output, and writes the instances row again
 *   without them, so that memory and the database agree from the first moment.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - A store opened on the file of a store that had one clock on air and two previews
 *     holds only the clock on air, exactly as it was.
 *   - The database row is rewritten at that boot without the previews, stamped with the
 *     boot's clock, and the boot says in the log how many it dropped.
 *   - A boot that finds no preview does not rewrite the instances row.
 *
 * What these tests deliberately do not cover:
 *   - Everything else a restart brings back; storeRestart.test.ts covers it.
 *   - A stored instances row that fails its schema, which stops the boot;
 *     loadInitialSlices.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows } from '../db/sliceRowStorage.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';
import {
  buildLiteralItemFieldsFromData,
  createRaceClockItemOnTheStore,
} from './raceClockItemOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-7';

// The race day runs at 14:32:05 UTC; the server is started again at 15:10:00 UTC.
const momentOfTheCommands = '2026-10-09T14:32:05.000Z';
const momentOfTheRestart = '2026-10-09T15:10:00.000Z';

/** Builds the enduro under the given flag, 1:05:00 in and running: all six clock fields. */
function buildEnduroClockDataWithFlag(flagState: string) {
  return {
    sessionName: 'Enduro de Resistência',
    state: flagState,
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: 1_791_550_800_000,
    running: true,
  };
}

/**
 * Prepares three clock items on the store: the green flag and the yellow flag on the
 * clock layer, the red flag on the fullscreen layer. Returns the command that puts each
 * where these tests want it: the green one on air, the other two in Prévia.
 */
function prepareTheThreeFlagClockItems(store: StateStore) {
  const greenFlagItemId = createRaceClockItemOnTheStore(store, {
    label: 'Bandeira verde',
    fields: buildLiteralItemFieldsFromData(buildEnduroClockDataWithFlag('green')),
  });
  const yellowFlagItemId = createRaceClockItemOnTheStore(store, {
    label: 'Bandeira amarela',
    fields: buildLiteralItemFieldsFromData(buildEnduroClockDataWithFlag('yellow')),
  });
  const redFlagItemId = createRaceClockItemOnTheStore(store, {
    label: 'Bandeira vermelha — tela cheia',
    layerId: 'fullscreen',
    fields: buildLiteralItemFieldsFromData(buildEnduroClockDataWithFlag('red')),
  });
  return {
    takeGreenFlagClockOnProgram: { type: 'takeItem', itemId: greenFlagItemId },
    previewYellowFlagClockOnTheClockLayer: { type: 'previewItem', itemId: yellowFlagItemId },
    previewRedFlagClockOnTheFullscreenLayer: { type: 'previewItem', itemId: redFlagItemId },
  };
}

/** Opens a store on the given database whose clock shows the given moment. */
function openStoreOnDatabaseAt(
  database: ServerDatabase,
  graphicPackagesFolder: string,
  momentTheClockShows: string,
  logger: ServerLogger = createLogger({ level: 'silent' }),
) {
  return createStateStore({
    database,
    logger,
    graphicPackagesFolder,
    readCurrentTime: () => new Date(momentTheClockShows),
  });
}

/** Simulates a restart: closes the old connection and opens the same file again. */
function reopenDatabase(database: ServerDatabase, databasePath: string): ServerDatabase {
  database.$client.close();
  return openDatabaseForTests(databasePath);
}

/** Reads the instances row of the database: what it holds and when it was written. */
function readStoredInstancesRow(database: ServerDatabase) {
  return readAllSliceRows(database).find((row) => row.name === 'instances');
}

describe('a store opened on the file of a store that had previews', () => {
  it('holds what was on air and none of the previews, and rewrites the database row to match', () => {
    // Arrange: a store with the green clock item on air, the yellow one previewed on the
    // same layer and the red one previewed on the fullscreen layer.
    const databasePath = createTemporaryDatabasePath();
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabaseAt(
      firstDatabase,
      graphicPackagesFolder,
      momentOfTheCommands,
    );
    const flagClockCommands = prepareTheThreeFlagClockItems(storeBeforeRestart);
    storeBeforeRestart.applyCommand(flagClockCommands.takeGreenFlagClockOnProgram, operatorActor);
    storeBeforeRestart.applyCommand(
      flagClockCommands.previewYellowFlagClockOnTheClockLayer,
      operatorActor,
    );
    storeBeforeRestart.applyCommand(
      flagClockCommands.previewRedFlagClockOnTheFullscreenLayer,
      operatorActor,
    );
    const instancesBeforeRestart = storeBeforeRestart.readAllSlices().instances;
    const clockOnAirBeforeRestart = instancesBeforeRestart.filter(
      (instance) => instance.target === 'program',
    );

    // Act: restart at 15:10, opening a new store on the same file, with its log recorded.
    const { logger, readRecordedLines } = createRecordingLogger();
    const secondDatabase = reopenDatabase(firstDatabase, databasePath);
    const storeAfterRestart = openStoreOnDatabaseAt(
      secondDatabase,
      graphicPackagesFolder,
      momentOfTheRestart,
      logger,
    );

    // Assert: three instances before, only the one on air after, unchanged; the database
    // row holds the same single instance and was written at the restart; the log says so.
    expect(
      instancesBeforeRestart.map((instance) => `${instance.layerId} on ${instance.target}`),
      'before the restart the clock was on air beside two previews',
    ).toEqual(['clock on program', 'clock on preview', 'fullscreen on preview']);
    expect(
      storeAfterRestart.readAllSlices().instances,
      'after the restart only what was on air may be left, exactly as it was',
    ).toEqual(clockOnAirBeforeRestart);
    expect(
      readStoredInstancesRow(secondDatabase),
      'the database row must be rewritten at boot without the previews',
    ).toEqual({ name: 'instances', json: clockOnAirBeforeRestart, updatedAt: momentOfTheRestart });
    const linesAboutDroppedPreviews = readRecordedLines().filter(
      (line) => line.message === 'preview instances dropped at boot',
    );
    expect(linesAboutDroppedPreviews, 'the boot must say how many previews it dropped').toEqual([
      expect.objectContaining({ level: 'info', dropped_preview_instances: 2 }),
    ]);
  });

  it('does not rewrite the instances row when nothing was previewed', () => {
    // Arrange: a store with the three flag items prepared and only the green clock on air.
    const databasePath = createTemporaryDatabasePath();
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabaseAt(
      firstDatabase,
      graphicPackagesFolder,
      momentOfTheCommands,
    );
    const flagClockCommands = prepareTheThreeFlagClockItems(storeBeforeRestart);
    storeBeforeRestart.applyCommand(flagClockCommands.takeGreenFlagClockOnProgram, operatorActor);
    const instancesBeforeRestart = storeBeforeRestart.readAllSlices().instances;

    // Act: restart at 15:10.
    const secondDatabase = reopenDatabase(firstDatabase, databasePath);
    const storeAfterRestart = openStoreOnDatabaseAt(
      secondDatabase,
      graphicPackagesFolder,
      momentOfTheRestart,
    );

    // Assert: the clock is still on air, and the row still carries the time of the take:
    // a boot with nothing to drop writes nothing about the instances.
    expect(storeAfterRestart.readAllSlices().instances, 'the clock must still be on air').toEqual(
      instancesBeforeRestart,
    );
    expect(
      readStoredInstancesRow(secondDatabase)?.updatedAt,
      'the instances row must not be rewritten when no preview was dropped',
    ).toBe(momentOfTheCommands);
  });
});
