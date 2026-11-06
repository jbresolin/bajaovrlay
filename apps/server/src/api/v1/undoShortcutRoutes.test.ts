/**
 * The undo buttons of the command API: POST /api/v1/undo-layer/:layerId and /undo-last
 * (apps/server)
 *
 * What this module is for:
 *   A pad's "Desfazer" and "Desfazer última" (BAJAOVRLAY-30) are fixed URLs with no body,
 *   like the other shortcuts (BAJAOVRLAY-28). Each builds one command, undoOnLayer or
 *   undoLastChangeOnProgram, and runs it through the store's one path, signed
 *   `api:<token name>`, exactly as the control page's WebSocket command would run.
 *
 * What these tests prove (two apps built alike on real SQLite files, one sent the
 * WebSocket command as the control page sends it, the other the shortcut):
 *   - Each undo shortcut leaves every slice exactly as its WebSocket command does, and the
 *     same event-log rows, answered 200, the last row signed `api:companion`.
 *   - With nothing to undo, the shortcut answers 409 with the store's pt-BR reason.
 *
 * What these tests deliberately do not cover:
 *   - What an undo puts back; core/store/programHistory/undoOnProgram.test.ts.
 *   - The token check in front of every shortcut; apiTokenAuth.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  apiTokensOfTheDesk,
  companionToken,
} from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  applyOrThrow,
  createAppWithTheCommandApi,
  prepareTheRaceDay,
  type RaceDayOnTheStore,
  readEventLogWithoutActors,
  readSlicesExceptTheEventLog,
  sendApiRequest,
  sendCommandOverTheWebSocket,
} from './commandApiOnTheApp.testSupport.js';

/** One undo shortcut, the state it is pressed in, and the WebSocket command it stands for. */
type UndoShortcutScenario = {
  name: string;
  prepareTheStore: (stateStore: StateStore, raceDay: RaceDayOnTheStore) => void;
  path: string;
  webSocketCommand: Record<string, unknown>;
};

const undoShortcutScenarios: UndoShortcutScenario[] = [
  // "Desfazer" on the clock layer after its "Limpar" was pressed by mistake.
  {
    name: 'undo-layer puts back what the named layer showed before, as undoOnLayer does',
    prepareTheStore: (stateStore, raceDay) => {
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.enduroClockItemId });
      applyOrThrow(stateStore, { type: 'clearLayer', layerId: 'clock' });
    },
    path: '/api/v1/undo-layer/clock',
    webSocketCommand: { type: 'undoOnLayer', layerId: 'clock' },
  },
  // "Desfazer última" after a "Limpar tudo" by mistake with two clocks on air.
  {
    name: 'undo-last undoes the newest change on program, as undoLastChangeOnProgram does',
    prepareTheStore: (stateStore, raceDay) => {
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.enduroClockItemId });
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId });
      applyOrThrow(stateStore, { type: 'clearAll' });
    },
    path: '/api/v1/undo-last',
    webSocketCommand: { type: 'undoLastChangeOnProgram' },
  },
];

describe('the undo shortcuts change state exactly as their WebSocket commands', () => {
  it.each(undoShortcutScenarios)('$name', async (scenario) => {
    // Arrange: two race days built alike; one gets the WebSocket command, one the shortcut.
    const overTheWebSocket = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
    const throughTheApi = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
    scenario.prepareTheStore(
      overTheWebSocket.stateStore,
      prepareTheRaceDay(overTheWebSocket.stateStore),
    );
    scenario.prepareTheStore(throughTheApi.stateStore, prepareTheRaceDay(throughTheApi.stateStore));

    // Act: the control page's command on one, Companion's button on the other.
    const webSocketAnswer = sendCommandOverTheWebSocket(
      overTheWebSocket.stateStore,
      scenario.webSocketCommand,
    );
    const response = await sendApiRequest(throughTheApi.app, {
      method: 'POST',
      path: scenario.path,
      token: companionToken,
    });

    // Assert: both accepted, every slice alike, the same rows, the last one signed by Companion.
    expect(webSocketAnswer.ok, 'the WebSocket command must be accepted').toBe(true);
    expect(response.status, 'the shortcut must answer 200').toBe(200);
    expect(
      readSlicesExceptTheEventLog(throughTheApi.stateStore),
      'the shortcut must leave every slice as the WebSocket command does',
    ).toEqual(readSlicesExceptTheEventLog(overTheWebSocket.stateStore));
    expect(
      readEventLogWithoutActors(throughTheApi.stateStore),
      'the shortcut must write the same event-log rows',
    ).toEqual(readEventLogWithoutActors(overTheWebSocket.stateStore));
    const lastRow = throughTheApi.stateStore.readAllSlices().eventLog.at(-1);
    expect(lastRow?.actor, 'the row names Companion’s token').toBe('api:companion');
  });
});

describe('an undo shortcut with nothing to undo', () => {
  it('answers 409 with the store’s pt-BR reason', async () => {
    // Arrange: a race day where nothing was ever taken.
    const throughTheApi = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
    prepareTheRaceDay(throughTheApi.stateStore);

    // Act: press "Desfazer última" on the pad.
    const response = await sendApiRequest(throughTheApi.app, {
      method: 'POST',
      path: '/api/v1/undo-last',
      token: companionToken,
    });

    // Assert: the state is in the way, said in pt-BR.
    expect(response.status, 'nothing to undo is the state in the way').toBe(409);
    expect(await response.json(), 'the reason must be the store’s').toEqual({
      type: 'commandResult',
      requestId: null,
      ok: false,
      error: { code: 'NOTHING_TO_UNDO', message: 'Não há nada no ar para desfazer.' },
    });
  });
});
