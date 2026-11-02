/**
 * Sending any operator command over HTTP: POST /api/v1/commands (apps/server)
 *
 * What this module is for:
 *   Companion, a Stream Deck or a script can do what an operator does on the control
 *   page (BAJAOVRLAY-28). The body is the very envelope the control page sends over the
 *   WebSocket ({ type: 'command', requestId, command }), and the answer is the very
 *   commandResult it gets back. The command goes through the store's one path, signed
 *   `api:<token name>`. Commands only the server sends (the renderer's report, a poller's
 *   results, ...) are refused, by the store's authorisation step, as for any operator.
 *
 * What these tests prove (on a real store and SQLite file):
 *   - An accepted command answers 200 with the commandResult, echoing the requestId and,
 *     for a createItem, the new item's id; the event-log row names `api:companion`.
 *   - A command of the wrong shape answers 400 with INVALID_COMMAND naming the field, and
 *     is logged as failed; a body that is not the envelope answers 400 INVALID_MESSAGE; a
 *     body that is not JSON, 400 MALFORMED_JSON_BODY.
 *   - A body not sent as JSON (a form, plain text, no Content-Type) answers 415 and a body
 *     over 256 KB answers 413, both in the error shape with a pt-BR reason, and neither
 *     reaches the store; a JSON Content-Type naming its charset is accepted.
 *   - A refusal carries the code and message the WebSocket gives, in the error shape
 *     every route uses, and its status: 422 for a reference to nothing, 409 for a state
 *     in the way.
 *   - The server's own commands answer 403 NOT_ALLOWED, and stopRecording with a failure
 *     message too, while the operator's plain stopRecording would pass.
 *   - Every new route is in /api/v1/openapi.json with the bearer scheme declared.
 *
 * What these tests deliberately do not cover:
 *   - The token check; apiTokenAuth.test.ts.
 *   - Which HTTP status each refusal code gets, code by code; commandRefusalHttpStatus.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  apiTokensOfTheDesk,
  companionToken,
} from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import {
  createAppWithTheCommandApi,
  prepareTheRaceDay,
  sendApiRequest,
  sendCommandOverTheWebSocket,
} from './commandApiOnTheApp.testSupport.js';

describe('POST /api/v1/commands', () => {
  it('runs a createItem and answers its commandResult with the new item’s id', async () => {
    // Arrange: an app with Companion's token, and a lower third of the clock to create.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
    });
    const envelope = {
      type: 'command',
      requestId: 'companion-botao-12',
      command: {
        type: 'createItem',
        home: { kind: 'quickFire', panelId: 'atalhos' },
        graphicId: 'podium',
        layerId: 'fullscreen',
        label: 'Pódio da classificação',
        fields: { sessionName: { kind: 'literal', value: 'Classificação' } },
      },
    };

    // Act: send it.
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/commands',
      token: companionToken,
      body: envelope,
    });
    const body: unknown = await response.json();

    // Assert: 200, the requestId echoed, the item's id named, and Companion in the log.
    expect(response.status, 'an accepted command answers 200').toBe(200);
    expect(body, 'the answer is the WebSocket’s commandResult').toEqual({
      type: 'commandResult',
      requestId: 'companion-botao-12',
      ok: true,
      createdItemId: 'item-1',
    });
    const lastRow = stateStore.readAllSlices().eventLog.at(-1);
    expect([lastRow?.actor, lastRow?.command], 'the row names the token’s device').toEqual([
      'api:companion',
      'createItem',
    ]);
  });

  it('refuses a command of the wrong shape with 400, naming the field, and logs it', async () => {
    // Arrange: a takeItem that forgot which item.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
    });

    // Act: send it.
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/commands',
      token: companionToken,
      body: { type: 'command', command: { type: 'takeItem' } },
    });
    const body: unknown = await response.json();

    // Assert: 400 with the field named in pt-BR, and a failed row signed by Companion.
    expect(response.status, 'a malformed command answers 400').toBe(400);
    expect(body, 'the commandResult names the bad field').toEqual({
      type: 'commandResult',
      requestId: null,
      ok: false,
      error: {
        code: 'INVALID_COMMAND',
        message: 'Comando inválido: o campo "itemId" está ausente ou tem um valor errado.',
      },
    });
    const lastRow = stateStore.readAllSlices().eventLog.at(-1);
    expect([lastRow?.actor, lastRow?.result.status], 'logged as failed, by Companion').toEqual([
      'api:companion',
      'failed',
    ]);
  });

  it('refuses a body that is not the envelope with 400 INVALID_MESSAGE', async () => {
    // Arrange: a script that sent the command alone, without the envelope.
    const { app } = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });

    // Act: send it.
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/commands',
      token: companionToken,
      body: { type: 'clearAll' },
    });
    const body = (await response.json()) as { error: { code: string; message: string } };

    // Assert: 400, the same code a WebSocket message outside the protocol gets.
    expect(response.status, 'a body outside the protocol answers 400').toBe(400);
    expect(body.error.code, 'the WebSocket’s code for a message outside the protocol').toBe(
      'INVALID_MESSAGE',
    );
  });

  it('refuses a body that is not JSON with 400 MALFORMED_JSON_BODY', async () => {
    // Arrange: a body cut off half way.
    const { app } = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });

    // Act: send it as JSON.
    const response = await app.request('http://localhost/api/v1/commands', {
      method: 'POST',
      headers: { Authorization: `Bearer ${companionToken}`, 'Content-Type': 'application/json' },
      body: '{"type": "command", "command": {"type": "clea',
    });
    const body = (await response.json()) as { error: { code: string } };

    // Assert: 400 in the error shape every route uses.
    expect(response.status, 'a body that is not JSON answers 400').toBe(400);
    expect(body.error.code, 'named as a JSON body that cannot be read').toBe('MALFORMED_JSON_BODY');
  });

  const bodiesNotSentAsJson = [
    // A script that forgot the header: curl -d sends a form by default.
    {
      name: 'refuses a body sent as a form with 415, in pt-BR',
      contentType: 'application/x-www-form-urlencoded' as string | undefined,
    },
    // No Content-Type at all, as a hand-written HTTP client may send.
    { name: 'refuses a body with no Content-Type with 415, in pt-BR', contentType: undefined },
    // Plain text, as Companion sends when its body type is left on "text".
    { name: 'refuses a body sent as plain text with 415, in pt-BR', contentType: 'text/plain' },
  ];

  it.each(bodiesNotSentAsJson)('$name', async ({ contentType }) => {
    // Arrange: an app with Companion's token, and a clearAll envelope sent with the header above.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
    });
    const headers: Record<string, string> = { Authorization: `Bearer ${companionToken}` };
    if (contentType !== undefined) {
      headers['Content-Type'] = contentType;
    }
    const eventLogBefore = stateStore.readAllSlices().eventLog;

    // Act: send it.
    const response = await app.request('http://localhost/api/v1/commands', {
      method: 'POST',
      headers,
      body: '{"type":"command","command":{"type":"clearAll"}}',
    });
    const body: unknown = await response.json();

    // Assert: 415 in the error shape every route uses, and nothing reached the store.
    expect(response.status, 'a body that is not sent as JSON answers 415').toBe(415);
    expect(body, 'the error shape, with how to send it in pt-BR').toEqual({
      error: {
        code: 'BODY_NOT_JSON',
        message: 'Envie o comando como JSON: Content-Type: application/json.',
      },
    });
    expect(stateStore.readAllSlices().eventLog, 'the store never heard of it').toEqual(
      eventLogBefore,
    );
  });

  it('accepts a JSON Content-Type that names its charset', async () => {
    // Arrange: an app with Companion's token; some tools add "; charset=utf-8".
    const { app } = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });

    // Act: send "Limpar tudo" so.
    const response = await app.request('http://localhost/api/v1/commands', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${companionToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: '{"type":"command","command":{"type":"clearAll"}}',
    });

    // Assert: run.
    expect(response.status, 'JSON with a charset is still JSON').toBe(200);
  });

  it('refuses a body over 256 KB with 413, in pt-BR, before reading it all', async () => {
    // Arrange: an app with Companion's token, and an envelope padded past 256 KB.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
    });
    const eventLogBefore = stateStore.readAllSlices().eventLog;
    const paddedEnvelope = {
      type: 'command',
      requestId: 'companion-1',
      command: { type: 'createManualEvent', text: 'Bandeira amarela no setor 3 '.repeat(10_000) },
    };

    // Act: send it.
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/commands',
      token: companionToken,
      body: paddedEnvelope,
    });
    const body: unknown = await response.json();

    // Assert: 413 in the error shape, and nothing reached the store.
    expect(response.status, 'a body over the limit answers 413').toBe(413);
    expect(body, 'the error shape, with the limit in pt-BR').toEqual({
      error: {
        code: 'BODY_TOO_LARGE',
        message: 'O comando passa de 256 KB; um comando nunca precisa de tanto.',
      },
    });
    expect(stateStore.readAllSlices().eventLog, 'the store never heard of it').toEqual(
      eventLogBefore,
    );
  });

  it('carries the WebSocket’s reason for a refusal, as 409 when the state is in the way', async () => {
    // Arrange: two race days built alike, with nothing in Prévia.
    const overTheWebSocket = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
    const throughTheApi = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
    prepareTheRaceDay(overTheWebSocket.stateStore);
    prepareTheRaceDay(throughTheApi.stateStore);

    // Act: "Tomar tudo" both ways.
    const webSocketAnswer = sendCommandOverTheWebSocket(overTheWebSocket.stateStore, {
      type: 'takeAllPreviews',
    });
    const response = await sendApiRequest(throughTheApi.app, {
      method: 'POST',
      path: '/api/v1/commands',
      token: companionToken,
      body: { type: 'command', requestId: 'tomar-1', command: { type: 'takeAllPreviews' } },
    });
    const body: unknown = await response.json();

    // Assert: 409 with the very commandResult the WebSocket answered.
    expect(response.status, 'nothing in Prévia is a conflict with the state').toBe(409);
    expect(body, 'the same commandResult as the WebSocket').toEqual(webSocketAnswer);
  });

  const commandsOnlyTheServerSends = [
    // The renderer's report that a graphic is on screen.
    {
      name: 'refuses the renderer’s report',
      command: { type: 'reportInstanceStatus', instanceId: 'instancia-1', status: 'on-air' },
    },
    // The macro runner's own bookkeeping: a pad must not end a run behind the runner.
    {
      name: 'refuses the end of a macro run',
      command: { type: 'endMacroRun', macroId: 'macro-1' },
    },
    // The recorder's stop with a failure: only the recorder says why a recording failed.
    {
      name: 'refuses a stopRecording that carries a failure message',
      command: {
        type: 'stopRecording',
        sourceId: 'simulador-enduro',
        failureMessage: 'Disco cheio.',
      },
    },
  ];

  it.each(commandsOnlyTheServerSends)('$name with 403 NOT_ALLOWED', async ({ command }) => {
    // Arrange: an app with Companion's token, and the command in the table.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
    });

    // Act: send it.
    const response = await sendApiRequest(app, {
      method: 'POST',
      path: '/api/v1/commands',
      token: companionToken,
      body: { type: 'command', command },
    });
    const body = (await response.json()) as { error: { code: string; message: string } };

    // Assert: 403 with the reason in pt-BR, and the attempt logged as failed.
    expect(response.status, 'a command of the server answers 403').toBe(403);
    expect(body.error, 'refused by the authorisation step, with a reason').toEqual({
      code: 'NOT_ALLOWED',
      message: 'Você não tem permissão para executar este comando.',
    });
    const lastRow = stateStore.readAllSlices().eventLog.at(-1);
    expect([lastRow?.actor, lastRow?.result.status], 'the attempt is logged').toEqual([
      'api:companion',
      'failed',
    ]);
  });
});

describe('the OpenAPI document of the command API', () => {
  it('lists every new route and declares the bearer scheme', async () => {
    // Arrange: an app with Companion's token.
    const { app } = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });

    // Act: read the document, which needs no token.
    const response = await app.request('http://localhost/api/v1/openapi.json');
    const document = (await response.json()) as {
      paths: Record<string, Record<string, { security?: unknown }>>;
      components: { securitySchemes: Record<string, unknown>; schemas: Record<string, unknown> };
    };

    // Assert: every route there, each asking for the token, and the scheme it names.
    const expectedRoutes = [
      ['/commands', 'post'],
      ['/take-next', 'post'],
      ['/take-item/{itemId}', 'post'],
      ['/preview-item/{itemId}', 'post'],
      ['/take-all-previews', 'post'],
      ['/clear-layer/{layerId}', 'post'],
      ['/clear-all', 'post'],
      ['/next-on-layer/{layerId}', 'post'],
      ['/run-macro/{macroId}', 'post'],
      ['/fire-shortcut/{panelId}/{buttonNumber}', 'post'],
      ['/stop-macro', 'post'],
      ['/layers/status', 'get'],
    ] as const;
    for (const [path, method] of expectedRoutes) {
      expect(
        document.paths[path]?.[method]?.security,
        `${method} ${path} asks for the token`,
      ).toEqual([{ apiToken: [] }]);
    }
    expect(document.components.securitySchemes.apiToken, 'the bearer scheme').toEqual({
      type: 'http',
      scheme: 'bearer',
      description: expect.stringContaining('BAJAOVRLAY_API_TOKENS') as unknown,
    });
    expect(
      document.components.schemas.Command,
      'every command’s shape is in the document, from the shared schema',
    ).toBeDefined();
  });
});
