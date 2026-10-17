/**
 * "Tomar tudo" and the "will be cleared" markers, through the store (apps/server)
 *
 * What this module is for:
 *   "Tomar tudo" (takeAllPreviews) must reach OBS as one change, never half a set: one
 *   state change, one event-log row, one broadcast. The "will be cleared" markers
 *   (`previewClearedLayerIds`) are scaffolding like the previews themselves: they live in
 *   the server's memory only, are never written to the database, and every boot starts
 *   with none.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - takeAllPreviews of two previews and a marker writes exactly one event-log row and
 *     tells subscribers once, naming the instances, the markers and the event log; the
 *     database's instances row is what memory holds.
 *   - previewClearLayer is logged and broadcast like any change, but the slices table
 *     never gets a previewClearedLayerIds row.
 *   - A store opened again on the same file starts with no marker, and a stray
 *     previewClearedLayerIds row (written by hand, as an older bug might have) is not
 *     read: the boot still starts with none.
 *   - An item with an auto-out taken by "Tomar tudo" starts its wait at that take, as
 *     takePreview does.
 *
 * What these tests deliberately do not cover:
 *   - Each rule of takeAllPreviews and of the markers; the reducer tests cover them.
 *   - The previews dropped at boot; storeRestartDropsPreviews.test.ts covers them.
 */
import type { SliceName } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { countEventLogRows } from '../db/eventLogRowStorage.js';
import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows, writeSliceRows } from '../db/sliceRowStorage.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
  openTemporaryDatabase,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { startAutoOutScheduler } from './autoOut.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';
import {
  buildLiteralItemFieldsFromData,
  createRaceClockItemOnTheStore,
} from './raceClockItemOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-7';
const momentOfTheCommands = '2026-10-09T14:32:05.000Z';

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

// The flag names as the operator reads them on an item's label.
const flagNamesInPortuguese: Record<string, string> = {
  green: 'verde',
  yellow: 'amarela',
  red: 'vermelha',
};

/**
 * Prepares a race clock item under the given flag on the given layer, then puts it on
 * the given output: takeItem for program, previewItem for preview.
 */
function putAClockItemOnTheOutput(
  store: StateStore,
  layerId: string,
  flagState: string,
  target: 'program' | 'preview',
) {
  const clockItemId = createRaceClockItemOnTheStore(store, {
    label: `Bandeira ${flagNamesInPortuguese[flagState] ?? flagState} (${layerId})`,
    layerId,
    fields: buildLiteralItemFieldsFromData(buildEnduroClockDataWithFlag(flagState)),
  });
  const commandType = target === 'program' ? 'takeItem' : 'previewItem';
  store.applyCommand({ type: commandType, itemId: clockItemId }, operatorActor);
}

/** Opens a store on the given database, at 14:32:05, with the built race clock. */
function openStoreOnDatabase(database: ServerDatabase, graphicPackagesFolder: string) {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder,
    readCurrentTime: () => new Date(momentOfTheCommands),
  });
}

describe('takeAllPreviews through the store', () => {
  it('writes one event-log row and tells subscribers once for the whole set', () => {
    // Arrange: the green clock item on air on "Relógio" and a red one on "Tela cheia"; in
    // Prévia, a yellow clock item on "Relógio" and a green one on "Letreiro", and "Tela
    // cheia" marked "will be cleared"; and only then a list of what subscribers are told.
    const { database } = openTemporaryDatabase();
    const store = openStoreOnDatabase(database, createGraphicsFolderWithBuiltRaceClock());
    putAClockItemOnTheOutput(store, 'clock', 'green', 'program');
    putAClockItemOnTheOutput(store, 'fullscreen', 'red', 'program');
    putAClockItemOnTheOutput(store, 'clock', 'yellow', 'preview');
    putAClockItemOnTheOutput(store, 'ticker', 'green', 'preview');
    store.applyCommand({ type: 'previewClearLayer', layerId: 'fullscreen' }, operatorActor);
    const eventLogRowsBefore = countEventLogRows(database);
    const sliceNamesToldToSubscribers: SliceName[][] = [];
    store.subscribeToSliceChanges((changedSliceNames) => {
      sliceNamesToldToSubscribers.push(changedSliceNames);
    });

    // Act: press "Tomar tudo".
    const outcome = store.applyCommand({ type: 'takeAllPreviews' }, operatorActor);

    // Assert: accepted; one row, one notice; program is the set, the database agrees.
    const slicesAfter = store.readAllSlices();
    expect(outcome, '"Tomar tudo" must be accepted').toEqual({ ok: true });
    expect(
      countEventLogRows(database) - eventLogRowsBefore,
      'the whole set must be one event-log row',
    ).toBe(1);
    expect(slicesAfter.eventLog.at(-1)?.command, 'the row must be the takeAllPreviews').toBe(
      'takeAllPreviews',
    );
    expect(sliceNamesToldToSubscribers, 'subscribers must be told once, of all of it').toEqual([
      ['instances', 'previewClearedLayerIds', 'eventLog'],
    ]);
    expect(
      slicesAfter.instances.map((instance) => [
        instance.layerId,
        instance.target,
        instance.resolvedData.state,
      ]),
      'program must hold the two previewed clocks and nothing on "Tela cheia"',
    ).toEqual([
      ['ticker', 'program', 'green'],
      ['clock', 'program', 'yellow'],
    ]);
    expect(slicesAfter.previewClearedLayerIds, 'no marker may be left').toEqual([]);
    expect(
      readAllSliceRows(database).find((row) => row.name === 'instances')?.json,
      'the database must hold what memory holds',
    ).toEqual(slicesAfter.instances);
  });
});

describe('the markers are never saved', () => {
  it('logs and broadcasts previewClearLayer but writes no row for the markers', () => {
    // Arrange: the green clock item on air, and a list of what subscribers are told.
    const { database } = openTemporaryDatabase();
    const store = openStoreOnDatabase(database, createGraphicsFolderWithBuiltRaceClock());
    putAClockItemOnTheOutput(store, 'clock', 'green', 'program');
    const sliceNamesToldToSubscribers: SliceName[][] = [];
    store.subscribeToSliceChanges((changedSliceNames) => {
      sliceNamesToldToSubscribers.push(changedSliceNames);
    });

    // Act: press "Prévia: limpar" on the clock row.
    const outcome = store.applyCommand(
      { type: 'previewClearLayer', layerId: 'clock' },
      operatorActor,
    );

    // Assert: accepted, in memory and told to every page, and absent from the database.
    expect(outcome, 'marking a layer must be accepted').toEqual({ ok: true });
    expect(store.readAllSlices().previewClearedLayerIds, 'the clock must be marked').toEqual([
      'clock',
    ]);
    expect(sliceNamesToldToSubscribers, 'pages must hear about the marker').toEqual([
      ['previewClearedLayerIds', 'eventLog'],
    ]);
    expect(
      readAllSliceRows(database).map((row) => row.name),
      'the markers must never be written to the slices table',
    ).not.toContain('previewClearedLayerIds');
  });

  it('starts every boot with no marker, even with a stray markers row in the database', () => {
    // Arrange: a store that marked the clock layer; then, as an older bug might have,
    // a previewClearedLayerIds row written into the same file by hand.
    const databasePath = createTemporaryDatabasePath();
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = openStoreOnDatabase(firstDatabase, graphicPackagesFolder);
    putAClockItemOnTheOutput(storeBeforeRestart, 'clock', 'green', 'program');
    storeBeforeRestart.applyCommand({ type: 'previewClearLayer', layerId: 'clock' }, operatorActor);
    writeSliceRows(firstDatabase, [
      { name: 'previewClearedLayerIds', json: ['clock'], updatedAt: momentOfTheCommands },
    ]);
    firstDatabase.$client.close();

    // Act: restart, opening a new store on the same file.
    const secondDatabase = openDatabaseForTests(databasePath);
    const storeAfterRestart = openStoreOnDatabase(secondDatabase, graphicPackagesFolder);

    // Assert: no marker after the restart; the clock on air came back as usual.
    expect(
      storeAfterRestart.readAllSlices().previewClearedLayerIds,
      'a boot must start with no marker, whatever the database holds',
    ).toEqual([]);
    expect(
      storeAfterRestart.readAllSlices().instances.map((instance) => instance.layerId),
      'the clock on air must still come back',
    ).toEqual(['clock']);
  });
});

describe('takeAllPreviews and the auto-out', () => {
  it('starts the wait of an item with an auto-out at "Tomar tudo"', () => {
    // Arrange: fake timers; a store and scheduler; "Relógio do patrocinador", a clock
    // item that leaves 10 s after it goes on air, previewed and then taken with
    // "Tomar tudo".
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const store = createStateStore({
      database: openTemporaryDatabase().database,
      logger: createLogger({ level: 'silent' }),
      graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
      createItemId: () => 'item-relogio-do-patrocinador',
    });
    const scheduler = startAutoOutScheduler({
      stateStore: store,
      logger: createLogger({ level: 'silent' }),
    });
    onTestFinished(() => scheduler.stop());
    store.applyCommand(
      {
        type: 'createItem',
        home: { kind: 'rundown', rundownId: 'sessao-principal' },
        graphicId: 'race-clock',
        layerId: 'clock',
        label: 'Relógio do patrocinador',
        autoOutAfterMs: 10_000,
        fields: {
          sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
          state: { kind: 'literal', value: 'green' },
          clockMode: { kind: 'literal', value: 'elapsed' },
          referenceTimeMs: { kind: 'literal', value: 3_900_000 },
          referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
          running: { kind: 'literal', value: true },
        },
      },
      operatorActor,
    );
    store.applyCommand(
      { type: 'previewItem', itemId: 'item-relogio-do-patrocinador' },
      operatorActor,
    );
    store.applyCommand({ type: 'takeAllPreviews' }, operatorActor);
    const numberOfWaitsRightAfterTheTake = vi.getTimerCount();

    // Act: let the 10 seconds pass.
    vi.advanceTimersByTime(10_000);

    // Assert: the take started one wait, and the auto-out then cleared the clock layer.
    expect(numberOfWaitsRightAfterTheTake, '"Tomar tudo" must start the item’s wait').toBe(1);
    expect(
      store.readAllSlices().eventLog.map((entry) => [entry.actor, entry.command]),
      'the auto-out must fire after the take, signed sistema:auto-out',
    ).toEqual([
      [operatorActor, 'createItem'],
      [operatorActor, 'previewItem'],
      [operatorActor, 'takeAllPreviews'],
      ['sistema:auto-out', 'clearLayer'],
    ]);
    expect(store.readAllSlices().instances, 'the clock layer must be empty again').toEqual([]);
  });
});
