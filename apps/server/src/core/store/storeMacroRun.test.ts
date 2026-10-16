/**
 * A whole macro run through the store, and across a restart (apps/server)
 *
 * What this module is for:
 *   The rehearsal macro of M1: a button that puts the enduro clock on air, waits half a
 *   second and clears the lower third. Here the macro is built, saved and run the way
 *   the control page and the server do it, on a real SQLite file: the operator's
 *   commands go through the store, the runner sends the steps through the same store,
 *   and a restart opens a new store on the same file.
 *
 * What these tests prove (with a real SQLite file and fake timers):
 *   - take + wait 500 + clearLayer leaves the layer empty after 500 ms, and the run is
 *     gone from `macroRuns`.
 *   - The macros are saved and come back after a restart; the runs are never saved:
 *     the slices table has no macroRuns row at any moment of a run.
 *   - "Parar" (stopMacro) during the wait ends the run without the clear: the clock stays
 *     on air, the macro is free again, and the event log saved in the database reads
 *     the stop and then the runner's end.
 *   - A server stopped in the middle of a run (runner stopped, store reopened) starts
 *     with no run, so the macro can be pressed again at once; what the first steps put
 *     on air stays on air, because nothing is undone and nothing is resumed.
 *
 * What these tests deliberately do not cover:
 *   - Each rule of the runner on its own (order, failure, one at a time);
 *     macroRunner.test.ts and macroRunnerWhenAStepGoesWrong.test.ts cover them.
 *   - startServer's wiring of the runner; the same start and stop are made by hand here.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { readNewestEventLogRows } from '../db/eventLogRowStorage.js';
import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows } from '../db/sliceRowStorage.js';
import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';
import { startMacroRunner } from './macroRunner.js';

const operatorActor = 'operador:conexao-7';
const openTheSessionMacroId = 'macro-abrir-sessao';
const enduroClockItemId = 'item-relogio-do-enduro';

/** Opens a store on the given database, as the server does at boot. */
function openStoreOnDatabase(database: ServerDatabase, graphicPackagesFolder: string): StateStore {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder,
    createItemId: () => enduroClockItemId,
    createMacroId: () => openTheSessionMacroId,
  });
}

/**
 * Builds the rehearsal: fake timers, a store on a fresh database file with the enduro
 * clock prepared as a button of "Atalhos" on the lower third layer, the macro
 * "Abrir a sessão" (take it, wait 500 ms, clear the lower third) saved, and a runner.
 */
function prepareTheRehearsalMacro() {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const databasePath = createTemporaryDatabasePath();
  const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
  const database = openDatabaseForTests(databasePath);
  const store = openStoreOnDatabase(database, graphicPackagesFolder);
  store.applyCommand(
    {
      type: 'createItem',
      home: { kind: 'quickFire', panelId: 'atalhos' },
      graphicId: 'race-clock',
      layerId: 'lower-third',
      label: 'Relógio do enduro',
      fields: {
        sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
        state: { kind: 'literal', value: 'green' },
        clockMode: { kind: 'literal', value: 'elapsed' },
        referenceTimeMs: { kind: 'literal', value: 0 },
        referenceWallClockMs: { kind: 'takeTime' },
        running: { kind: 'literal', value: true },
      },
    },
    operatorActor,
  );
  store.applyCommand(
    {
      type: 'createMacro',
      label: 'Abrir a sessão',
      color: 'success',
      steps: [
        { kind: 'takeItem', itemId: enduroClockItemId },
        { kind: 'wait', ms: 500 },
        { kind: 'clearLayer', layerId: 'lower-third' },
      ],
    },
    operatorActor,
  );
  const runner = startMacroRunner({ stateStore: store, logger: createLogger({ level: 'silent' }) });
  onTestFinished(() => runner.stop());
  return { store, runner, database, databasePath, graphicPackagesFolder };
}

/** Reads which layers have something on air. */
function readLayerIdsOnAir(store: StateStore): string[] {
  return store.readAllSlices().instances.map((instance) => instance.layerId);
}

/** Reads the names of the slice rows the database holds. */
function readStoredSliceNames(database: ServerDatabase): string[] {
  return readAllSliceRows(database).map((row) => row.name);
}

describe('the rehearsal macro, run through the store', () => {
  it('takes the clock, waits 500 ms and leaves the lower third empty', () => {
    // Arrange: the macro saved and the runner started.
    const { store, database } = prepareTheRehearsalMacro();

    // Act: press "Abrir a sessão", look during the wait, then let 500 ms pass.
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(250);
    const layerIdsOnAirDuringTheWait = readLayerIdsOnAir(store);
    const storedSliceNamesDuringTheRun = readStoredSliceNames(database);
    vi.advanceTimersByTime(250);

    // Assert: on air during the wait, empty after it, no run left, no run ever saved.
    expect(layerIdsOnAirDuringTheWait, 'the clock must be on air during the wait').toEqual([
      'lower-third',
    ]);
    expect(readLayerIdsOnAir(store), 'the lower third must be empty after 500 ms').toEqual([]);
    expect(store.readAllSlices().macroRuns, 'the run must be gone at the end').toEqual([]);
    expect(
      storedSliceNamesDuringTheRun,
      'the runs live in memory only and must never be saved',
    ).not.toContain('macroRuns');
  });
});

describe('the rehearsal macro, stopped by the operator', () => {
  it('ends the run on "Parar" during the wait, keeps the clock on air and saves the stop', () => {
    // Arrange: the macro saved, pressed, and 200 ms into its wait.
    const { store, database } = prepareTheRehearsalMacro();
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(200);

    // Act: press "Parar", and let a second pass (more than the rest of the wait).
    const outcomeOfTheStop = store.applyCommand(
      { type: 'stopMacro', macroId: openTheSessionMacroId },
      operatorActor,
    );
    vi.advanceTimersByTime(1_000);

    // Assert: accepted; the clear never came; no run left; the saved event log ends with
    // the operator's stop and the runner's end.
    expect(outcomeOfTheStop, 'an operator may stop the running macro').toEqual({ ok: true });
    expect(readLayerIdsOnAir(store), 'the clear after the wait must never be sent').toEqual([
      'lower-third',
    ]);
    expect(store.readAllSlices().macroRuns, 'the stopped run must be gone').toEqual([]);
    expect(
      readNewestEventLogRows(database, 2).map((row) => `${row.actor} ${row.command}`),
      'the database must hold the stop and then the end of the run',
    ).toEqual([`${operatorActor} stopMacro`, 'sistema:macro:macro-abrir-sessao endMacroRun']);
  });
});

describe('the rehearsal macro across a restart', () => {
  it('keeps the macro, starts with no run, and leaves on air what the first step put there', () => {
    // Arrange: the macro pressed, and the server stopped 200 ms into the wait.
    const { store, runner, database, databasePath, graphicPackagesFolder } =
      prepareTheRehearsalMacro();
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(200);
    runner.stop();
    database.$client.close();

    // Act: boot again on the same file, with a new runner, and let a second pass.
    const restartedStore = openStoreOnDatabase(
      openDatabaseForTests(databasePath),
      graphicPackagesFolder,
    );
    const restartedRunner = startMacroRunner({
      stateStore: restartedStore,
      logger: createLogger({ level: 'silent' }),
    });
    onTestFinished(() => restartedRunner.stop());
    vi.advanceTimersByTime(1_000);

    // Assert: the macro is back, no run, the clock still on air (nothing resumed, nothing
    // undone), and the macro can be pressed again at once.
    expect(
      restartedStore.readAllSlices().macros.map((macro) => macro.label),
      'the saved macro must come back after a restart',
    ).toEqual(['Abrir a sessão']);
    expect(restartedStore.readAllSlices().macroRuns, 'a restart must start with no run').toEqual(
      [],
    );
    expect(
      readLayerIdsOnAir(restartedStore),
      'the clock the first step put on air must stay; the clear is never resumed',
    ).toEqual(['lower-third']);
    expect(
      restartedStore.applyCommand(
        { type: 'runMacro', macroId: openTheSessionMacroId },
        operatorActor,
      ),
      'the macro must be accepted again after the restart',
    ).toEqual({ ok: true });
  });
});
