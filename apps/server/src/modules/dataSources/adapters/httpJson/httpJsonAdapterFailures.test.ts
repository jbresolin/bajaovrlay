/**
 * The httpJson adapter when a request fails (apps/server)
 *
 * What this module is for:
 *   A flex source reads an address someone else runs, so it must fail clearly and
 *   safely: the operator reads one pt-BR sentence naming the request that failed, the
 *   poll stops when the poller's signal fires, and a runaway endpoint cannot fill the
 *   server's memory (the body is read as a stream and dropped at 5 MB). No retry happens
 *   inside a poll: the poller's fixed rhythm is the retry.
 *
 * What these tests prove (a real HTTP server on 127.0.0.1 and a random port, real fetch),
 * each with the operator's exact sentence:
 *   - an answer outside 2xx: "A fonte respondeu 503 (Service Unavailable) em classificacao";
 *   - a body that is not JSON: "A resposta de classificacao não é JSON válido";
 *   - a body over 5 MB, and one that never ends, cut at the cap: "A resposta de
 *     classificacao passou de 5 MB"; a body of exactly 5 MB still passes;
 *   - a connection refused: "Não consegui conectar a 127.0.0.1:<port> (classificacao):
 *     conexão recusada";
 *   - a server that never answers: the poll rejects as soon as its signal fires, and
 *     through the poller the operator reads its "Tempo esgotado" message;
 *   - a redirect is not followed (the headers, a token among them, stay with the address
 *     the operator typed): it is an answer outside 2xx.
 *
 * What these tests deliberately do not cover:
 *   - Good polls, two requests and environment variables: httpJsonAdapter.test.ts.
 *   - The poller's rhythm and stale watch: poller*.test.ts in the data-source module.
 */
import type { HttpJsonDataSource } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../../../../core/logger/createLogger.js';
import { pollTheSourceIntoAPollResult } from '../../pollResultRecording.js';
import { createHttpJsonAdapter } from './httpJsonAdapter.js';
import {
  findAPortNobodyListensOn,
  readExampleConfigPointedAt,
  readExampleTimingSystemResponse,
  startTimingSystemTestServer,
  type TimingSystemAnswer,
} from './timingSystemTestServer.testSupport.js';

/** 14:24 UTC on Saturday 20 March 2027, the moment every poll here is made at. */
const pollMomentMs = Date.parse('2027-03-20T17:24:01.000Z');

/** 5 MB, the most a response may be, counted in bytes. */
const responseCapInBytes = 5_000_000;

/** The adapter as the server builds it, silent, with no variable set. */
function createSilentAdapter() {
  return createHttpJsonAdapter({
    logger: createLogger({ level: 'silent' }),
    readEnvironmentVariable: () => undefined,
  });
}

/** A poll context at the poll moment, with a signal that never fires. */
function buildPollContextThatNeverTimesOut() {
  return {
    readCurrentTime: () => new Date(pollMomentMs),
    signal: new AbortController().signal,
  };
}

/** Starts the timing system answering its classification as `answer`, and the preset pointed at it. */
async function startTimingSystemAnswering(answer: TimingSystemAnswer) {
  const timingSystem = await startTimingSystemTestServer();
  timingSystem.answer('/cronometragem/classificacao', answer);
  const config = readExampleConfigPointedAt(`${timingSystem.baseUrl}/cronometragem/classificacao`);
  return { timingSystem, config };
}

/** Runs a poll that must fail, and gives back its pt-BR error message. */
async function captureThePollError(polling: Promise<unknown>): Promise<string> {
  try {
    await polling;
  } catch (pollError) {
    return pollError instanceof Error ? pollError.message : String(pollError);
  }
  throw new Error('the poll was expected to fail, and it answered');
}

describe('an answer the adapter cannot use', () => {
  it('names the status and the request when the answer is outside 2xx', async () => {
    // Arrange: the timing system in maintenance, answering 503.
    const { config } = await startTimingSystemAnswering({
      kind: 'json',
      status: 503,
      body: { erro: 'manutenção' },
    });

    // Act: poll once.
    const error = await captureThePollError(
      createSilentAdapter().pollOnce(config, buildPollContextThatNeverTimesOut()),
    );

    // Assert: the operator reads the status, its name and the request.
    expect(error, 'a 503 must be named with its status and request').toBe(
      'A fonte respondeu 503 (Service Unavailable) em classificacao',
    );
  });

  it('says the answer is not JSON when the body is an HTML error page', async () => {
    // Arrange: a proxy in front of the timing system answering 200 with an HTML page.
    const { config } = await startTimingSystemAnswering({
      kind: 'text',
      text: '<html><body>Bem-vindo à rede do autódromo</body></html>',
      contentType: 'text/html; charset=utf-8',
    });

    // Act: poll once.
    const error = await captureThePollError(
      createSilentAdapter().pollOnce(config, buildPollContextThatNeverTimesOut()),
    );

    // Assert: the operator reads that the body is not JSON.
    expect(error, 'a body that is not JSON must say so, naming the request').toBe(
      'A resposta de classificacao não é JSON válido',
    );
  });

  it('does not follow a redirect, so the headers stay with the address the operator typed', async () => {
    // Arrange: the timing system redirecting its classification to another address.
    const { timingSystem, config } = await startTimingSystemAnswering({
      kind: 'redirect',
      location: '/cronometragem/classificacao-nova',
    });
    timingSystem.answer('/cronometragem/classificacao-nova', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });

    // Act: poll once.
    const error = await captureThePollError(
      createSilentAdapter().pollOnce(config, buildPollContextThatNeverTimesOut()),
    );

    // Assert: the 302 is the answer, and the new address was never asked.
    const pathsAsked = timingSystem.readRequestsReceived().map((request) => request.pathWithQuery);
    expect(error, 'a redirect must be an answer outside 2xx').toBe(
      'A fonte respondeu 302 (Found) em classificacao',
    );
    expect(pathsAsked, 'the redirect target must not be fetched').toEqual([
      '/cronometragem/classificacao',
    ]);
  });
});

describe('the 5 MB cap', () => {
  it('fails a body one byte over 5 MB', async () => {
    // Arrange: the example response padded with spaces to 5 MB and one byte.
    const exampleText = JSON.stringify(readExampleTimingSystemResponse());
    const exampleSizeInBytes = Buffer.byteLength(exampleText, 'utf8');
    const paddedText = exampleText + ' '.repeat(responseCapInBytes + 1 - exampleSizeInBytes);
    const { config } = await startTimingSystemAnswering({ kind: 'text', text: paddedText });

    // Act: poll once.
    const error = await captureThePollError(
      createSilentAdapter().pollOnce(config, buildPollContextThatNeverTimesOut()),
    );

    // Assert: refused for its size.
    expect(error, 'a body over 5 MB must be refused, naming the request').toBe(
      'A resposta de classificacao passou de 5 MB',
    );
  });

  it('still reads a body of exactly 5 MB', async () => {
    // Arrange: the example response padded with spaces to exactly 5 MB, counted in bytes
    // (its accented team names take two bytes each).
    const exampleText = JSON.stringify(readExampleTimingSystemResponse());
    const exampleSizeInBytes = Buffer.byteLength(exampleText, 'utf8');
    const paddedText = exampleText + ' '.repeat(responseCapInBytes - exampleSizeInBytes);
    const { config } = await startTimingSystemAnswering({ kind: 'text', text: paddedText });

    // Act: poll once.
    const answer = await createSilentAdapter().pollOnce(
      config,
      buildPollContextThatNeverTimesOut(),
    );

    // Assert: read and mapped.
    expect(Object.keys(answer.shapes), 'a body at the cap must still be read').toEqual([
      'positions',
      'session',
    ]);
  });

  it('cuts a body that never ends at the cap instead of reading it forever', async () => {
    // Arrange: a runaway endpoint that keeps sending once it started answering.
    const { config } = await startTimingSystemAnswering({ kind: 'bodyThatNeverEnds' });

    // Act: poll once, with no timeout to save it.
    const error = await captureThePollError(
      createSilentAdapter().pollOnce(config, buildPollContextThatNeverTimesOut()),
    );

    // Assert: stopped at the cap, with the size sentence.
    expect(error, 'an endless body must be cut at 5 MB').toBe(
      'A resposta de classificacao passou de 5 MB',
    );
  });
});

describe('no answer at all', () => {
  it('names the host, the request and the reason when the connection is refused', async () => {
    // Arrange: the preset pointed at a port nobody listens on, as with the timing system off.
    const closedPort = await findAPortNobodyListensOn();
    const config = readExampleConfigPointedAt(
      `http://127.0.0.1:${String(closedPort)}/cronometragem/classificacao`,
    );

    // Act: poll once.
    const error = await captureThePollError(
      createSilentAdapter().pollOnce(config, buildPollContextThatNeverTimesOut()),
    );

    // Assert: the operator reads where it tried and why it could not.
    expect(error, 'a refused connection must name host, request and reason').toBe(
      `Não consegui conectar a 127.0.0.1:${String(closedPort)} (classificacao): conexão recusada`,
    );
  });

  it('stops as soon as the signal fires when the server never answers', async () => {
    // Arrange: a timing system that accepts the connection and never answers, and a signal fired after 200 ms.
    const { config } = await startTimingSystemAnswering({ kind: 'neverAnswers' });
    const abortController = new AbortController();
    setTimeout(() => abortController.abort(), 200);
    const startedAtMs = Date.now();

    // Act: poll once.
    const error = await captureThePollError(
      createSilentAdapter().pollOnce(config, {
        readCurrentTime: () => new Date(pollMomentMs),
        signal: abortController.signal,
      }),
    );

    // Assert: the poll gave up within a second of the signal, saying it ran out of time.
    const elapsedMs = Date.now() - startedAtMs;
    expect(error, 'a poll called off must say it ran out of time').toBe(
      'Tempo esgotado: classificacao não respondeu a tempo.',
    );
    expect(elapsedMs, 'the poll must stop when its signal fires, not later').toBeLessThan(1_200);
  });

  it("is recorded with the poller's own Tempo esgotado message", async () => {
    // Arrange: the same silent timing system, as a source the poller polls with a 200 ms timeout.
    const { config } = await startTimingSystemAnswering({ kind: 'neverAnswers' });
    const source: HttpJsonDataSource = {
      id: 'cronometragem-classificacao',
      label: 'Cronometragem — Classificação',
      kind: 'httpJson',
      config,
      pollIntervalMs: 2_000,
      isEnabled: true,
      isRecording: false,
      status: {
        lastError: null,
        consecutiveFailures: 0,
        isStale: false,
        staleAfterMs: 6_000,
        recordingError: null,
      },
    };
    const abortController = new AbortController();
    setTimeout(() => abortController.abort(), 200);

    // Act: poll it the way the poller does.
    const pollResult = await pollTheSourceIntoAPollResult({
      source,
      adapters: { httpJson: createSilentAdapter() },
      readCurrentTime: () => new Date(pollMomentMs),
      signal: abortController.signal,
      timeoutInMilliseconds: 200,
    });

    // Assert: a failed poll with the poller's timeout sentence.
    expect(pollResult, "the operator must read the poller's timeout message").toEqual({
      ok: false,
      error: 'Tempo esgotado: a fonte não respondeu em 0,2 s.',
      attemptedAtMs: pollMomentMs,
    });
  });
});
