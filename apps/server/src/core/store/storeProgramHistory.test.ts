/**
 * Undo on program through the store, with a real database (apps/server)
 *
 * What this module is for:
 *   The history "Desfazer" reads (programHistory, BAJAOVRLAY-30) must survive a refresh
 *   and a restart, like everything the server owns; and an undo is a command like any
 *   other: one event-log row and one broadcast, however many layers it puts back.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - A store opened again on the same file remembers the same changes, and "Desfazer"
 *     there brings back what was on air before the restart.
 *   - "Desfazer última" after a "Limpar tudo" of three layers writes one event-log row,
 *     signed by the operator, and tells subscribers once.
 *   - A refused undo is logged as failed with its pt-BR reason and changes nothing.
 *   - A restart on a build without a graphic forgets the changes that name it, so undo is
 *     not refused on every press (gate 2 of PR #44).
 *
 * What these tests deliberately do not cover:
 *   - Each rule of what is remembered and what comes back; the tests next to
 *     programHistory/ cover them through the reducer.
 *   - That screens never receive the slice; slicesSentToScreens.ts writes it empty for
 *     them, as it does every slice a screen does not draw.
 */
import type { SliceName } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { countEventLogRows } from '../db/eventLogRowStorage.js';
import type { ServerDatabase } from '../db/openDatabase.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
  openTemporaryDatabase,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import {
  createGraphicsFolderWithBuiltRaceClock,
  createGraphicsFolderWithUnbuiltRaceClock,
} from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';
import {
  buildGreenFlagEnduroClockData,
  buildLiteralItemFieldsFromData,
  createRaceClockItemOnTheStore,
} from './raceClockItemOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-7';

/** Opens a store on the given database, at 14:32:05, with the built race clock. */
function openStoreOnDatabase(database: ServerDatabase, graphicPackagesFolder: string) {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder,
    readCurrentTime: () => new Date('2026-10-09T14:32:05.000Z'),
  });
}

/** The enduro clock under the given flag, as typed item fields. */
function buildEnduroClockFieldsUnderFlag(flagState: string) {
  return buildLiteralItemFieldsFromData({ ...buildGreenFlagEnduroClockData(), state: flagState });
}

describe('the program history across a restart', () => {
  it('remembers the same changes, and "Desfazer" brings back what was on air before', () => {
    // Arrange: the green clock taken, then the yellow one over it, then a restart.
    const databasePath = createTemporaryDatabasePath();
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabase(firstDatabase, graphicPackagesFolder);
    const greenClockItemId = createRaceClockItemOnTheStore(storeBeforeRestart, {
      label: 'Relógio – bandeira verde',
      fields: buildEnduroClockFieldsUnderFlag('green'),
    });
    const yellowClockItemId = createRaceClockItemOnTheStore(storeBeforeRestart, {
      label: 'Relógio – bandeira amarela',
      fields: buildEnduroClockFieldsUnderFlag('yellow'),
    });
    storeBeforeRestart.applyCommand({ type: 'takeItem', itemId: greenClockItemId }, operatorActor);
    storeBeforeRestart.applyCommand({ type: 'takeItem', itemId: yellowClockItemId }, operatorActor);
    const historyBeforeRestart = storeBeforeRestart.readAllSlices().programHistory;
    firstDatabase.$client.close();
    const secondDatabase = openDatabaseForTests(databasePath);
    const storeAfterRestart = openStoreOnDatabase(secondDatabase, graphicPackagesFolder);

    // Act: press "Desfazer" on the "Relógio" row after the restart.
    const outcome = storeAfterRestart.applyCommand(
      { type: 'undoOnLayer', layerId: 'clock' },
      operatorActor,
    );

    // Assert: the history came back whole, and the undo brought back the green clock.
    expect(
      historyBeforeRestart.length,
      'the clock layer must have remembered its changes before the restart',
    ).toBe(1);
    expect(outcome, 'the undo after the restart must be accepted').toEqual({ ok: true });
    const clockOnAir = storeAfterRestart
      .readAllSlices()
      .instances.find((instance) => instance.layerId === 'clock');
    expect(clockOnAir?.itemId, 'the green clock must be back on air after the restart').toBe(
      greenClockItemId,
    );
  });
});

describe('the program history at a restart without a graphic', () => {
  it('forgets the changes that name a graphic gone from the build', () => {
    // Arrange: the green clock taken, then the yellow one over it; then a restart on a
    // graphics folder where the race clock is no longer built.
    const databasePath = createTemporaryDatabasePath();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabase(
      firstDatabase,
      createGraphicsFolderWithBuiltRaceClock(),
    );
    const greenClockItemId = createRaceClockItemOnTheStore(storeBeforeRestart, {
      label: 'Relógio – bandeira verde',
      fields: buildEnduroClockFieldsUnderFlag('green'),
    });
    const yellowClockItemId = createRaceClockItemOnTheStore(storeBeforeRestart, {
      label: 'Relógio – bandeira amarela',
      fields: buildEnduroClockFieldsUnderFlag('yellow'),
    });
    storeBeforeRestart.applyCommand({ type: 'takeItem', itemId: greenClockItemId }, operatorActor);
    storeBeforeRestart.applyCommand({ type: 'takeItem', itemId: yellowClockItemId }, operatorActor);
    firstDatabase.$client.close();
    const secondDatabase = openDatabaseForTests(databasePath);

    // Act: open the store again without the race clock.
    const storeAfterRestart = openStoreOnDatabase(
      secondDatabase,
      createGraphicsFolderWithUnbuiltRaceClock(),
    );

    // Assert: the green clock's change is forgotten; the empty layer before it is kept.
    const clockHistory = storeAfterRestart
      .readAllSlices()
      .programHistory.find((layerHistory) => layerHistory.layerId === 'clock');
    expect(
      clockHistory?.entries.map((entry) => entry.shownBefore.kind),
      'a change naming a graphic no longer listed can never come back, so only "vazio" is left',
    ).toEqual(['empty']);
  });
});

describe('"Desfazer última" through the store', () => {
  it('puts back the three layers of a "Limpar tudo" with one event-log row and one broadcast', () => {
    // Arrange: the clock on "Relógio", "Tela cheia" and "Letreiro", then "Limpar tudo";
    // and only then a list of what subscribers are told.
    const { database } = openTemporaryDatabase();
    const store = openStoreOnDatabase(database, createGraphicsFolderWithBuiltRaceClock());
    for (const layerId of ['clock', 'fullscreen', 'ticker']) {
      const itemId = createRaceClockItemOnTheStore(store, {
        label: `Relógio do enduro (${layerId})`,
        layerId,
      });
      store.applyCommand({ type: 'takeItem', itemId }, operatorActor);
    }
    store.applyCommand({ type: 'clearAll' }, operatorActor);
    const eventLogRowsBefore = countEventLogRows(database);
    const sliceNamesToldToSubscribers: SliceName[][] = [];
    store.subscribeToSliceChanges((changedSliceNames) => {
      sliceNamesToldToSubscribers.push(changedSliceNames);
    });

    // Act: press "Desfazer última".
    const outcome = store.applyCommand({ type: 'undoLastChangeOnProgram' }, operatorActor);

    // Assert: accepted; one row signed by the operator; one notice; three layers on air.
    expect(outcome, '"Desfazer última" must be accepted').toEqual({ ok: true });
    expect(
      countEventLogRows(database) - eventLogRowsBefore,
      'the whole undo must be one event-log row',
    ).toBe(1);
    expect(
      store.readAllSlices().eventLog.at(-1),
      'the row must name the undo and who pressed it',
    ).toMatchObject({ actor: operatorActor, command: 'undoLastChangeOnProgram' });
    expect(sliceNamesToldToSubscribers, 'subscribers must be told once, of all of it').toEqual([
      ['instances', 'programHistory', 'eventLog'],
    ]);
    expect(
      store
        .readAllSlices()
        .instances.map((instance) => instance.layerId)
        .sort(),
      'every layer "Limpar tudo" emptied must be back on air',
    ).toEqual(['clock', 'fullscreen', 'ticker']);
  });

  it('logs a refused undo as failed with its pt-BR reason, and changes nothing', () => {
    // Arrange: a fresh store where nothing was ever taken.
    const { database } = openTemporaryDatabase();
    const store = openStoreOnDatabase(database, createGraphicsFolderWithBuiltRaceClock());
    const instancesBefore = store.readAllSlices().instances;

    // Act: press "Desfazer última".
    const outcome = store.applyCommand({ type: 'undoLastChangeOnProgram' }, operatorActor);

    // Assert: refused, logged as failed, and nothing on air changed.
    const expectedError = {
      code: 'NOTHING_TO_UNDO',
      message: 'Não há nada no ar para desfazer.',
    };
    expect(outcome, 'with nothing remembered the undo must be refused').toEqual({
      ok: false,
      error: expectedError,
    });
    expect(
      store.readAllSlices().eventLog.at(-1)?.result,
      'the refusal must be in the event log with its reason',
    ).toEqual({ status: 'failed', error: expectedError });
    expect(store.readAllSlices().instances, 'nothing on air may change').toBe(instancesBefore);
  });
});
