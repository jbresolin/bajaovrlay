// Test support: the imaginary timing system of the flex source example, served for real on
// a free local port by a small node:http server that a test starts and stops, so the real
// BajaOvrLay server polls it over HTTP exactly as it would poll a timing system on the
// event LAN. The test decides what it answers next: a response (the example's, or one it
// changed) or a 500 for a timing system that has broken. What it answers is kept inside
// the one server the test started; nothing is shared between tests.
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

// The fictional example (packages/shared/src/flexMapping/examples): the response of an
// imaginary timing system with 20 made-up cars, and the preset that maps it.
const exampleFolder = new URL(
  '../../../packages/shared/src/flexMapping/examples/',
  import.meta.url,
);
const exampleResponsePath = fileURLToPath(
  new URL('timing-system-like.response.json', exampleFolder),
);
const exampleConfigPath = fileURLToPath(new URL('timing-system-like.config.json', exampleFolder));

// The one address the example config reads ("classificacao"); any other path is a 404,
// so a config pointed at the wrong place fails loudly instead of reading this answer.
const classificacaoPath = '/cronometragem/classificacao';

/** One car of the example response, as the imaginary timing system writes it. */
type ExampleCar = Record<string, unknown> & { equipe: string };

/** The example response: its "classificacao" list, in race order, and its other keys. */
export type ExampleTimingSystemResponse = Record<string, unknown> & {
  classificacao: ExampleCar[];
};

/** What the test server answers next: a JSON response, or a 500 with no data. */
type NextAnswer = { kind: 'response'; response: unknown } | { kind: 'serverError' };

/** A started test timing system: its address, how to change its answer, and how to stop it. */
export type TimingSystemTestServer = {
  /** The full URL of its "classificacao" endpoint, for the request of the flex config. */
  classificacaoAddress: string;
  /** From the next request on, answers 200 with this response. */
  answerWithResponse: (response: unknown) => void;
  /** From the next request on, answers 500 (Internal Server Error) with no data. */
  answerWithServerError: () => void;
  /** Stops listening and closes the connections still open. */
  stop: () => Promise<void>;
};

/** Reads the example response from its file: a fresh copy the test may change. */
export function readExampleTimingSystemResponse(): ExampleTimingSystemResponse {
  return JSON.parse(readFileSync(exampleResponsePath, 'utf8')) as ExampleTimingSystemResponse;
}

/**
 * Reads the example config and points its one request at `classificacaoAddress`, then
 * writes it as the text an operator pastes into "Importar configuração".
 */
export function writeExampleConfigPointedAt(classificacaoAddress: string): string {
  const config = JSON.parse(readFileSync(exampleConfigPath, 'utf8')) as {
    requests: { url: string }[];
  };
  for (const request of config.requests) {
    request.url = classificacaoAddress;
  }
  return JSON.stringify(config, null, 2);
}

/**
 * Starts the test timing system on a free port of 127.0.0.1, answering `firstResponse`
 * until the test changes it. Resolves once it is listening.
 */
export async function startTimingSystemTestServer(
  firstResponse: unknown,
): Promise<TimingSystemTestServer> {
  let nextAnswer: NextAnswer = { kind: 'response', response: firstResponse };

  const server: Server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== classificacaoPath) {
      response.writeHead(404).end();
      return;
    }
    if (nextAnswer.kind === 'serverError') {
      response.writeHead(500, { 'content-type': 'text/plain' }).end('falha interna');
      return;
    }
    response
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify(nextAnswer.response));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    classificacaoAddress: `http://127.0.0.1:${port}${classificacaoPath}`,
    answerWithResponse: (response) => {
      nextAnswer = { kind: 'response', response };
    },
    answerWithServerError: () => {
      nextAnswer = { kind: 'serverError' };
    },
    stop: () => {
      // The real server polls with keep-alive; without closing those, close() would wait.
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
