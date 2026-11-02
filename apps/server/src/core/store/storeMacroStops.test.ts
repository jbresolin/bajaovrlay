/**
 * Where a macro's run stopped short: the macroStops slice (apps/server)
 *
 * What this module is for:
 *   When a macro's step is refused (OBS down, an item deleted), the runner ends the run
 *   saying which step and why (BAJAOVRLAY-27). The run itself leaves `macroRuns`, so the
 *   reason is kept in `macroStops` for the macro's button, until the macro runs again or
 *   is deleted. It lives in memory only, like the runs.
 *
 * What these tests prove (a real store on a temporary SQLite file):
 *   - endMacroRun with a stop keeps the step, the reason and the moment for that macro.
 *   - endMacroRun without one (run to its end, or "Parar") keeps nothing.
 *   - Pressing the macro again drops its stop; deleting it does too.
 *   - A stop is never saved: a restart starts with none.
 *
 * What these tests deliberately do not cover:
 *   - The runner deciding to stop (macroRunnerWhenAStepGoesWrong.test.ts, and
 *     modules/obs/obsSceneMacroStep.test.ts for the OBS step).
 */
import { describe, expect, it } from 'vitest';

import {
  openDatabaseForTests,
  openTemporaryDatabase,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';

const operatorActor = 'operador:conexao-7';
const trackAndTowerMacroId = 'macro-pista-e-torre';
const runnerActor = `sistema:macro:${trackAndTowerMacroId}`;
const momentOfTheStop = '2026-11-14T13:15:00.000Z';

/** A store with the macro "Pista + torre" saved, on the given database path or a new one. */
function createStoreWithTheTrackAndTowerMacro(databasePath?: string) {
  const database =
    databasePath === undefined
      ? openTemporaryDatabase().database
      : openDatabaseForTests(databasePath);
  const store = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => new Date(momentOfTheStop),
    createMacroId: () => trackAndTowerMacroId,
  });
  if (databasePath === undefined) {
    store.applyCommand(
      {
        type: 'createMacro',
        label: 'Pista + torre',
        color: 'success',
        steps: [{ kind: 'obsScene', sceneName: 'Pista' }],
      },
      operatorActor,
    );
  }
  return store;
}

/** Presses the macro and ends its run as the runner does when OBS is down. */
function runTheMacroAndStopItAtTheSceneStep(store: ReturnType<typeof createStateStore>): void {
  store.applyCommand({ type: 'runMacro', macroId: trackAndTowerMacroId }, operatorActor);
  store.applyCommand(
    {
      type: 'endMacroRun',
      macroId: trackAndTowerMacroId,
      stoppedAtStep: { stepIndex: 0, reason: 'O OBS não está conectado.' },
    },
    runnerActor,
  );
}

describe('the macroStops slice', () => {
  it('keeps the step, the reason and the moment of a run that stopped short', () => {
    // Arrange: the macro saved.
    const store = createStoreWithTheTrackAndTowerMacro();

    // Act: it runs and stops at its scene step.
    runTheMacroAndStopItAtTheSceneStep(store);

    // Assert: the run is gone, and the button can say where and why.
    expect(store.readAllSlices().macroRuns, 'the run must be over').toEqual([]);
    expect(store.readAllSlices().macroStops, 'the stop must be kept for the button').toEqual([
      {
        macroId: trackAndTowerMacroId,
        stepIndex: 0,
        reason: 'O OBS não está conectado.',
        stoppedAt: momentOfTheStop,
      },
    ]);
  });

  it('keeps nothing for a run that went to its end', () => {
    // Arrange: the macro saved and pressed.
    const store = createStoreWithTheTrackAndTowerMacro();
    store.applyCommand({ type: 'runMacro', macroId: trackAndTowerMacroId }, operatorActor);

    // Act: the runner ends the run with no stop.
    store.applyCommand({ type: 'endMacroRun', macroId: trackAndTowerMacroId }, runnerActor);

    // Assert: nothing to show.
    expect(store.readAllSlices().macroStops, 'a run that ended well leaves no stop').toEqual([]);
  });

  const clearingScenarios = [
    // The operator tries again (OBS back): the old reason would be a lie on a running button.
    {
      name: 'drops the stop when the macro is pressed again',
      command: { type: 'runMacro', macroId: trackAndTowerMacroId },
    },
    // A deleted macro has no button to show it on.
    {
      name: 'drops the stop when the macro is deleted',
      command: { type: 'deleteMacro', macroId: trackAndTowerMacroId },
    },
  ];

  it.each(clearingScenarios)('$name', ({ command }) => {
    // Arrange: the macro stopped short once.
    const store = createStoreWithTheTrackAndTowerMacro();
    runTheMacroAndStopItAtTheSceneStep(store);

    // Act: the row's command, from the operator.
    store.applyCommand(command, operatorActor);

    // Assert: the stop is gone.
    expect(store.readAllSlices().macroStops, 'the stop must go').toEqual([]);
  });

  it('is never saved: a restart starts with no stop', () => {
    // Arrange: a database where the macro stopped short.
    const { databasePath, database } = openTemporaryDatabase();
    const storeBefore = createStateStore({
      database,
      logger: createLogger({ level: 'silent' }),
      graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
      createMacroId: () => trackAndTowerMacroId,
    });
    storeBefore.applyCommand(
      { type: 'createMacro', label: 'Pista + torre', color: 'success', steps: [] },
      operatorActor,
    );
    runTheMacroAndStopItAtTheSceneStep(storeBefore);
    database.$client.close();

    // Act: the server restarts on the same file.
    const storeAfter = createStoreWithTheTrackAndTowerMacro(databasePath);

    // Assert: the macro is still there, its stop is not.
    expect(storeAfter.readAllSlices().macros.length, 'the macro itself is saved').toBe(1);
    expect(
      storeAfter.readAllSlices().macroStops,
      'a stop belongs to a run, gone at a restart',
    ).toEqual([]);
  });
});
