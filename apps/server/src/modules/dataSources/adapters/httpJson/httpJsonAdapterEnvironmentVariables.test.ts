/**
 * The httpJson adapter: values from environment variables (apps/server)
 *
 * What this module is for:
 *   A token is never written in a flex source's config, which every operator's browser
 *   and the event log see: a header or query parameter names a BAJAOVRLAY_SOURCE_
 *   variable instead, and the adapter reads it from the server's environment at every
 *   poll. The value goes to fetch and nowhere else. Every test here runs on a server
 *   whose BAJAOVRLAY_SOURCE_ALLOWED_HOSTS lists 127.0.0.1, where the test timing system
 *   listens: without that list no variable's value is sent at all.
 *
 * What these tests prove (a real HTTP server on 127.0.0.1 and a random port, real fetch):
 *   - A header and a query parameter named by a variable are sent with its value, and
 *     that value is in no log line.
 *   - The variable is read at every poll, so a changed token is sent from the next poll.
 *   - A variable not set fails the poll in pt-BR, naming it, and nothing is sent.
 *   - A variable holding a line break, or a character fetch refuses (an emoji), fails the
 *     poll by the variable's name, never quoting its value and never blaming the network.
 *
 * What these tests deliberately do not cover:
 *   - Which variable names a config may use (the BAJAOVRLAY_SOURCE_ prefix): the config
 *     schema's tests in packages/shared.
 *   - A host off the list, or no list at all: httpJsonHostAllowlist.test.ts.
 *   - Good polls and the failures of a request: httpJsonAdapter.test.ts and
 *     httpJsonAdapterFailures.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { createLogger } from '../../../../core/logger/createLogger.js';
import { createRecordingLogger } from '../../../../core/logger/recordingLogger.testSupport.js';
import { createHttpJsonAdapter } from './httpJsonAdapter.js';
import type { SourceHostAllowlist } from './sourceHostAllowlist.js';
import {
  readExampleConfigPointedAt,
  readExampleTimingSystemResponse,
  startTimingSystemTestServer,
} from './timingSystemTestServer.testSupport.js';

/** 14:24:01 in Brasília (17:24:01 UTC) on Saturday 20 March 2027, the moment every poll here is made at. */
const pollMomentMs = Date.parse('2027-03-20T17:24:01.000Z');

/** BAJAOVRLAY_SOURCE_ALLOWED_HOSTS=127.0.0.1: the test timing system, on any port. */
const allowlistOfTheTestTimingSystem: SourceHostAllowlist = {
  isSet: true,
  allowedHosts: [{ hostName: '127.0.0.1', port: undefined }],
};

/** A poll context at the poll moment, with a signal that never fires. */
function buildPollContextThatNeverTimesOut() {
  return {
    readCurrentTime: () => new Date(pollMomentMs),
    signal: new AbortController().signal,
  };
}

/** The adapter as the server builds it, silent, reading variables from `environment`. */
function createAdapterReading(environment: Record<string, string>) {
  return createHttpJsonAdapter({
    logger: createLogger({ level: 'silent' }),
    readEnvironmentVariable: (name) => environment[name],
    sourceHostAllowlist: allowlistOfTheTestTimingSystem,
  });
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

describe('values from environment variables', () => {
  /** The example preset, sending a token header and a key in the query from variables. */
  function buildConfigWithSecrets(baseUrl: string) {
    const exampleConfig = readExampleConfigPointedAt(`${baseUrl}/cronometragem/classificacao`);
    const requests = exampleConfig.requests.map((request) => ({
      ...request,
      headers: [
        { name: 'Accept', value: 'application/json' },
        { name: 'Authorization', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_TOKEN' },
      ],
      queryParameters: [
        { name: 'etapa', value: 'nacional 2027' },
        { name: 'chave', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_CHAVE' },
      ],
    }));
    return { ...exampleConfig, requests };
  }

  it('sends the variable values and writes them in no log line', async () => {
    // Arrange: the timing system answering, two secrets in the environment, a logger that keeps every line.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const { logger, readRecordedLines } = createRecordingLogger();
    const adapter = createHttpJsonAdapter({
      logger,
      sourceHostAllowlist: allowlistOfTheTestTimingSystem,
      readEnvironmentVariable: (name) =>
        ({
          BAJAOVRLAY_SOURCE_BAJA_TOKEN: 'Bearer token-secreto-da-baja-9f2c',
          BAJAOVRLAY_SOURCE_BAJA_CHAVE: 'chave-secreta-7d41',
        })[name],
    });

    // Act: poll once.
    await adapter.pollOnce(
      buildConfigWithSecrets(timingSystem.baseUrl),
      buildPollContextThatNeverTimesOut(),
    );

    // Assert: the server received both values, and no log line holds either of them.
    const [requestReceived] = timingSystem.readRequestsReceived();
    const everyLogLineAsText = JSON.stringify(readRecordedLines());
    expect(requestReceived?.headers.authorization, 'the token must be sent as the header').toBe(
      'Bearer token-secreto-da-baja-9f2c',
    );
    expect(requestReceived?.headers.accept, 'a typed value must be sent as written').toBe(
      'application/json',
    );
    expect(requestReceived?.pathWithQuery, 'the query must carry both parameters').toBe(
      '/cronometragem/classificacao?etapa=nacional+2027&chave=chave-secreta-7d41',
    );
    expect(readRecordedLines().length, 'the poll must have logged its request').toBeGreaterThan(0);
    expect(everyLogLineAsText, 'no log line may hold the token').not.toContain('token-secreto');
    expect(everyLogLineAsText, 'no log line may hold the query key').not.toContain('chave-secreta');
  });

  it('reads the variable at every poll, so a new token is sent from the next poll on', async () => {
    // Arrange: the timing system answering, and an environment the test changes between polls.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const environment: Record<string, string> = {
      BAJAOVRLAY_SOURCE_BAJA_TOKEN: 'Bearer token-de-sexta',
      BAJAOVRLAY_SOURCE_BAJA_CHAVE: 'chave-de-sexta',
    };
    const adapter = createAdapterReading(environment);
    const config = buildConfigWithSecrets(timingSystem.baseUrl);

    // Act: poll, change the token, poll again.
    await adapter.pollOnce(config, buildPollContextThatNeverTimesOut());
    environment.BAJAOVRLAY_SOURCE_BAJA_TOKEN = 'Bearer token-de-sabado';
    await adapter.pollOnce(config, buildPollContextThatNeverTimesOut());

    // Assert: each poll sent the token of its moment.
    const tokensSent = timingSystem
      .readRequestsReceived()
      .map((request) => request.headers.authorization);
    expect(tokensSent, 'each poll must send the value the variable had then').toEqual([
      'Bearer token-de-sexta',
      'Bearer token-de-sabado',
    ]);
  });

  it('fails the poll in pt-BR when the variable is not set, and fetches nothing', async () => {
    // Arrange: the timing system answering, and the query key set but not the token.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const adapter = createAdapterReading({ BAJAOVRLAY_SOURCE_BAJA_CHAVE: 'chave-de-sexta' });

    // Act: poll once.
    const error = await captureThePollError(
      adapter.pollOnce(
        buildConfigWithSecrets(timingSystem.baseUrl),
        buildPollContextThatNeverTimesOut(),
      ),
    );

    // Assert: the operator reads which variable is missing, and nothing was sent without it.
    expect(error, 'the error must name the variable that is not set').toBe(
      'A variável de ambiente BAJAOVRLAY_SOURCE_BAJA_TOKEN não está definida no servidor.',
    );
    expect(
      timingSystem.readRequestsReceived(),
      'a request missing its token must not be sent',
    ).toEqual([]);
  });

  it('fails the poll when the variable holds a line break, without quoting its value', async () => {
    // Arrange: a token pasted with a line break and a second header after it.
    const timingSystem = await startTimingSystemTestServer();
    const adapter = createAdapterReading({
      BAJAOVRLAY_SOURCE_BAJA_TOKEN: 'Bearer token-secreto\r\nX-Outro: 1',
      BAJAOVRLAY_SOURCE_BAJA_CHAVE: 'chave-de-sexta',
    });

    // Act: poll once.
    const error = await captureThePollError(
      adapter.pollOnce(
        buildConfigWithSecrets(timingSystem.baseUrl),
        buildPollContextThatNeverTimesOut(),
      ),
    );

    // Assert: refused by name, the value nowhere in the message.
    expect(error, 'the error must name the variable and not its value').toBe(
      'A variável de ambiente BAJAOVRLAY_SOURCE_BAJA_TOKEN tem uma quebra de linha e não pode ir num cabeçalho.',
    );
  });

  it('fails the poll when the variable holds an emoji, naming the variable and not the network', async () => {
    // Arrange: a token pasted from a chat message with an emoji on its end.
    const timingSystem = await startTimingSystemTestServer();
    const adapter = createAdapterReading({
      BAJAOVRLAY_SOURCE_BAJA_TOKEN: 'Bearer token-secreto 🔑',
      BAJAOVRLAY_SOURCE_BAJA_CHAVE: 'chave-de-sexta',
    });

    // Act: poll once.
    const error = await captureThePollError(
      adapter.pollOnce(
        buildConfigWithSecrets(timingSystem.baseUrl),
        buildPollContextThatNeverTimesOut(),
      ),
    );

    // Assert: refused by the variable's name, the value nowhere in it, and nothing sent.
    expect(error, 'the error must name the variable, not blame the network').toBe(
      'A variável de ambiente BAJAOVRLAY_SOURCE_BAJA_TOKEN tem um caractere que um cabeçalho HTTP não aceita, como um emoji ou uma letra fora do Latin-1.',
    );
    expect(
      timingSystem.readRequestsReceived(),
      'a request with a header fetch refuses must not be sent',
    ).toEqual([]);
  });
});
