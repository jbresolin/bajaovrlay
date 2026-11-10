/**
 * The button shortcuts of the command API: POST /api/v1/take-next and the rest (apps/server)
 *
 * What this module is for:
 *   Companion's generic HTTP module does best with a fixed URL and no body, so each
 *   button a pad needs has its own route (BAJAOVRLAY-28). A shortcut builds one command
 *   and runs it through the store's one path, signed `api:<token name>`, exactly as the
 *   control page's WebSocket command would run; there is no logic of its own.
 *
 * What these tests prove (two apps built alike on real SQLite files, one sent the
 * WebSocket command as the control page sends it, the other the shortcut):
 *   - Each of the ten shortcuts leaves every slice exactly as its WebSocket command does,
 *     and the same event-log rows (command, payload, result, moment), answered 200.
 *   - The event-log row of a shortcut names `api:companion`.
 *   - A refusal carries the code and pt-BR message the WebSocket gives: an item that does
 *     not exist (422) and a cursor on nothing (409).
 *   - fire-shortcut/<panelId>/<n> takes the panel's n-th button (from 1, in the panel's
 *     order, as the digit keys count) exactly as a click does, without moving the cursor;
 *     a panel or a button number that does not exist answers 422 in pt-BR.
 *   - "Tomar" with no rundown at all (a damaged database) answers 422, the status the
 *     refusal map gives RUNDOWN_NOT_FOUND everywhere.
 *   - "Parar" with no macro running answers ok and changes nothing, as stopMacro does for
 *     a macro that is not running.
 *
 * What these tests deliberately do not cover:
 *   - The token check in front of every shortcut; apiTokenAuth.test.ts.
 *   - What each command does in detail; the reducers' own tests.
 *   - That the control page's clients hear of it; commandApiBroadcast.test.ts.
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

/** One shortcut, the state it is pressed in, and the WebSocket command it stands for. */
type ShortcutScenario = {
  name: string;
  prepareTheStore: (stateStore: StateStore, raceDay: RaceDayOnTheStore) => void;
  buildPath: (raceDay: RaceDayOnTheStore) => string;
  buildWebSocketCommand: (raceDay: RaceDayOnTheStore) => Record<string, unknown>;
};

/** Leaves the race day as prepareTheRaceDay left it. */
function changeNothing(): void {}

const shortcutScenarios: ShortcutScenario[] = [
  // "Tomar": the item under the cursor goes on air and the cursor moves on.
  {
    name: 'take-next takes the item under the cursor, as takeNext does',
    prepareTheStore: changeNothing,
    buildPath: () => '/api/v1/take-next',
    buildWebSocketCommand: () => ({ type: 'takeNext', rundownId: 'sessao-principal' }),
  },
  // A button for one item, wherever it lives.
  {
    name: 'take-item takes the named item, as takeItem does',
    prepareTheStore: changeNothing,
    buildPath: (raceDay) => `/api/v1/take-item/${raceDay.cornerClockItemId}`,
    buildWebSocketCommand: (raceDay) => ({ type: 'takeItem', itemId: raceDay.cornerClockItemId }),
  },
  // "Prévia" of one item, asked for by hand (origin manual, the command's default).
  {
    name: 'preview-item previews the named item, as previewItem does',
    prepareTheStore: changeNothing,
    buildPath: (raceDay) => `/api/v1/preview-item/${raceDay.cornerClockItemId}`,
    buildWebSocketCommand: (raceDay) => ({
      type: 'previewItem',
      itemId: raceDay.cornerClockItemId,
    }),
  },
  // "Tomar tudo" with the corner clock waiting in Prévia.
  {
    name: 'take-all-previews takes what Prévia shows, as takeAllPreviews does',
    prepareTheStore: (stateStore, raceDay) =>
      applyOrThrow(stateStore, { type: 'previewItem', itemId: raceDay.cornerClockItemId }),
    buildPath: () => '/api/v1/take-all-previews',
    buildWebSocketCommand: () => ({ type: 'takeAllPreviews' }),
  },
  // The clock layer's "Limpar" with the enduro clock on air.
  {
    name: 'clear-layer clears the named layer, as clearLayer does',
    prepareTheStore: (stateStore, raceDay) =>
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.enduroClockItemId }),
    buildPath: () => '/api/v1/clear-layer/clock',
    buildWebSocketCommand: () => ({ type: 'clearLayer', layerId: 'clock' }),
  },
  // The panic button with two clocks on air.
  {
    name: 'clear-all clears every layer, as clearAll does',
    prepareTheStore: (stateStore, raceDay) => {
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.enduroClockItemId });
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId });
    },
    buildPath: () => '/api/v1/clear-all',
    buildWebSocketCommand: () => ({ type: 'clearAll' }),
  },
  // "Próximo" on the podium showing 3rd place: the shortcut names the step it saw.
  {
    name: 'next-on-layer moves the podium from its first step, as nextOnLayer does',
    prepareTheStore: (stateStore, raceDay) =>
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.podiumItemId }),
    buildPath: () => '/api/v1/next-on-layer/fullscreen',
    buildWebSocketCommand: () => ({ type: 'nextOnLayer', layerId: 'fullscreen', fromStep: 0 }),
  },
  // A second "Próximo": the shortcut reads the step the podium is on now (2nd place).
  {
    name: 'next-on-layer moves the podium from the step it is on now, as nextOnLayer does',
    prepareTheStore: (stateStore, raceDay) => {
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.podiumItemId });
      applyOrThrow(stateStore, { type: 'nextOnLayer', layerId: 'fullscreen', fromStep: 0 });
    },
    buildPath: () => '/api/v1/next-on-layer/fullscreen',
    buildWebSocketCommand: () => ({ type: 'nextOnLayer', layerId: 'fullscreen', fromStep: 1 }),
  },
  // A pad's button mapped to a place, not an id: button 2 of "Atalhos" is the podium, the
  // second button made there (João's note of 2026-10-11).
  {
    name: 'fire-shortcut takes button 2 of "Atalhos", as a click on it (takeItem) does',
    prepareTheStore: changeNothing,
    buildPath: () => '/api/v1/fire-shortcut/atalhos/2',
    buildWebSocketCommand: (raceDay) => ({ type: 'takeItem', itemId: raceDay.podiumItemId }),
  },
  // A macro button.
  {
    name: 'run-macro starts the named macro, as runMacro does',
    prepareTheStore: changeNothing,
    buildPath: (raceDay) => `/api/v1/run-macro/${raceDay.openTheSessionMacroId}`,
    buildWebSocketCommand: (raceDay) => ({
      type: 'runMacro',
      macroId: raceDay.openTheSessionMacroId,
    }),
  },
  // "Parar" while "Abrir a sessão" runs: the shortcut stops the macro that is running.
  {
    name: 'stop-macro stops the macro that is running, as stopMacro does',
    prepareTheStore: (stateStore, raceDay) =>
      applyOrThrow(stateStore, { type: 'runMacro', macroId: raceDay.openTheSessionMacroId }),
    buildPath: () => '/api/v1/stop-macro',
    buildWebSocketCommand: (raceDay) => ({
      type: 'stopMacro',
      macroId: raceDay.openTheSessionMacroId,
    }),
  },
];

describe('the shortcuts change state exactly as their WebSocket commands', () => {
  it.each(shortcutScenarios)('$name', async (scenario) => {
    // Arrange: two race days built alike; one gets the WebSocket command, one the shortcut.
    const overTheWebSocket = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
    const throughTheApi = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
    const raceDayOverTheWebSocket = prepareTheRaceDay(overTheWebSocket.stateStore);
    const raceDayThroughTheApi = prepareTheRaceDay(throughTheApi.stateStore);
    scenario.prepareTheStore(overTheWebSocket.stateStore, raceDayOverTheWebSocket);
    scenario.prepareTheStore(throughTheApi.stateStore, raceDayThroughTheApi);

    // Act: the control page's command on one, Companion's button on the other.
    const webSocketAnswer = sendCommandOverTheWebSocket(
      overTheWebSocket.stateStore,
      scenario.buildWebSocketCommand(raceDayOverTheWebSocket),
    );
    const response = await sendApiRequest(throughTheApi.app, {
      method: 'POST',
      path: scenario.buildPath(raceDayThroughTheApi),
      token: companionToken,
    });
    const body: unknown = await response.json();

    // Assert: both accepted, every slice alike, the same rows, the last one signed by Companion.
    expect(webSocketAnswer.ok, 'the WebSocket command must be accepted').toBe(true);
    expect(response.status, 'the shortcut must answer 200').toBe(200);
    expect(body, 'the shortcut answers the same commandResult').toEqual({
      type: 'commandResult',
      requestId: null,
      ok: true,
    });
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

describe('the refusals of a shortcut', () => {
  it('refuses an item that does not exist with the WebSocket’s reason, as 422', async () => {
    // Arrange: two race days, and an item id a pad still holds after the item was deleted.
    const overTheWebSocket = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
    const throughTheApi = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
    prepareTheRaceDay(overTheWebSocket.stateStore);
    prepareTheRaceDay(throughTheApi.stateStore);

    // Act: take it both ways.
    const webSocketAnswer = sendCommandOverTheWebSocket(overTheWebSocket.stateStore, {
      type: 'takeItem',
      itemId: 'item-apagado',
    });
    const response = await sendApiRequest(throughTheApi.app, {
      method: 'POST',
      path: '/api/v1/take-item/item-apagado',
      token: companionToken,
    });
    const body = (await response.json()) as { error: unknown };

    // Assert: 422, with the same code and pt-BR message as the WebSocket.
    expect(response.status, 'a reference to nothing is unprocessable').toBe(422);
    expect(webSocketAnswer.ok, 'the WebSocket refuses it too').toBe(false);
    expect(body.error, 'the same reason as the WebSocket').toEqual(
      webSocketAnswer.ok ? undefined : webSocketAnswer.error,
    );
  });

  it('refuses "Tomar" with the cursor on nothing with the WebSocket’s reason, as 409', async () => {
    // Arrange: two race days with the cursor taken off every item.
    const overTheWebSocket = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
    const throughTheApi = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
    for (const { stateStore } of [overTheWebSocket, throughTheApi]) {
      prepareTheRaceDay(stateStore);
      applyOrThrow(stateStore, { type: 'moveCursor', rundownId: 'sessao-principal', itemId: null });
    }

    // Act: "Tomar" both ways.
    const webSocketAnswer = sendCommandOverTheWebSocket(overTheWebSocket.stateStore, {
      type: 'takeNext',
      rundownId: 'sessao-principal',
    });
    const response = await sendApiRequest(throughTheApi.app, {
      method: 'POST',
      path: '/api/v1/take-next',
      token: companionToken,
    });
    const body = (await response.json()) as { error: { code: string } };

    // Assert: 409, the state is in the way, with the WebSocket's reason.
    expect(response.status, 'a cursor on nothing is a conflict with the state').toBe(409);
    expect(body.error.code, 'the cursor is empty').toBe('RUNDOWN_CURSOR_EMPTY');
    expect(body.error, 'the same reason as the WebSocket').toEqual(
      webSocketAnswer.ok ? undefined : webSocketAnswer.error,
    );
  });

  it('refuses "Tomar" with no rundown at all as 422, the status the map gives the code', async () => {
    // Arrange: a database whose rundowns were lost (the server seeds one, so only damage
    // can leave none).
    const { app } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
      rowsWrittenBeforeTheBoot: [{ name: 'rundowns', json: [] }],
    });

    // Act: press "Tomar".
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/take-next',
      token: companionToken,
    });
    const body = (await response.json()) as { error: unknown };

    // Assert: 422, as RUNDOWN_NOT_FOUND answers everywhere, with the reason in pt-BR.
    expect(response.status, 'RUNDOWN_NOT_FOUND has one status, from the map').toBe(422);
    expect(body.error, 'the reason in pt-BR').toEqual({
      code: 'RUNDOWN_NOT_FOUND',
      message: 'Não há rundown no servidor para tomar o próximo item.',
    });
  });

  it('fires a quick-fire button without moving the rundown’s cursor', async () => {
    // Arrange: a race day with the cursor on the enduro clock.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
    });
    const raceDay = prepareTheRaceDay(stateStore);

    // Act: fire button 1 of "Atalhos", the corner clock.
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/fire-shortcut/atalhos/1',
      token: companionToken,
    });

    // Assert: the corner clock is on air and the cursor stayed on the enduro clock.
    expect(response.status, 'the button press is accepted').toBe(200);
    const slices = stateStore.readAllSlices();
    expect(
      slices.instances.some((instance) => instance.itemId === raceDay.cornerClockItemId),
      'the corner clock is on air',
    ).toBe(true);
    expect(slices.rundowns[0]?.cursorItemId, 'the cursor did not move').toBe(
      raceDay.enduroClockItemId,
    );
  });

  const buttonsThatDoNotExist = [
    // A pad set up for a panel that was deleted or never made.
    {
      name: 'refuses a panel that does not exist',
      path: '/api/v1/fire-shortcut/patrocinio-extra/1',
      expectedError: {
        code: 'QUICK_FIRE_PANEL_NOT_FOUND',
        message: 'O painel de atalhos "patrocinio-extra" não existe.',
      },
    },
    // "Atalhos" holds two buttons; a pad's third key has nothing under it.
    {
      name: 'refuses a button number past the panel’s last button',
      path: '/api/v1/fire-shortcut/atalhos/3',
      expectedError: {
        code: 'QUICK_FIRE_BUTTON_NOT_FOUND',
        message: 'O painel "Atalhos" não tem o botão "3"; seus botões vão de 1 a 2.',
      },
    },
    // Buttons are counted from 1, as the digit keys count them.
    {
      name: 'refuses button 0',
      path: '/api/v1/fire-shortcut/atalhos/0',
      expectedError: {
        code: 'QUICK_FIRE_BUTTON_NOT_FOUND',
        message: 'O painel "Atalhos" não tem o botão "0"; seus botões vão de 1 a 2.',
      },
    },
    // A number written in words, from a hand-typed URL.
    {
      name: 'refuses a button number that is not a number',
      path: '/api/v1/fire-shortcut/atalhos/dois',
      expectedError: {
        code: 'QUICK_FIRE_BUTTON_NOT_FOUND',
        message: 'O painel "Atalhos" não tem o botão "dois"; seus botões vão de 1 a 2.',
      },
    },
  ];

  it.each(buttonsThatDoNotExist)('$name with 422, in pt-BR', async ({ path, expectedError }) => {
    // Arrange: a race day, whose "Atalhos" holds the corner clock and the podium.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
    });
    prepareTheRaceDay(stateStore);
    const slicesBefore = readSlicesExceptTheEventLog(stateStore);

    // Act: press the button in the table.
    const response = await sendApiRequest(app, { method: 'POST', path, token: companionToken });
    const body = (await response.json()) as { error: unknown };

    // Assert: 422 with the reason, and nothing on screen changed.
    expect(response.status, 'a button that does not exist is unprocessable').toBe(422);
    expect(body.error, 'the reason names the panel and the button').toEqual(expectedError);
    expect(readSlicesExceptTheEventLog(stateStore), 'nothing changed').toEqual(slicesBefore);
  });

  it('answers "Parar" with no macro running as ok, changing nothing', async () => {
    // Arrange: a race day with no macro running.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
    });
    prepareTheRaceDay(stateStore);
    const eventLogBefore = stateStore.readAllSlices().eventLog;

    // Act: press "Parar".
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/stop-macro',
      token: companionToken,
    });

    // Assert: ok, and not even an event-log row, as stopMacro of a macro that is not running.
    expect(response.status, 'stopping nothing is not an error').toBe(200);
    expect(stateStore.readAllSlices().eventLog, 'nothing is logged').toEqual(eventLogBefore);
  });
});
