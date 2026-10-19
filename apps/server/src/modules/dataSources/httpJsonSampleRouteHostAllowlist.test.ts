/**
 * The sample route and BAJAOVRLAY_SOURCE_ALLOWED_HOSTS (apps/server)
 *
 * What this module is for:
 *   "Buscar da fonte" runs the poll's own fetch code, so it obeys the same host list: a
 *   sample must not become a way to send a BAJAOVRLAY_SOURCE_ secret to an address an
 *   operator typed, even though it writes nothing and sends no command.
 *
 * What these tests prove (a real HTTP server on 127.0.0.1 and a random port, real fetch):
 *   - The proven exfiltration case: a secret header and a secret query value to a host
 *     off the list answer the pt-BR refusal naming the host, and that host receives
 *     nothing.
 *   - With no list, a request naming a variable is refused in pt-BR and nothing is sent,
 *     while one with typed values only is fetched from any host.
 *
 * What these tests deliberately do not cover:
 *   - That no refusal to a host off the list (or with no list) tells which variables
 *     exist, and how an entry matches a host: the
 *     adapter's httpJsonHostAllowlist.test.ts and sourceHostAllowlist.test.ts.
 *   - The route's other answers: httpJsonSampleRoute.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { noSourceHostAllowlist } from './adapters/httpJson/sourceHostAllowlist.js';
import {
  readExampleTimingSystemResponse,
  startTimingSystemTestServer,
} from './adapters/httpJson/timingSystemTestServer.testSupport.js';
import {
  allowlistOfTheLanTimingSystemOnly,
  buildClassificationRequestAt,
  createServerAppForSampleRequests,
  postSampleRequest,
} from './httpJsonSampleRoute.testSupport.js';

describe('POST /api/v1/data-sources/http-json/sample-request and the host list', () => {
  it('refuses to send a secret header and query value to a host off BAJAOVRLAY_SOURCE_ALLOWED_HOSTS', async () => {
    // Arrange: a server listening for whatever it is sent (on 127.0.0.1), and a server
    // app whose list allows the LAN timing system only, with both secrets set.
    const collector = await startTimingSystemTestServer();
    collector.answer('/recebe', { kind: 'json', body: readExampleTimingSystemResponse() });
    const { app } = createServerAppForSampleRequests({
      environment: {
        BAJAOVRLAY_SOURCE_BAJA_TOKEN: 'Bearer token-secreto-da-baja-9f2c',
        BAJAOVRLAY_SOURCE_BAJA_CHAVE: 'chave-secreta-7d41',
      },
      sourceHostAllowlist: allowlistOfTheLanTimingSystemOnly,
    });
    const collectorHost = new URL(collector.baseUrl).host;

    // Act: "Buscar da fonte" on a request to the listening server naming both secrets.
    const answer = await postSampleRequest(app, {
      requestId: 'classificacao',
      url: `${collector.baseUrl}/recebe`,
      headers: [{ name: 'Authorization', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_TOKEN' }],
      queryParameters: [{ name: 'chave', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_CHAVE' }],
    });

    // Assert: the refusal names the host, and the listening server received nothing.
    expect(answer.body, 'the answer must say the host is not on the list').toEqual({
      ok: false,
      error: `O servidor não busca dados em ${collectorHost} (classificacao): esse endereço não está em BAJAOVRLAY_SOURCE_ALLOWED_HOSTS.`,
    });
    expect(
      collector.readRequestsReceived(),
      'a host off the list must receive nothing, no token and no key',
    ).toEqual([]);
  });

  it('refuses a request naming a variable when no BAJAOVRLAY_SOURCE_ALLOWED_HOSTS is set', async () => {
    // Arrange: the timing system answering, and a server app with no list and the token set.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const { app } = createServerAppForSampleRequests({
      environment: { BAJAOVRLAY_SOURCE_BAJA_TOKEN: 'Bearer token-secreto-da-baja-9f2c' },
      sourceHostAllowlist: noSourceHostAllowlist,
    });

    // Act: "Buscar da fonte" on a request whose token header names the variable.
    const answer = await postSampleRequest(app, {
      ...buildClassificationRequestAt(timingSystem.baseUrl),
      headers: [{ name: 'Authorization', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_TOKEN' }],
    });

    // Assert: refused in pt-BR, and nothing was sent.
    expect(answer.body, 'the answer must say a variable needs the list').toEqual({
      ok: false,
      error:
        'A requisição classificacao usa uma variável de ambiente, mas BAJAOVRLAY_SOURCE_ALLOWED_HOSTS não está definida no servidor; sem essa lista, nenhum valor de variável é enviado.',
    });
    expect(timingSystem.readRequestsReceived(), 'nothing may be sent').toEqual([]);
  });

  it('fetches a request with typed values only from any host when no list is set', async () => {
    // Arrange: the timing system answering, and a server app with no list.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const { app } = createServerAppForSampleRequests({
      sourceHostAllowlist: noSourceHostAllowlist,
    });

    // Act: "Buscar da fonte" on the request "classificacao" (typed header and query only).
    const answer = await postSampleRequest(app, buildClassificationRequestAt(timingSystem.baseUrl));

    // Assert: the timing system's JSON came back.
    expect(answer.body, 'the answer must carry the parsed body').toEqual({
      ok: true,
      status: 200,
      body: readExampleTimingSystemResponse(),
    });
  });
});
