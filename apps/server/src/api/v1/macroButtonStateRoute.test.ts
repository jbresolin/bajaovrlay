/**
 * A macro's state for the D200: GET /api/v1/state/macro/:macroId (apps/server)
 *
 * What this module is for:
 *   A D200 button that fires `run-macro/<id>` polls this route, so it stays lit while its
 *   macro runs (BAJAOVRLAY-56). The answer is flat, `{ isRunning }`, for the plugin's
 *   one-word JSON path.
 *
 * What these tests prove (on a real store, through the app, open to the studio network):
 *   - "Abrir a sessão" is not running before it is pressed, is running once pressed, is
 *     still running after "Parar" until its step in progress ends, and is not running once
 *     its run has ended.
 *   - Another macro running does not light this one's button.
 *   - A macro that does not exist answers 404 in the shared error shape, in pt-BR.
 *
 * What these tests deliberately do not cover:
 *   - The macro runner that walks the steps and ends the run; the macro runner's tests. Here
 *     the run is ended by the watchdog's endMacroRun, as the runner's own last command.
 *   - Access and the quiet request log; buttonStateRoutesAccess.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { StateStore } from '../../core/store/createStateStore.js';
import {
  askTheStateAsTheD200,
  createOpenAppWithTheRaceDay,
  type RaceDayWithTheGreenFlagButton,
} from './buttonStateOnTheApp.testSupport.js';
import { applyOrThrow } from './commandApiOnTheApp.testSupport.js';

/** The server's watchdog, which may end any macro's run. */
const macroWatchdogActor = 'sistema:macro-watchdog';

/** Creates the macro "Mostrar o pódio" (one step, the podium on air) and returns its id. */
function createTheShowThePodiumMacro(
  stateStore: StateStore,
  raceDay: RaceDayWithTheGreenFlagButton,
): string {
  applyOrThrow(stateStore, {
    type: 'createMacro',
    label: 'Mostrar o pódio',
    color: 'info',
    steps: [{ kind: 'takeItem', itemId: raceDay.podiumItemId }],
  });
  return stateStore.readAllSlices().macros.at(-1)?.id ?? '';
}

/** One moment of the race day, and what the button of "Abrir a sessão" must read then. */
type MacroStateScenario = {
  name: string;
  /** What the operator (or the server) did before the poll. */
  prepareTheStore: (stateStore: StateStore, raceDay: RaceDayWithTheGreenFlagButton) => void;
  expectedAnswer: { isRunning: boolean };
};

const macroStateScenarios: MacroStateScenario[] = [
  // Before anyone presses it: dark.
  {
    name: 'is not running before it is pressed',
    prepareTheStore: () => {},
    expectedAnswer: { isRunning: false },
  },
  // Pressed: the button lights while the steps play.
  {
    name: 'is running once pressed',
    prepareTheStore: (stateStore, raceDay) =>
      applyOrThrow(stateStore, { type: 'runMacro', macroId: raceDay.openTheSessionMacroId }),
    expectedAnswer: { isRunning: true },
  },
  // "Parar" lets the step in progress finish, so the macro is still running until then;
  // the button going dark early would tell the operator something false.
  {
    name: 'is still running after "Parar", until its step in progress ends',
    prepareTheStore: (stateStore, raceDay) => {
      applyOrThrow(stateStore, { type: 'runMacro', macroId: raceDay.openTheSessionMacroId });
      applyOrThrow(stateStore, { type: 'stopMacro', macroId: raceDay.openTheSessionMacroId });
    },
    expectedAnswer: { isRunning: true },
  },
  // Running, then stopped: once the run has ended the button goes dark again.
  {
    name: 'is not running once its run has ended',
    prepareTheStore: (stateStore, raceDay) => {
      applyOrThrow(stateStore, { type: 'runMacro', macroId: raceDay.openTheSessionMacroId });
      const outcome = stateStore.applyCommand(
        { type: 'endMacroRun', macroId: raceDay.openTheSessionMacroId },
        macroWatchdogActor,
      );
      if (!outcome.ok) {
        throw new Error(`The watchdog's endMacroRun was refused: ${outcome.error.message}`);
      }
    },
    expectedAnswer: { isRunning: false },
  },
  // Only one macro runs at a time; the one running is another, so this button stays dark.
  {
    name: 'is not running while another macro runs',
    prepareTheStore: (stateStore, raceDay) => {
      const showThePodiumMacroId = createTheShowThePodiumMacro(stateStore, raceDay);
      applyOrThrow(stateStore, { type: 'runMacro', macroId: showThePodiumMacroId });
    },
    expectedAnswer: { isRunning: false },
  },
];

describe('GET /api/v1/state/macro/:macroId', () => {
  it.each(macroStateScenarios)(
    '"Abrir a sessão" $name',
    async ({ prepareTheStore, expectedAnswer }) => {
      // Arrange: the race day open to the studio network, and the row's moment on it.
      const { app, stateStore, raceDay } = createOpenAppWithTheRaceDay();
      prepareTheStore(stateStore, raceDay);

      // Act: the D200 polls the state of "Abrir a sessão".
      const { httpStatus, answer } = await askTheStateAsTheD200(
        app,
        `/api/v1/state/macro/${raceDay.openTheSessionMacroId}`,
      );

      // Assert: 200, and exactly the row's value, as a JSON boolean.
      expect(httpStatus, 'a macro that exists answers 200').toBe(200);
      expect(answer, '"Abrir a sessão" must read as the row says').toStrictEqual(expectedAnswer);
    },
  );

  it('answers 404 in the error shape for a macro that does not exist', async () => {
    // Arrange: the race day; no macro has the id "macro-apagada".
    const { app } = createOpenAppWithTheRaceDay();

    // Act: a D200 button left set up for a deleted macro polls it.
    const { httpStatus, answer } = await askTheStateAsTheD200(
      app,
      '/api/v1/state/macro/macro-apagada',
    );

    // Assert: 404, so the plugin shows its "unmatched" image, and the reason in pt-BR.
    expect(httpStatus, 'an unknown macro answers 404').toBe(404);
    expect(answer, 'the shared error shape, naming the macro').toEqual({
      error: { code: 'MACRO_NOT_FOUND', message: 'A macro "macro-apagada" não existe.' },
    });
  });
});
