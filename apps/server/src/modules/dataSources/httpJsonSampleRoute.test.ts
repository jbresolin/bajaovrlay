/**
 * POST /api/v1/data-sources/http-json/sample-request (apps/server)
 *
 * What this module is for:
 *   "Buscar da fonte" on the flex source form. The operator is writing a mapping and
 *   wants to see what the timing system really sends: the page posts one request of the
 *   config, and the server fetches it once, with the same fetch code, caps and pt-BR
 *   errors as a poll, and answers the parsed JSON. It changes nothing: it is a read, not
 *   a command, so it writes no event-log row. A header read from a BAJAOVRLAY_SOURCE_
 *   variable is filled in on the server, so the token never reaches the browser.
 *
 * What these tests prove (a real HTTP server on 127.0.0.1 and a random port, real fetch,
 * a real store on a temporary SQLite file):
 *   - A timing system that answers gives back its status and its JSON, as parsed.
 *   - A source that fails gives back the poll's own pt-BR sentence (a 503, a 404 page, a
 *     body that is not JSON, a variable not set), still as a 200 of the route; one that
 *     answered outside 2xx also gives back that status, and its body when it is JSON, so
 *     a page can tell one refusal from another (gate 2 of PR #38).
 *   - A source that never answers is given up on after the route's timeout (10 s on the
 *     server, shortened here), with "Tempo esgotado" and the seconds.
 *   - A header from a variable is sent with its value, which is in neither the answer nor
 *     any log line.
 *   - Nothing is written: no event-log row, the slices as they were.
 *   - A request the config schema refuses answers 400 with that schema's pt-BR reason.
 *   - A body that is not JSON at all answers 400 in JSON with a pt-BR message.
 *   - The OpenAPI document describes the route.
 *
 * What these tests deliberately do not cover:
 *   - Each failure of a fetch (the 5 MB cap, a refused connection, redirects): the
 *     adapter's tests, which run the same fetchHttpJsonRequest.
 *   - BAJAOVRLAY_SOURCE_ALLOWED_HOSTS: httpJsonSampleRouteHostAllowlist.test.ts. Every
 *     test here runs on a list that allows the test timing system (127.0.0.1).
 *   - The page's "Buscar da fonte" button (apps/control).
 */
import { HttpJsonSampleAnswerSchema } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { countEventLogRows } from '../../core/db/eventLogRowStorage.js';
import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import {
  readExampleTimingSystemResponse,
  startTimingSystemTestServer,
  type TimingSystemAnswer,
} from './adapters/httpJson/timingSystemTestServer.testSupport.js';
import {
  buildClassificationRequestAt,
  createServerAppForSampleRequests,
  postSampleRequest,
  sampleRoutePath,
} from './httpJsonSampleRoute.testSupport.js';

describe('POST /api/v1/data-sources/http-json/sample-request', () => {
  it('answers the timing system status and its JSON, parsed', async () => {
    // Arrange: the fictional timing system answering its race classification.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const { app } = createServerAppForSampleRequests();

    // Act: "Buscar da fonte" on the request "classificacao".
    const answer = await postSampleRequest(app, buildClassificationRequestAt(timingSystem.baseUrl));

    // Assert: a 200 holding ok, the 200 of the timing system and its body as it was sent.
    expect(answer.status, 'the route must answer 200 OK').toBe(200);
    expect(
      HttpJsonSampleAnswerSchema.safeParse(answer.body).success,
      'the answer must be a sample answer the page can read',
    ).toBe(true);
    expect(answer.body, 'the answer must carry the status and the parsed body').toEqual({
      ok: true,
      status: 200,
      body: readExampleTimingSystemResponse(),
    });
    expect(
      timingSystem.readRequestsReceived().map((received) => received.pathWithQuery),
      'the timing system must have been asked once, with the query parameter',
    ).toEqual(['/cronometragem/classificacao?etapa=nacional-2027']);
  });

  const failingSourceScenarios: Array<{
    name: string;
    timingSystemAnswer: TimingSystemAnswer;
    headers: Array<{ name: string; value?: string; valueFromEnvironment?: string }>;
    expectedAnswer: Record<string, unknown>;
  }> = [
    // The timing system is up but its own backend is not: the status and its name, and the
    // JSON it answered, which tells one refusal from another (the Baja app's "wrong_type").
    {
      name: 'answers the poll error and the JSON body for a 503 of the timing system',
      timingSystemAnswer: { kind: 'json', status: 503, body: { erro: 'em manutenção' } },
      headers: [],
      expectedAnswer: {
        ok: false,
        error: 'A fonte respondeu 503 (Service Unavailable) em classificacao',
        answerOutside2xx: { status: 503, body: { erro: 'em manutenção' } },
      },
    },
    // A proxy's HTML error page: the status alone, since there is no JSON to hand on.
    {
      name: 'answers the poll error and the status alone for a 404 page that is not JSON',
      timingSystemAnswer: {
        kind: 'text',
        status: 404,
        text: '<html><body>Não encontrado</body></html>',
        contentType: 'text/html; charset=utf-8',
      },
      headers: [],
      expectedAnswer: {
        ok: false,
        error: 'A fonte respondeu 404 (Not Found) em classificacao',
        answerOutside2xx: { status: 404 },
      },
    },
    // An HTML error page with a 200: the operator learns the body is not JSON.
    {
      name: 'answers the poll error for a body that is not JSON',
      timingSystemAnswer: {
        kind: 'text',
        text: '<html><body>Cronometragem fora do ar</body></html>',
        contentType: 'text/html; charset=utf-8',
      },
      headers: [],
      expectedAnswer: { ok: false, error: 'A resposta de classificacao não é JSON válido' },
    },
    // A token header naming a variable the server does not have: the variable is named.
    {
      name: 'answers the poll error for a variable not set on the server',
      timingSystemAnswer: { kind: 'json', body: readExampleTimingSystemResponse() },
      headers: [{ name: 'Authorization', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_TOKEN' }],
      expectedAnswer: {
        ok: false,
        error: 'A variável de ambiente BAJAOVRLAY_SOURCE_BAJA_TOKEN não está definida no servidor.',
      },
    },
  ];

  it.each(failingSourceScenarios)(
    '$name',
    async ({ timingSystemAnswer, headers, expectedAnswer }) => {
      // Arrange: the timing system answering the way this row sets up, no variable set.
      const timingSystem = await startTimingSystemTestServer();
      timingSystem.answer('/cronometragem/classificacao', timingSystemAnswer);
      const { app } = createServerAppForSampleRequests();

      // Act: "Buscar da fonte" on the request "classificacao", with this row's headers.
      const answer = await postSampleRequest(app, {
        ...buildClassificationRequestAt(timingSystem.baseUrl),
        headers,
      });

      // Assert: a 200 of the route carrying the same pt-BR sentence a poll would give, and
      // what the source answered outside 2xx when it answered at all.
      expect(answer.status, 'a failing source is still a 200 of the route').toBe(200);
      expect(answer.body, 'the answer must carry the poll error in pt-BR').toEqual(expectedAnswer);
      expect(
        HttpJsonSampleAnswerSchema.safeParse(answer.body).success,
        'the answer must be a sample answer the page can read',
      ).toBe(true);
    },
  );

  it('gives up on a timing system that never answers after the timeout', async () => {
    // Arrange: a timing system that takes the connection and never answers, and a server
    // whose sample timeout is a quarter of a second instead of 10 s, to keep the test short.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', { kind: 'neverAnswers' });
    const { app } = createServerAppForSampleRequests({ sampleRequestTimeoutInMilliseconds: 250 });

    // Act: "Buscar da fonte" on the request "classificacao".
    const answer = await postSampleRequest(app, buildClassificationRequestAt(timingSystem.baseUrl));

    // Assert: "Tempo esgotado", naming the request and the seconds waited.
    expect(answer.body, 'the answer must say the timing system did not answer in time').toEqual({
      ok: false,
      error: 'Tempo esgotado: classificacao não respondeu em 0,25 s.',
    });
  });

  it('sends a header read from a variable, and the value reaches no answer and no log line', async () => {
    // Arrange: the timing system answering, the token in the server's environment, and a
    // logger that keeps every line.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const { logger, readRecordedLines } = createRecordingLogger();
    const { app } = createServerAppForSampleRequests({
      environment: { BAJAOVRLAY_SOURCE_BAJA_TOKEN: 'Bearer token-secreto-da-baja-9f2c' },
      logger,
    });

    // Act: "Buscar da fonte" on a request whose token header names the variable.
    const answer = await postSampleRequest(app, {
      ...buildClassificationRequestAt(timingSystem.baseUrl),
      headers: [{ name: 'Authorization', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_TOKEN' }],
    });

    // Assert: the timing system got the token; the answer and the log lines do not hold it.
    const [requestReceived] = timingSystem.readRequestsReceived();
    expect(
      requestReceived?.headers.authorization,
      'the server must fill the header in from its own environment',
    ).toBe('Bearer token-secreto-da-baja-9f2c');
    expect(
      JSON.stringify(answer.body),
      'the answer the page reads must not hold the token',
    ).not.toContain('token-secreto');
    expect(readRecordedLines().length, 'the request must have been logged').toBeGreaterThan(0);
    expect(JSON.stringify(readRecordedLines()), 'no log line may hold the token').not.toContain(
      'token-secreto',
    );
  });

  it('writes no event-log row and leaves every slice as it was', async () => {
    // Arrange: the timing system answering, and the store's event log and slices as they
    // are before the request.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const { app, database, stateStore } = createServerAppForSampleRequests();
    const eventLogRowsBefore = countEventLogRows(database);
    const slicesBefore = stateStore.readAllSlices();

    // Act: "Buscar da fonte" on the request "classificacao".
    await postSampleRequest(app, buildClassificationRequestAt(timingSystem.baseUrl));

    // Assert: the event log has no new row, and the slices are the very same.
    expect(
      countEventLogRows(database),
      'fetching a sample is a read: it must write no event-log row',
    ).toBe(eventLogRowsBefore);
    expect(stateStore.readAllSlices(), 'fetching a sample must change no state').toEqual(
      slicesBefore,
    );
  });

  it('answers 400 with the config schema reason for an address that is not http', async () => {
    // Arrange: a server app; the request points at an FTP address, which a config refuses.
    const { app } = createServerAppForSampleRequests();

    // Act: "Buscar da fonte" on that request.
    const answer = await postSampleRequest(app, {
      requestId: 'classificacao',
      url: 'ftp://cronometragem.local/classificacao.json',
    });

    // Assert: 400 with a stable code and the same pt-BR sentence the form shows.
    expect(answer.status, 'a request the schema refuses must answer 400').toBe(400);
    expect(answer.body, 'the refusal must carry the schema reason in pt-BR').toEqual({
      error: {
        code: 'INVALID_SAMPLE_REQUEST',
        message:
          'O endereço "ftp://cronometragem.local/classificacao.json" precisa começar com http:// ou https://.',
      },
    });
  });

  it('answers 400 in JSON with a pt-BR message for a body that is not valid JSON', async () => {
    // Arrange: a server app, and a body cut off in the middle, as a page bug could send.
    const { app } = createServerAppForSampleRequests();
    const bodyCutOffInTheMiddle = '{"requestId": "classificacao",';

    // Act: post that body, saying it is JSON.
    const response = await app.request(sampleRoutePath, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: bodyCutOffInTheMiddle,
    });
    const body: unknown = await response.json();

    // Assert: 400 with a stable code and a pt-BR message, not Hono's plain English line.
    expect(response.status, 'a body that is not JSON must answer 400').toBe(400);
    expect(
      response.headers.get('content-type'),
      'the refusal must be JSON so the control page can parse it',
    ).toContain('application/json');
    expect(body, 'the refusal must carry a stable code and a pt-BR message').toEqual({
      error: {
        code: 'MALFORMED_JSON_BODY',
        message: 'O corpo da requisição não é JSON válido.',
      },
    });
  });
});

describe('the OpenAPI document', () => {
  it('describes the sample route with its request body', async () => {
    // Arrange: the server app.
    const { app } = createServerAppForSampleRequests();

    // Act: ask for the generated OpenAPI document.
    const response = await app.request('/api/v1/openapi.json');
    const document = (await response.json()) as {
      paths: Record<
        string,
        { post?: { requestBody?: { content?: Record<string, unknown> }; responses?: object } }
      >;
    };
    const sampleRoute = document.paths['/data-sources/http-json/sample-request'];

    // Assert: the route is in it as a POST taking JSON, with its 200 and 400 answers.
    expect(sampleRoute?.post, 'the sample route must be described as a POST').toBeDefined();
    expect(
      Object.keys(sampleRoute?.post?.requestBody?.content ?? {}),
      'the request body must be described as JSON',
    ).toEqual(['application/json']);
    expect(
      Object.keys(sampleRoute?.post?.responses ?? {}),
      'the 200 and the 400 answers must be described',
    ).toEqual(['200', '400']);
  });
});
