/**
 * The httpJson adapter: polling a flex source (apps/server)
 *
 * What this module is for:
 *   A flex source is any JSON API: its config lists the addresses to GET and how their
 *   JSON maps into the canonical shapes. At every poll the adapter fetches every request
 *   at once with Node's own fetch, reads each answer as JSON and runs the shared
 *   applyFlexMapping on them, so the source then behaves like every other one. Secrets
 *   (a token) are not in the config: a header or query parameter names a
 *   BAJAOVRLAY_SOURCE_ variable, read from the server's environment at poll time.
 *
 * What these tests prove (a real HTTP server on 127.0.0.1 and a random port, real fetch):
 *   - A good poll of the fictional timing system gives positions (its 20 cars, in order)
 *     and session, which pass the canonical validation the store runs next.
 *   - listProducedShapes answers the mappings' shape keys.
 *   - Two requests are both fetched in one poll, each shape reading its own; one of them
 *     failing fails the whole poll.
 *   - A header and a query parameter named by an environment variable are sent with the
 *     variable's value, read at poll time (a change shows at the next poll), and that
 *     value is in no log line; the variable not being set fails the poll, in pt-BR.
 *   - A response that does not map fails the poll with the mapping's summary.
 *
 * What these tests deliberately do not cover:
 *   - The failures of a single request (status, bad JSON, the 5 MB cap, connection
 *     refused, a timeout, a redirect): httpJsonAdapterFailures.test.ts.
 *   - The rules of the config and of the mapping: packages/shared covers them.
 *   - A flex source through the poller and the store, recorded and replayed: the store
 *     tests of the data-source module.
 */
import { validateDataShape } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../../../../core/logger/createLogger.js';
import { createRecordingLogger } from '../../../../core/logger/recordingLogger.testSupport.js';
import { createHttpJsonAdapter } from './httpJsonAdapter.js';
import {
  readExampleConfigPointedAt,
  readExampleTimingSystemResponse,
  startTimingSystemTestServer,
} from './timingSystemTestServer.testSupport.js';

/** 14:24 UTC on Saturday 20 March 2027, the moment every poll here is made at. */
const pollMomentMs = Date.parse('2027-03-20T17:24:01.000Z');

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

describe('a good poll', () => {
  it("maps the timing system's 20 cars and its session, which pass the canonical validation", async () => {
    // Arrange: the timing system answering its example classification, and the example preset.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const config = readExampleConfigPointedAt(
      `${timingSystem.baseUrl}/cronometragem/classificacao`,
    );
    const adapter = createAdapterReading({});

    // Act: poll once.
    const answer = await adapter.pollOnce(config, buildPollContextThatNeverTimesOut());

    // Assert: positions and session, valid, 20 cars in the order of the list.
    const positionsCheck = validateDataShape('positions', answer.shapes.positions);
    const sessionCheck = validateDataShape('session', answer.shapes.session);
    expect(Object.keys(answer.shapes), 'the poll must answer positions and session').toEqual([
      'positions',
      'session',
    ]);
    expect(positionsCheck.isValid, 'the mapped positions must pass the canonical shape').toBe(true);
    expect(sessionCheck.isValid, 'the mapped session must pass the canonical shape').toBe(true);
    expect(answer.shapes.positions, 'the list must hold the 20 cars').toHaveProperty(
      'entries.length',
      20,
    );
    expect(answer.shapes.positions, 'car 17 leads, as the list is in order').toHaveProperty(
      'entries.0',
      expect.objectContaining({ position: 1, carNumber: 17, teamName: 'Acauã Baja' }),
    );
  });

  it('says the shapes it produces are the shape keys of its mappings', () => {
    // Arrange: the example preset, which maps positions and session.
    const config = readExampleConfigPointedAt('http://cronometragem.local:4790/classificacao');
    const adapter = createAdapterReading({});

    // Act: ask which shapes a source with this config produces.
    const producedShapes = adapter.listProducedShapes(config);

    // Assert: exactly the two it maps, in its order.
    expect(producedShapes, 'the produced shapes must be the mapped ones').toEqual([
      'positions',
      'session',
    ]);
  });

  it('fails with the mapping summary when the response does not map', async () => {
    // Arrange: the timing system's classification with car 17's last lap garbled.
    const timingSystem = await startTimingSystemTestServer();
    const garbledResponse = readExampleTimingSystemResponse() as {
      classificacao: Array<Record<string, unknown>>;
    };
    const firstCar = garbledResponse.classificacao[0] ?? {};
    firstCar.ultima_volta = '4:3x.293';
    timingSystem.answer('/cronometragem/classificacao', { kind: 'json', body: garbledResponse });
    const config = readExampleConfigPointedAt(
      `${timingSystem.baseUrl}/cronometragem/classificacao`,
    );
    const adapter = createAdapterReading({});

    // Act: poll once.
    const error = await captureThePollError(
      adapter.pollOnce(config, buildPollContextThatNeverTimesOut()),
    );

    // Assert: the poll fails naming the car, its line, the field and the path.
    expect(error, 'the poll error must be the mapping problem, naming car, line and path').toBe(
      'Posições › carro 17 (linha 1) › Última volta: não consegui ler "ultima_volta": "4:3x.293" não é um tempo de volta como 4:38.293, 278.293 ou 1:02:03.4',
    );
  });
});

describe('two requests', () => {
  /** A flex source reading positions from the classification and the session from race control. */
  function buildTwoRequestConfig(baseUrl: string) {
    const exampleConfig = readExampleConfigPointedAt(`${baseUrl}/cronometragem/classificacao`);
    const [positionsMapping, sessionMapping] = exampleConfig.mappings;
    if (positionsMapping === undefined || sessionMapping === undefined) {
      throw new Error('the example preset must map positions and session');
    }
    return {
      requests: [
        ...exampleConfig.requests,
        {
          requestId: 'direcao_de_prova',
          url: `${baseUrl}/cronometragem/prova`,
          headers: [],
          queryParameters: [],
        },
      ],
      mappings: [positionsMapping, { ...sessionMapping, requestId: 'direcao_de_prova' }],
    };
  }

  it('fetches both in one poll, each shape reading its own response', async () => {
    // Arrange: the classification and race control both answering the example response.
    const timingSystem = await startTimingSystemTestServer();
    const exampleResponse = readExampleTimingSystemResponse();
    timingSystem.answer('/cronometragem/classificacao', { kind: 'json', body: exampleResponse });
    timingSystem.answer('/cronometragem/prova', { kind: 'json', body: exampleResponse });
    const adapter = createAdapterReading({});

    // Act: poll once.
    const answer = await adapter.pollOnce(
      buildTwoRequestConfig(timingSystem.baseUrl),
      buildPollContextThatNeverTimesOut(),
    );

    // Assert: both addresses were asked once, and both shapes came back.
    const pathsAsked = timingSystem.readRequestsReceived().map((request) => request.pathWithQuery);
    expect([...pathsAsked].sort(), 'each request must be fetched once').toEqual([
      '/cronometragem/classificacao',
      '/cronometragem/prova',
    ]);
    expect(Object.keys(answer.shapes), 'both shapes must be answered').toEqual([
      'positions',
      'session',
    ]);
  });

  it('fails the whole poll when one of the two fails: a source never half-succeeds', async () => {
    // Arrange: the classification answering, race control down with a 503.
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    timingSystem.answer('/cronometragem/prova', {
      kind: 'json',
      status: 503,
      body: { erro: 'manutenção' },
    });
    const adapter = createAdapterReading({});

    // Act: poll once.
    const error = await captureThePollError(
      adapter.pollOnce(
        buildTwoRequestConfig(timingSystem.baseUrl),
        buildPollContextThatNeverTimesOut(),
      ),
    );

    // Assert: no shape at all, and the error names the request that failed.
    expect(error, 'the poll must fail with the failing request named').toBe(
      'A fonte respondeu 503 (Service Unavailable) em direcao_de_prova',
    );
  });
});

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
});
