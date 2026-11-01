// Test support: a stand-in for the Baja app's results API (api.bajasaebrasil.net), served
// for real on a free local port by a small node:http server that a test starts and stops,
// so the real BajaOvrLay server reads it over HTTP exactly as it reads the API. It answers
// the shared fixtures of packages/shared/src/flexMapping/examples/bajaApp for 26BR: the
// made-up event during its competition, its real teams, overall table and Super Prime, and
// the API doc's race ten minutes in as its Enduro. The test may change the race's answer.
// Everything is kept inside the one server the test started; nothing is shared.
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

// The fixtures, beside the shared mapping that reads them.
const fixtureFolder = new URL(
  '../../../packages/shared/src/flexMapping/examples/bajaApp/',
  import.meta.url,
);

/** Reads one fixture as the API answered it: a fresh copy the test may change. */
export function readBajaAppFixture(fileName: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(fileName, fixtureFolder), 'utf8')) as Record<
    string,
    unknown
  >;
}

/**
 * Writes one request as the server matches it: the endpoint and its query parameters in
 * name order ("corrida.php?evt=26BR&p=END"), so the order the source sends them in does
 * not matter, while a wrong event or prova is a 404, as on the API.
 */
function writeRequestKey(endpoint: string, searchParameters: URLSearchParams): string {
  const sortedParameters = [...searchParameters.entries()].sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB),
  );
  return `${endpoint}?${new URLSearchParams(sortedParameters).toString()}`;
}

/** A started stand-in of the API: its address, how to change the race, and how to stop it. */
export type BajaAppTestServer = {
  /** What the operator types as "Endereço da API": `http://127.0.0.1:<port>`. */
  apiAddress: string;
  /** From the next request on, corrida.php of 26BR's Enduro answers this race. */
  answerRaceWith: (race: unknown) => void;
  /** Stops listening and closes the connections still open. */
  stop: () => Promise<void>;
};

/** Starts the stand-in on a free port of 127.0.0.1; resolves once it is listening. */
export async function startBajaAppTestServer(): Promise<BajaAppTestServer> {
  const answersByRequest = new Map<string, unknown>([
    ['evento.php?evt=26BR', readBajaAppFixture('evento-26BR-during-the-event.made-up.json')],
    ['equipes.php?evt=26BR', readBajaAppFixture('equipes-26BR.json')],
    ['corrida.php?evt=26BR&p=END', readBajaAppFixture('corrida-00NE_ZZL.from-doc.json')],
    ['resultado.php?evt=26BR&id=26BR_GER', readBajaAppFixture('resultado-26BR_GER.json')],
    ['torneio.php?evt=26BR&id=26BR_SPR', readBajaAppFixture('torneio-26BR_SPR.json')],
  ]);

  const server: Server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const endpoint = requestUrl.pathname.replace(/^\/resultados\//, '');
    const answer = answersByRequest.get(writeRequestKey(endpoint, requestUrl.searchParams));
    if (request.method !== 'GET' || answer === undefined) {
      // The API's own shape of an error, so a wrong address fails loudly.
      response
        .writeHead(404, { 'content-type': 'application/json' })
        .end(JSON.stringify({ error: { code: 'not_found', message: 'Not found' } }));
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(answer));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    apiAddress: `http://127.0.0.1:${String(port)}`,
    answerRaceWith: (race) => {
      answersByRequest.set('corrida.php?evt=26BR&p=END', race);
    },
    stop: () => {
      // The real server polls with keep-alive; without closing those, close() would wait.
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
