// Test support for the httpJson adapter: a real HTTP server on 127.0.0.1 and a random
// port, standing in for an imaginary timing system. Each address answers the way the test
// set it up (a JSON body, a status, a body that never ends, no answer at all), and every
// request it received is kept, headers included, so a test can check what was sent. The
// server and every connection are closed when the test ends. The example preset (the
// fictional timing system of packages/shared/src/flexMapping/examples/) is read from here.
import { readFileSync } from 'node:fs';
import { createServer, type IncomingHttpHeaders, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { type HttpJsonConfig, HttpJsonConfigSchema } from '@bajaovrlay/shared';
import { onTestFinished } from 'vitest';

/** How one address answers. */
export type TimingSystemAnswer =
  | { kind: 'json'; status?: number; body: unknown }
  | { kind: 'text'; status?: number; text: string; contentType?: string }
  | { kind: 'redirect'; location: string }
  | { kind: 'bodyThatNeverEnds' }
  | { kind: 'neverAnswers' };

/** One request the test server received: its path with the query, and its headers. */
export type RequestReceived = { pathWithQuery: string; headers: IncomingHttpHeaders };

/** The running test server. */
export type TimingSystemTestServer = {
  /** "http://127.0.0.1:<port>", with no slash at the end. */
  baseUrl: string;
  /** Sets how `path` (no query) answers from now on. An address never set answers 404. */
  answer: (path: string, answer: TimingSystemAnswer) => void;
  readRequestsReceived: () => RequestReceived[];
};

// A chunk of 64 KB of spaces: a body made of them is valid JSON whitespace, so only its
// size can make it fail, never its content.
const sixtyFourKilobytesOfSpaces = ' '.repeat(64 * 1024);

/** Starts the test server on a random port; it closes, with every connection, when the test ends. */
export async function startTimingSystemTestServer(): Promise<TimingSystemTestServer> {
  const answersByPath = new Map<string, TimingSystemAnswer>();
  const requestsReceived: RequestReceived[] = [];

  const server = createServer((request, response) => {
    const pathWithQuery = request.url ?? '/';
    requestsReceived.push({ pathWithQuery, headers: request.headers });
    const path = new URL(pathWithQuery, 'http://127.0.0.1').pathname;
    const answer = answersByPath.get(path);
    if (answer === undefined) {
      writeJson(response, 404, { erro: 'endereço desconhecido' });
      return;
    }
    answerAsSetUp(response, answer);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  onTestFinished(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${String(port)}`,
    answer: (path, answer) => {
      answersByPath.set(path, answer);
    },
    readRequestsReceived: () => [...requestsReceived],
  };
}

/** Writes the answer the test set up for an address. */
function answerAsSetUp(response: ServerResponse, answer: TimingSystemAnswer): void {
  switch (answer.kind) {
    case 'json':
      writeJson(response, answer.status ?? 200, answer.body);
      return;
    case 'text':
      response.writeHead(answer.status ?? 200, {
        'content-type': answer.contentType ?? 'text/plain; charset=utf-8',
      });
      response.end(answer.text);
      return;
    case 'redirect':
      response.writeHead(302, { location: answer.location });
      response.end();
      return;
    case 'bodyThatNeverEnds':
      writeABodyThatNeverEnds(response);
      return;
    case 'neverAnswers':
      // Nothing is written, ever: the connection stays open until the client gives up.
      return;
  }
}

/** Writes a JSON body with its status. */
function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

/**
 * Starts a JSON answer and keeps sending spaces for as long as the client reads, as a
 * runaway endpoint would; it stops when the client hangs up.
 */
function writeABodyThatNeverEnds(response: ServerResponse): void {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  response.write('{"classificacao": [');
  const writeMoreWhenDrained = () => {
    while (!response.destroyed && response.write(sixtyFourKilobytesOfSpaces)) {
      // Keep writing until the socket's buffer is full, then wait for 'drain'.
    }
  };
  response.on('drain', writeMoreWhenDrained);
  writeMoreWhenDrained();
}

/** Reads the example preset's fictional timing-system response, as the file has it. */
export function readExampleTimingSystemResponse(): unknown {
  const responseUrl = new URL(
    '../../../../../../../packages/shared/src/flexMapping/examples/timing-system-like.response.json',
    import.meta.url,
  );
  return JSON.parse(readFileSync(responseUrl, 'utf8'));
}

/**
 * Reads the example preset's config and points its one request at `url` (the test
 * server), parsed with the full config schema as the store would keep it.
 */
export function readExampleConfigPointedAt(url: string): HttpJsonConfig {
  const configUrl = new URL(
    '../../../../../../../packages/shared/src/flexMapping/examples/timing-system-like.config.json',
    import.meta.url,
  );
  const exampleConfig = HttpJsonConfigSchema.parse(JSON.parse(readFileSync(configUrl, 'utf8')));
  const requests = exampleConfig.requests.map((request) => ({ ...request, url }));
  return { ...exampleConfig, requests };
}

/**
 * Finds a port on 127.0.0.1 that nobody listens on: it opens a server on a random port and
 * closes it again, so a connection there is refused, as with a timing system switched off.
 */
export async function findAPortNobodyListensOn(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
