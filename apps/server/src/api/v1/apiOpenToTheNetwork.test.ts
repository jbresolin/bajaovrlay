/**
 * The command API open to the studio network, with no token (apps/server)
 *
 * What this module is for:
 *   João's buttons are Ulanzi D200s, where every button carries its own HTTP headers, so
 *   typing a token into each one does not work. The API runs only on the dedicated studio
 *   network, where the control page has no login either (PINs are M4). So
 *   BAJAOVRLAY_API_OPEN=true turns the command API on with no token (BAJAOVRLAY-28, item 9):
 *   a call without an Authorization header is signed `api:rede`, and the log line of each
 *   such call carries the address it came from, so a stray press can be traced.
 *
 * What these tests prove (on a real store, the enduro clock on air):
 *   - Open, "Limpar tudo" with no header is accepted and signed `api:rede`, and its log line
 *     names the client's address.
 *   - Open, GET /layers/status and POST /commands answer with no header too.
 *   - Open with tokens set as well, a token is still accepted and signed with its device's
 *     name, and a wrong token is still refused (401), not taken as `rede`.
 *   - With neither variable, the API stays off (403), the reason naming both variables.
 *   - Open, the server's own commands are still refused, as for any operator.
 *
 * What these tests deliberately do not cover:
 *   - Reading BAJAOVRLAY_API_OPEN at boot; readServerEnvironment.test.ts.
 *   - The token table itself; apiTokenAuth.test.ts.
 *   - The boot log's warning; commandApiAccessAtBoot.test.ts in core/apiAccess.
 */
import { describe, expect, it } from 'vitest';

import {
  apiTokensOfTheDesk,
  companionToken,
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

/** The address of the D200 on the studio network, as the socket reports it. */
const addressOfTheUlanziOnTheStudioNetwork = '192.168.50.21';

describe('the command API open to the studio network', () => {
  it('accepts "Limpar tudo" with no header and signs it api:rede', async () => {
    // Arrange: the API open with no token at all, and the enduro clock on air.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: undefined,
      isApiOpenToTheNetwork: true,
    });
    const raceDay = prepareTheRaceDay(stateStore);
    applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.enduroClockItemId });

    // Act: the D200's button posts with no header and no body.
    const response = await sendApiRequest(app, { method: 'POST', path: '/api/v1/clear-all' });

    // Assert: accepted, "Limpar tudo" applied, and the network named as who did it.
    expect(response.status, 'an open API answers a call with no header').toBe(200);
    const lastRow = stateStore.readAllSlices().eventLog.at(-1);
    expect([lastRow?.command, lastRow?.result.status], 'the clear-all was applied').toEqual([
      'clearAll',
      'ok',
    ]);
    expect(lastRow?.actor, 'a call with no token is signed by the network').toBe('api:rede');
  });

  it('logs the address an open call came from', async () => {
    // Arrange: the API open, a recording logger, and the clock on air.
    const { logger, readRecordedLines } = createRecordingLogger();
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: undefined,
      isApiOpenToTheNetwork: true,
      logger,
    });
    const raceDay = prepareTheRaceDay(stateStore);
    applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.enduroClockItemId });

    // Act: the D200 at its studio address presses "Limpar tudo".
    await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/clear-all',
      clientAddress: addressOfTheUlanziOnTheStudioNetwork,
    });

    // Assert: one line says the call came without a token, from that address.
    const openCallLine = readRecordedLines().find(
      (line) => line.message === 'api request accepted without a token: the API is open',
    );
    expect(openCallLine?.client_ip, 'the line names the address of the button').toBe(
      addressOfTheUlanziOnTheStudioNetwork,
    );
    expect(openCallLine?.request_id, 'the line carries the request id').toEqual(expect.any(String));
  });

  it('answers GET /layers/status and POST /commands with no header too', async () => {
    // Arrange: the API open with no token.
    const { app } = createAppWithTheCommandApi({
      apiTokensVariable: undefined,
      isApiOpenToTheNetwork: true,
    });

    // Act: read the status feed and send a command, both without a header.
    const statusResponse = await sendApiRequest(app, {
      method: 'GET',
      path: '/api/v1/layers/status',
    });
    const status = (await statusResponse.json()) as { tokenName: string };
    const commandsResponse = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/commands',
      body: { type: 'command', command: { type: 'clearAll' } },
    });

    // Assert: both answered, the feed naming the network as who asked.
    expect(statusResponse.status, 'the status feed is open').toBe(200);
    expect(status.tokenName, 'the feed names the network as the caller').toBe('rede');
    expect(commandsResponse.status, 'the command route is open').toBe(200);
  });

  it('still accepts a token alongside and signs the call with its device', async () => {
    // Arrange: the API open, Companion and the Stream Deck still listed, the clock on air.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
      isApiOpenToTheNetwork: true,
    });
    const raceDay = prepareTheRaceDay(stateStore);
    applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.enduroClockItemId });

    // Act: Companion presses "Limpar tudo" with its token.
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/clear-all',
      token: companionToken,
    });

    // Assert: accepted and signed by Companion, not by the network.
    expect(response.status, 'a token still works in the open mode').toBe(200);
    const lastRow = stateStore.readAllSlices().eventLog.at(-1);
    expect(lastRow?.actor, 'a call with a token is signed by its device').toBe('api:companion');
  });

  it('still refuses a wrong token rather than taking it as the network', async () => {
    // Arrange: the API open with the desk's tokens, and the clock on air.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
      isApiOpenToTheNetwork: true,
    });
    const raceDay = prepareTheRaceDay(stateStore);
    applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.enduroClockItemId });

    // Act: a device with an old token presses "Limpar tudo".
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/clear-all',
      token: wrongToken,
    });

    // Assert: 401, so the device's owner sees the token is wrong, and the store heard nothing.
    expect(response.status, 'a wrong token is refused even when the API is open').toBe(401);
    const lastRow = stateStore.readAllSlices().eventLog.at(-1);
    expect(lastRow?.actor, 'the last row is still the operator’s take').toBe(operatorActor);
  });

  it('stays off with neither variable set, naming both in the reason', async () => {
    // Arrange: an install that set neither the tokens nor the open mode.
    const { app } = createAppWithTheCommandApi({
      apiTokensVariable: undefined,
      isApiOpenToTheNetwork: false,
    });

    // Act: a button posts with no header.
    const response = await sendApiRequest(app, { method: 'POST', path: '/api/v1/clear-all' });
    const body = (await response.json()) as { error: unknown };

    // Assert: 403, with both ways to turn the API on.
    expect(response.status, 'the API is off unless one variable turns it on').toBe(403);
    expect(body.error, 'the reason names both variables').toEqual({
      code: 'API_TURNED_OFF',
      message:
        'API de comandos desligada: defina BAJAOVRLAY_API_TOKENS, ou BAJAOVRLAY_API_OPEN=true numa rede só do estúdio.',
    });
  });

  it('still refuses the server’s own commands when open', async () => {
    // Arrange: the API open with no token.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: undefined,
      isApiOpenToTheNetwork: true,
    });

    // Act: send the renderer's report, which only the renderer may send.
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/commands',
      body: {
        type: 'command',
        command: { type: 'reportInstanceStatus', instanceId: 'instancia-1', status: 'on-air' },
      },
    });
    const body = (await response.json()) as { error: { code: string } };

    // Assert: 403 NOT_ALLOWED from the store's authorisation step, logged as the network's.
    expect(response.status, 'a command of the server answers 403').toBe(403);
    expect(body.error.code, 'refused as for any operator').toBe('NOT_ALLOWED');
    const lastRow = stateStore.readAllSlices().eventLog.at(-1);
    expect([lastRow?.actor, lastRow?.result.status], 'the attempt is logged').toEqual([
      'api:rede',
      'failed',
    ]);
  });
});
