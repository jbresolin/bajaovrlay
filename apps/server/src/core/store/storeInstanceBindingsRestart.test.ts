/**
 * The bindings of what is on air survive a restart (apps/server)
 *
 * What this module is for:
 *   The instanceBindings slice tells the live refreshes which fields of each instance
 *   read a source. It is saved with the instances (the plainer of the brief's two
 *   choices: rebuilding it from the items would read items that may have changed since
 *   the take), so after a restart a clock bound to the simulator goes on following it.
 *   A preview is dropped at boot, and its entry with it.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - After a restart the entry of the clock on air is there, exactly as before, and
 *     the entry of the preview dropped at boot is gone, in memory and in the database.
 *
 * What these tests deliberately do not cover:
 *   - Writing and removing entries command by command; instanceBindingsAtTheTake.test.ts.
 *   - The refreshes after the restart; the live refresh tests.
 */
import { describe, expect, it } from 'vitest';

import { readAllSliceRows } from '../db/sliceRowStorage.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import {
  buildGoodPollOfTheSimulator,
  firstPollAtMs,
  recordPollsOfTheSimulatorByHand,
} from '../ws/simulatorPolledByHand.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';
import {
  buildGreenFlagEnduroClockData,
  buildLiteralItemFieldsFromData,
  createRaceClockItemOnTheStore,
} from './raceClockItemOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-7';

/** The race clock fields with the flag following the simulator live. */
function buildClockFieldsWithTheFlagBound() {
  return {
    ...buildLiteralItemFieldsFromData(buildGreenFlagEnduroClockData()),
    state: {
      kind: 'binding' as const,
      sourceId: 'simulador-enduro',
      shapeKey: 'session' as const,
      path: 'state',
      isLive: true,
    },
  };
}

describe('a store opened on the file of a store with a bound clock on air and one in preview', () => {
  it('keeps the bindings of the clock on air and drops those of the preview', () => {
    // Arrange: the simulator polled once, a bound clock on air on the clock layer and
    // another bound clock previewed on the fullscreen layer.
    const databasePath = createTemporaryDatabasePath();
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = createStateStore({
      database: firstDatabase,
      logger: createLogger({ level: 'silent' }),
      graphicPackagesFolder,
      readCurrentTime: () => new Date('2027-08-14T14:00:05.000Z'),
    });
    recordPollsOfTheSimulatorByHand(storeBeforeRestart, [
      buildGoodPollOfTheSimulator(6, firstPollAtMs),
    ]);
    const clockOnAirItemId = createRaceClockItemOnTheStore(storeBeforeRestart, {
      label: 'Relógio do enduro — fonte',
      fields: buildClockFieldsWithTheFlagBound(),
    });
    const previewItemId = createRaceClockItemOnTheStore(storeBeforeRestart, {
      label: 'Relógio em tela cheia — fonte',
      layerId: 'fullscreen',
      fields: buildClockFieldsWithTheFlagBound(),
    });
    storeBeforeRestart.applyCommand({ type: 'takeItem', itemId: clockOnAirItemId }, operatorActor);
    storeBeforeRestart.applyCommand(
      { type: 'previewItem', itemId: previewItemId, origin: 'manual' },
      operatorActor,
    );
    const slicesBeforeRestart = storeBeforeRestart.readAllSlices();
    const clockOnAir = slicesBeforeRestart.instances.find(
      (instance) => instance.target === 'program',
    );
    const entryOfTheClockOnAir = slicesBeforeRestart.instanceBindings.find(
      (entry) => entry.instanceId === clockOnAir?.id,
    );

    // Act: restart, opening a new store on the same file.
    firstDatabase.$client.close();
    const secondDatabase = openDatabaseForTests(databasePath);
    const storeAfterRestart = createStateStore({
      database: secondDatabase,
      logger: createLogger({ level: 'silent' }),
      graphicPackagesFolder,
      readCurrentTime: () => new Date('2027-08-14T14:10:00.000Z'),
    });

    // Assert: two entries before; after, the clock on air's alone, in memory and saved.
    expect(slicesBeforeRestart.instanceBindings, 'both clocks had an entry').toHaveLength(2);
    expect(
      storeAfterRestart.readAllSlices().instanceBindings,
      'only the bindings of what was on air may come back',
    ).toEqual([entryOfTheClockOnAir]);
    const storedRow = readAllSliceRows(secondDatabase).find(
      (row) => row.name === 'instanceBindings',
    );
    expect(storedRow?.json, 'the saved row must be rewritten without the preview').toEqual([
      entryOfTheClockOnAir,
    ]);
  });
});
