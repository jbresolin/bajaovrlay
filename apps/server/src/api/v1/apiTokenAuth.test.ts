/**
 * The token in front of the command API (apps/server)
 *
 * What this module is for:
 *   Every route of the command API (POST /api/v1/commands, the button shortcuts and GET
 *   /api/v1/layers/status, BAJAOVRLAY-28) asks for `Authorization: Bearer <token>`, one
 *   token per device, listed in BAJAOVRLAY_API_TOKENS. With the variable unset the API is
 *   off. A token is a secret: it is never logged nor echoed; the log carries the device's
 *   name and the request id.
 *
 * What these tests prove (POST /api/v1/clear-all on a real store, with the enduro clock on air):
 *   - The auth table, one named row each: no variable (403 with how to turn it on), no
 *     header, a wrong token, a malformed header (401), the right one of two, and a token
 *     pasted with spaces around it in the variable (200, the device named in the log).
 *   - The other API routes ask for the token too, and the read routes that came before
 *     (GET /state) do not.
 *   - No log line, of any request in the table, contains a token; the line of an
 *     accepted command names the device and the request id, and the warning of a refused
 *     token carries the request id and never the token that was sent.
 *
 * What these tests deliberately do not cover:
 *   - Reading the variable and the header in every form; apiTokens.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  apiTokensOfTheDesk,
  companionToken,
  streamDeckToken,
  wrongToken,
} from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import {
  applyOrThrow,
  createAppWithTheCommandApi,
  operatorActor,
  prepareTheRaceDay,
  sendApiRequest,
} from './commandApiOnTheApp.testSupport.js';

const authScenarios = [
  // The default install: nobody set a token, so the API says how to turn it on.
  {
    name: 'answers 403 with how to turn the API on when the variable is not set',
    apiTokensVariable: undefined,
    request: { token: companionToken },
    expectedStatus: 403,
    expectedError: {
      code: 'API_TURNED_OFF',
      message:
        'API de comandos desligada: defina BAJAOVRLAY_API_TOKENS, ou BAJAOVRLAY_API_OPEN=true numa rede só do estúdio.',
    },
    expectedLastActor: operatorActor,
  },
  // Companion's button saved without the header.
  {
    name: 'answers 401 to a request with no Authorization header',
    apiTokensVariable: apiTokensOfTheDesk,
    request: {},
    expectedStatus: 401,
    expectedError: {
      code: 'API_TOKEN_REFUSED',
      message: 'Token de API ausente ou errado: envie Authorization: Bearer <token>.',
    },
    expectedLastActor: operatorActor,
  },
  // A token from an old .env, or a typo.
  {
    name: 'answers 401 to a wrong token',
    apiTokensVariable: apiTokensOfTheDesk,
    request: { token: wrongToken },
    expectedStatus: 401,
    expectedError: {
      code: 'API_TOKEN_REFUSED',
      message: 'Token de API ausente ou errado: envie Authorization: Bearer <token>.',
    },
    expectedLastActor: operatorActor,
  },
  // The second device of two: every listed token is checked, not just the first.
  {
    name: 'accepts the right token of the second of two devices',
    apiTokensVariable: apiTokensOfTheDesk,
    request: { token: streamDeckToken },
    expectedStatus: 200,
    expectedError: undefined,
    expectedLastActor: 'api:streamdeck',
  },
  // The token sent as a user and password, which this API does not speak.
  {
    name: 'answers 401 to a malformed Authorization header',
    apiTokensVariable: apiTokensOfTheDesk,
    request: { authorization: `Basic ${companionToken}` },
    expectedStatus: 401,
    expectedError: {
      code: 'API_TOKEN_REFUSED',
      message: 'Token de API ausente ou errado: envie Authorization: Bearer <token>.',
    },
    expectedLastActor: operatorActor,
  },
  // The token pasted into .env with a space on each side.
  {
    name: 'accepts a token pasted with spaces around it in the variable',
    apiTokensVariable: `companion=  ${companionToken}  `,
    request: { token: companionToken },
    expectedStatus: 200,
    expectedError: undefined,
    expectedLastActor: 'api:companion',
  },
];

describe('the token check of the command API', () => {
  it.each(authScenarios)('$name', async (scenario) => {
    // Arrange: an app with the variable in the table, a recording logger, and the enduro
    // clock on air, so "Limpar tudo" has something to clear.
    const { logger, readRecordedLines } = createRecordingLogger();
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: scenario.apiTokensVariable,
      logger,
    });
    const raceDay = prepareTheRaceDay(stateStore);
    applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.enduroClockItemId });

    // Act: press "Limpar tudo" with the header in the table.
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/clear-all',
      ...scenario.request,
    });
    const body = (await response.json()) as { error?: unknown };

    // Assert: the status, the error, who the store saw, and no token in the log.
    expect(response.status, 'the status the table expects').toBe(scenario.expectedStatus);
    expect(body.error, 'the pt-BR reason the table expects').toEqual(scenario.expectedError);
    // A refused request never reaches the store: the last row is still the operator's take.
    const lastRow = stateStore.readAllSlices().eventLog.at(-1);
    expect(lastRow?.actor, 'the store hears only from an accepted token').toBe(
      scenario.expectedLastActor,
    );
    const everyLogLine = JSON.stringify(readRecordedLines());
    expect(everyLogLine, 'no log line carries Companion’s token').not.toContain(companionToken);
    expect(everyLogLine, 'no log line carries the Stream Deck’s token').not.toContain(
      streamDeckToken,
    );
  });

  it('answers 401 with the scheme named, as HTTP asks of a refused bearer token', async () => {
    // Arrange: an app with two devices.
    const { app } = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });

    // Act: send no header.
    const response = await sendApiRequest(app, { method: 'POST', path: '/api/v1/clear-all' });

    // Assert: the WWW-Authenticate header names Bearer.
    expect(response.headers.get('www-authenticate'), 'the scheme to use').toBe('Bearer');
  });

  it('asks for the token on GET /layers/status and POST /commands too', async () => {
    // Arrange: an app with two devices.
    const { app } = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });

    // Act: call both without a header.
    const statusResponse = await sendApiRequest(app, {
      method: 'GET',
      path: '/api/v1/layers/status',
    });
    const commandsResponse = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/commands',
      body: { type: 'command', command: { type: 'clearAll' } },
    });

    // Assert: both refused.
    expect(statusResponse.status, 'the status feed needs the token').toBe(401);
    expect(commandsResponse.status, 'the command route needs the token').toBe(401);
  });

  it('leaves GET /state open, as before the command API', async () => {
    // Arrange: an app with two devices.
    const { app } = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });

    // Act: read the state without a header, as the control page does.
    const response = await sendApiRequest(app, { method: 'GET', path: '/api/v1/state' });

    // Assert: answered.
    expect(response.status, 'the read routes keep working without a token').toBe(200);
  });

  it('logs an accepted command with the device’s name and the request id, never the token', async () => {
    // Arrange: an app with two devices and a recording logger.
    const { logger, readRecordedLines } = createRecordingLogger();
    const { app } = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk, logger });

    // Act: press "Limpar tudo" with Companion's token.
    await sendApiRequest(app, { method: 'POST', path: '/api/v1/clear-all', token: companionToken });

    // Assert: a line names Companion and the request, and no line holds the token.
    const commandLine = readRecordedLines().find((line) => line.message === 'api command answered');
    expect(commandLine?.api_token_name, 'the line names the device').toBe('companion');
    expect(commandLine?.request_id, 'the line carries the request id').toEqual(expect.any(String));
    expect(commandLine?.command, 'the line names the command').toBe('clearAll');
    expect(JSON.stringify(readRecordedLines()), 'no line carries the token').not.toContain(
      companionToken,
    );
  });
  it('logs a refused token with the request id, never the token that was sent', async () => {
    // Arrange: an app with two devices and a recording logger, and Companion's token with
    // its last character changed, as a typo in Companion's header field would leave it.
    const { logger, readRecordedLines } = createRecordingLogger();
    const { app } = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk, logger });
    const mistypedToken = `${companionToken.slice(0, -1)}0`;

    // Act: press "Limpar tudo" with it.
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/clear-all',
      token: mistypedToken,
    });

    // Assert: 401, one warn line with the request id, and neither token in any line.
    expect(response.status, 'a wrong token answers 401').toBe(401);
    const refusalLine = readRecordedLines().find(
      (line) => line.message === 'api request refused: missing, malformed or wrong token',
    );
    expect(refusalLine?.level, 'the refusal is a warning').toBe('warn');
    expect(refusalLine?.request_id, 'the line carries the request id').toEqual(expect.any(String));
    expect(refusalLine?.has_authorization_header, 'the line says a header came').toBe(true);
    const everyLogLine = JSON.stringify(readRecordedLines());
    expect(everyLogLine, 'no line carries the token that was sent').not.toContain(mistypedToken);
    expect(everyLogLine, 'no line carries the real token either').not.toContain(companionToken);
  });
});
