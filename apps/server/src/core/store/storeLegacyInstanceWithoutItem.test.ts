/**
 * An instance put on air by hand before BAJAOVRLAY-37, after the upgrade (apps/server)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-37 every new instance comes from an item and carries its `itemId`.
 *   A database written before may still hold an instance on program that "Edição rápida"
 *   put on air by hand, with no item behind it. The upgrade must not blank the screen: the
 *   boot keeps that instance on air, the operator can still change it in place and clear
 *   it, and Camadas shows it as "sem item" (with "Salvar como item").
 *
 * What these tests prove (with a real SQLite file, the row written as the older server
 *   left it):
 *   - The boot keeps the instance on program, with no item id invented for it.
 *   - updateInstanceData changes it in place, and no list of changed fields is written,
 *     because there is no item to differ from.
 *   - clearLayer takes it off air.
 *
 * What these tests deliberately do not cover:
 *   - The instance schema accepting it; packages/shared's instanceFieldsChangedOnAir.test.ts.
 *   - How Camadas draws it; the layer panel tests in apps/control.
 */
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import { writeSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';

const legacyClockInstanceId = '6b2f8d40-1e7c-4a93-b5d6-0c9e3f2a7b18';

/** Builds the enduro clock as "Edição rápida" put it on program before BAJAOVRLAY-37: no item. */
function buildClockTakenByHandBeforeItemsWereRequired(): Record<string, unknown> {
  return {
    id: legacyClockInstanceId,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 3_900_000,
      referenceWallClockMs: 1_791_550_800_000,
      running: false,
    },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-16T13:00:00.000Z',
  };
}

/** Opens a store on the given database, the way the server does at boot. */
function openStoreOnDatabase(database: ServerDatabase, graphicPackagesFolder: string) {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder,
  });
}

/**
 * Boots an older database once (so it is seeded), writes the clock taken by hand into
 * its instances row, as the server before BAJAOVRLAY-37 left it, and boots the upgraded
 * store on it.
 */
function bootUpgradedStoreOnDatabaseWithClockTakenByHand() {
  const { database } = openTemporaryDatabase();
  const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
  openStoreOnDatabase(database, graphicPackagesFolder);
  writeSliceRows(database, [
    {
      name: 'instances',
      json: [buildClockTakenByHandBeforeItemsWereRequired()],
      updatedAt: '2026-10-16T13:00:00.000Z',
    },
  ]);
  return openStoreOnDatabase(database, graphicPackagesFolder);
}

describe('an instance taken by hand before items were required', () => {
  it('stays on air after the upgrade, with no item id invented for it', () => {
    // Arrange: nothing beyond the database the older server left.

    // Act: boot the upgraded server on it.
    const store = bootUpgradedStoreOnDatabaseWithClockTakenByHand();

    // Assert: the clock is on program exactly as stored.
    expect(store.readAllSlices().instances, 'the upgrade must not take anything off air').toEqual([
      buildClockTakenByHandBeforeItemsWereRequired(),
    ]);
  });

  it('can still be changed in place, without a list of changed fields', () => {
    // Arrange: the upgraded server, the clock taken by hand on air.
    const store = bootUpgradedStoreOnDatabaseWithClockTakenByHand();

    // Act: the operator puts the yellow flag on it with "Atualizar".
    const outcome = store.applyCommand(
      { type: 'updateInstanceData', instanceId: legacyClockInstanceId, data: { state: 'yellow' } },
      'operador:conexao-3',
    );

    // Assert: accepted; same instance, new flag, and no list: there is no item to differ from.
    const instanceAfter = store
      .readAllSlices()
      .instances.find((instance) => instance.id === legacyClockInstanceId);
    expect(outcome, 'an update of an instance without an item must be accepted').toEqual({
      ok: true,
    });
    expect(instanceAfter?.resolvedData.state, 'the flag on air must be the new one').toBe('yellow');
    expect(instanceAfter?.fieldsChangedOnAir, 'no list may be written without an item').toBe(
      undefined,
    );
  });

  it('can be cleared', () => {
    // Arrange: the upgraded server, the clock taken by hand on air.
    const store = bootUpgradedStoreOnDatabaseWithClockTakenByHand();

    // Act: the operator presses "Limpar" on the clock's row.
    const outcome = store.applyCommand(
      { type: 'clearLayer', layerId: 'clock' },
      'operador:conexao-3',
    );

    // Assert: accepted, and nothing is left on air.
    expect(outcome, 'clearing an instance without an item must be accepted').toEqual({ ok: true });
    expect(store.readAllSlices().instances, 'the clock must be off air').toEqual([]);
  });
});
