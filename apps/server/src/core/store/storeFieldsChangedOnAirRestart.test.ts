/**
 * "Alterado no ar" across a server restart (apps/server)
 *
 * What this module is for:
 *   A change made on air is a one-off until the operator saves it into the item, and the
 *   chip "alterado no ar" is what tells the two apart. The list behind the chip
 *   (`fieldsChangedOnAir`) is part of the instance, and the instances on program are
 *   saved to SQLite and loaded back at boot, so a restart in the middle of a race must not
 *   make a change on air look as if it had been saved.
 *
 * What these tests prove (with a real SQLite file):
 *   - An instance of an item changed on air comes back from a restart with its list, and
 *     "Salvar no item" still works on it.
 *
 * What these tests deliberately do not cover:
 *   - Which fields join the list; reducers/updateInstanceDataFieldsChangedOnAir.test.ts.
 *   - Restarts in general; storeRestart.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';
import {
  createRaceClockItemOnTheStore,
  shortcutsPanelHome,
} from './raceClockItemOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-4';

/** Opens a store on the given database, the way the server does at boot. */
function openStoreOnDatabase(database: ServerDatabase, graphicPackagesFolder: string) {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder,
  });
}

describe('fieldsChangedOnAir across a restart', () => {
  it('comes back with the instance, and "Salvar no item" still works on it', () => {
    // Arrange: a store that took a race clock item and changed its title on air.
    const databasePath = createTemporaryDatabasePath();
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabase(firstDatabase, graphicPackagesFolder);
    const itemId = createRaceClockItemOnTheStore(storeBeforeRestart, { home: shortcutsPanelHome });
    storeBeforeRestart.applyCommand({ type: 'takeItem', itemId }, operatorActor);
    const instanceId = storeBeforeRestart.readAllSlices().instances[0]?.id ?? '';
    storeBeforeRestart.applyCommand(
      { type: 'updateInstanceData', instanceId, data: { sessionName: 'Enduro — Relargada' } },
      operatorActor,
    );

    // Act: the server restarts on the same file.
    firstDatabase.$client.close();
    const storeAfterRestart = openStoreOnDatabase(
      openDatabaseForTests(databasePath),
      graphicPackagesFolder,
    );
    const instanceAfterRestart = storeAfterRestart
      .readAllSlices()
      .instances.find((instance) => instance.id === instanceId);
    const saveOutcome = storeAfterRestart.applyCommand(
      { type: 'saveOnAirChangesIntoItem', instanceId, wallClockFields: 'keepMoment' },
      operatorActor,
    );

    // Assert: the list survived, and saving it into the item worked after the restart.
    expect(
      instanceAfterRestart?.fieldsChangedOnAir,
      'a change on air must still be marked after a restart',
    ).toEqual(['sessionName']);
    expect(saveOutcome, '"Salvar no item" must work on the restored instance').toEqual({
      ok: true,
    });
    expect(
      storeAfterRestart.readAllSlices().items.find((item) => item.id === itemId)?.fields
        .sessionName,
      'the item must now give the title changed on air before the restart',
    ).toEqual({ kind: 'literal', value: 'Enduro — Relargada' });
  });
});
