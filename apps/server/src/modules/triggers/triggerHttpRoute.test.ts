/**
 * POST /api/v1/triggers/:triggerId: an HTTP trigger called by a device (apps/server)
 *
 * What this module is for:
 *   An HTTP trigger (BAJAOVRLAY-48) is fired by a call to its address, from a D200 through
 *   Companion, a script or another machine, with the command API's access (a token, or the
 *   open mode). The call's optional flat JSON body is the trigger's data. The route answers
 *   in the command API's shape: 200 when the trigger fired, 400 for a body that is not
 *   flat or is over 8 KB, 404 for an id that is no HTTP trigger, 409 when the trigger may
 *   not fire now (off, paused, within its interval), each with a pt-BR reason.
 *
 * What these tests prove, on the real app, store, macro runner and trigger service:
 *   - a call with { "nome": "Ana Souza" } puts the lower third on air with her name, and
 *     the firing names the device as its cause;
 *   - a call with no body fires with no data;
 *   - a nested body and a body over 8 KB answer 400 and fire nothing;
 *   - an unknown id, and the id of a scene trigger, answer 404;
 *   - a paused call answers 409 saying so, as does a second press within the interval;
 *   - with the command API off the route answers 403, and a wrong token 401.
 *
 * What these tests deliberately do not cover:
 *   - The access check itself, which every command route shares; apiTokenAuth.test.ts.
 *   - The real network socket; the app is called in memory through app.request().
 */
import { describe, expect, it } from 'vitest';

import { sendApiRequest } from '../../api/v1/commandApiOnTheApp.testSupport.js';
import { parseApiTokens } from '../../core/apiAccess/apiTokens.js';
import { d200Token } from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import { createServerApp } from '../../core/http/createServerApp.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { operatorLoginOff } from '../../core/operatorLogin/operatorLoginOff.testSupport.js';
import {
  applyAsTheOperatorOrThrow,
  createTrigger,
  interviewInTheBoxMacroId,
  interviewNameFromTheTriggerSteps,
  readDataOnAirOnLayer,
  readFirings,
  startTriggersOnTheStore,
  type TriggersOnTheStore,
} from './triggersOnTheStore.testSupport.js';

/** The app on a trigger store, with the D200's token, or with the command API off. */
function createAppOnTheTriggerStore(
  triggersOnTheStore: TriggersOnTheStore,
  apiAccess: 'd200Token' | 'apiOff' = 'd200Token',
) {
  const apiTokensVariable = apiAccess === 'd200Token' ? `d200=${d200Token}` : undefined;
  const parsing = parseApiTokens(apiTokensVariable);
  if (!parsing.isValid) {
    throw new Error(`the test's tokens are refused: ${parsing.problem}`);
  }
  return createServerApp({
    operatorLogin: operatorLoginOff,
    logger: createLogger({ level: 'silent' }),
    version: '0.3.1',
    stateStore: triggersOnTheStore.store,
    apiTokens: parsing.apiTokens,
    isApiOpenToTheNetwork: false,
  });
}

/** Starts the store with "Entrevista no box" filling the name, and its HTTP trigger. */
function startWithTheInterviewButton() {
  const triggersOnTheStore = startTriggersOnTheStore({
    macroSteps: { [interviewInTheBoxMacroId]: interviewNameFromTheTriggerSteps },
  });
  const triggerId = createTrigger(triggersOnTheStore.store, {
    name: 'Entrevista pelo D200',
    when: { kind: 'http' },
    macroId: interviewInTheBoxMacroId,
    mode: 'auto',
  });
  const app = createAppOnTheTriggerStore(triggersOnTheStore);
  return { ...triggersOnTheStore, triggerId, app };
}

/** Sends a call to the trigger's address as Companion's HTTP module does, with a raw body. */
async function callTheTrigger(
  app: ReturnType<typeof createAppOnTheTriggerStore>,
  triggerId: string,
  bodyText?: string,
  token: string | undefined = d200Token,
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== undefined) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return await app.request(`http://localhost/api/v1/triggers/${triggerId}`, {
    method: 'POST',
    headers,
    body: bodyText,
  });
}

describe('a call that fires', () => {
  it('puts the lower third on air with the name the body carried', async () => {
    // Arrange: the interview button's trigger.
    const { store, passTime, triggerId, app } = startWithTheInterviewButton();

    // Act: the D200 sends Ana Souza's name, and the runner gets its turn.
    const response = await callTheTrigger(app, triggerId, '{ "nome": "Ana Souza" }');
    passTime(100);

    // Assert: 200, her name on air, and the firing caused by the D200.
    expect(response.status, 'a trigger that fired answers 200').toBe(200);
    expect(
      readDataOnAirOnLayer(store, 'lower-third'),
      'the lower third must show the name the call carried',
    ).toEqual({ name: 'Ana Souza', role: 'Entrevista' });
    const firingRow = store
      .readAllSlices()
      .eventLog.find((entry) => entry.command === 'fireTrigger');
    expect(firingRow?.payload, 'the log row must name the device as the cause').toMatchObject({
      causedBy: 'api:d200',
      data: { nome: 'Ana Souza' },
    });
  });

  it('fires with no data when the call has no body', async () => {
    // Arrange: a trigger that asks, so nothing runs.
    const triggersOnTheStore = startTriggersOnTheStore();
    const triggerId = createTrigger(triggersOnTheStore.store, {
      name: 'Botão do intervalo',
      when: { kind: 'http' },
      macroId: interviewInTheBoxMacroId,
    });
    const app = createAppOnTheTriggerStore(triggersOnTheStore);

    // Act: the button sends nothing but the call.
    const response = await callTheTrigger(app, triggerId);

    // Assert: fired, with empty data.
    expect(response.status, 'a call with no body fires').toBe(200);
    expect(
      readFirings(triggersOnTheStore.store).map((firing) => firing.data),
      'one firing, with no data',
    ).toEqual([{}]);
  });
});

describe('a call that is refused', () => {
  const refusedCalls = [
    // A script that sends an object inside: the data must stay flat.
    {
      name: 'answers 400 to a nested body',
      bodyText: '{ "piloto": { "nome": "Ana Souza" } }',
      expectedStatus: 400,
      expectedError: {
        code: 'INVALID_TRIGGER_BODY',
        message:
          'O campo "piloto" precisa ser texto ou número (objetos, listas, true/false e null não são aceitos).',
      },
    },
    // 9 000 letters is past 8 KB.
    {
      name: 'answers 400 to a body over 8 KB',
      bodyText: JSON.stringify({ nome: 'a'.repeat(9_000) }),
      expectedStatus: 400,
      expectedError: {
        code: 'INVALID_TRIGGER_BODY',
        message: 'O corpo da chamada passa de 8 KB.',
      },
    },
  ];

  it.each(refusedCalls)('$name', async ({ bodyText, expectedStatus, expectedError }) => {
    // Arrange: the interview button's trigger.
    const { store, triggerId, app } = startWithTheInterviewButton();

    // Act: the call with this row's body.
    const response = await callTheTrigger(app, triggerId, bodyText);

    // Assert: refused with the reason, and nothing fired.
    expect(response.status, 'a body that is not flat or too big is refused').toBe(expectedStatus);
    expect(await response.json(), 'the answer says why, in pt-BR').toMatchObject({
      ok: false,
      error: expectedError,
    });
    expect(readFirings(store), 'nothing may fire').toEqual([]);
  });

  it('answers 404 to an unknown id and to the id of a trigger that is not HTTP', async () => {
    // Arrange: a scene trigger beside the interview button.
    const { store, app } = startWithTheInterviewButton();
    const sceneTriggerId = createTrigger(store, {
      name: 'Entrou no box',
      when: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
      macroId: interviewInTheBoxMacroId,
    });

    // Act: one call to an id nobody has, one to the scene trigger.
    const unknownResponse = await callTheTrigger(app, 'gatilho-apagado');
    const sceneResponse = await callTheTrigger(app, sceneTriggerId);

    // Assert: both 404, the second saying it is no HTTP trigger.
    expect(
      [unknownResponse.status, sceneResponse.status],
      'only an HTTP trigger has an address',
    ).toEqual([404, 404]);
    expect(await sceneResponse.json(), 'the answer says the trigger is not HTTP').toMatchObject({
      error: {
        code: 'TRIGGER_NOT_FOUND',
        message: 'O gatilho "Entrou no box" não é um gatilho HTTP.',
      },
    });
  });

  it('answers 409 while paused, and to a second press within the interval', async () => {
    // Arrange: the interview button's trigger, in a rehearsal with triggers paused.
    const { store, passTime, triggerId, app } = startWithTheInterviewButton();
    applyAsTheOperatorOrThrow(store, { type: 'setTriggersPaused', isPaused: true });

    // Act: a press while paused; then unpaused, two presses 3 s apart.
    const whilePaused = await callTheTrigger(app, triggerId, '{ "nome": "Ana Souza" }');
    applyAsTheOperatorOrThrow(store, { type: 'setTriggersPaused', isPaused: false });
    await callTheTrigger(app, triggerId, '{ "nome": "Ana Souza" }');
    passTime(3_000);
    const tooSoon = await callTheTrigger(app, triggerId, '{ "nome": "Bruno Lima" }');

    // Assert: 409 both times, each saying why.
    expect(await whilePaused.json(), 'paused, the press must say so').toMatchObject({
      error: { code: 'TRIGGER_NOT_FIRED', message: 'Os gatilhos estão pausados.' },
    });
    expect(tooSoon.status, 'a press within the interval is refused').toBe(409);
    expect(await tooSoon.json(), 'and says how long to wait').toMatchObject({
      error: {
        code: 'TRIGGER_NOT_FIRED',
        message:
          'O gatilho "Entrevista pelo D200" disparou há menos de 10 s; espere o intervalo mínimo.',
      },
    });
  });
});

describe('access', () => {
  it('answers 403 with the command API off, and 401 to a wrong token', async () => {
    // Arrange: the same trigger on an app with no tokens, and on one with the D200's.
    const triggersOnTheStore = startTriggersOnTheStore();
    const triggerId = createTrigger(triggersOnTheStore.store, {
      name: 'Botão do intervalo',
      when: { kind: 'http' },
      macroId: interviewInTheBoxMacroId,
    });
    const appWithTheApiOff = createAppOnTheTriggerStore(triggersOnTheStore, 'apiOff');
    const appWithTokens = createAppOnTheTriggerStore(triggersOnTheStore);

    // Act: a call to each, the second with an old token.
    const offResponse = await sendApiRequest(appWithTheApiOff, {
      method: 'POST',
      path: `/api/v1/triggers/${triggerId}`,
    });
    const wrongTokenResponse = await callTheTrigger(
      appWithTokens,
      triggerId,
      undefined,
      'token-antigo-0000000000',
    );

    // Assert: 403 and 401, and nothing fired.
    expect(
      [offResponse.status, wrongTokenResponse.status],
      'the trigger address has the command API’s access',
    ).toEqual([403, 401]);
    expect(readFirings(triggersOnTheStore.store), 'nothing may fire').toEqual([]);
  });
});
