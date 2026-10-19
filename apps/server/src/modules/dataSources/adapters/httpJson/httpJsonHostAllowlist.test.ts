/**
 * The httpJson adapter and the list of allowed hosts (apps/server)
 *
 * What this module is for:
 *   The BAJAOVRLAY_SOURCE_ prefix alone does not keep a secret on the server: an operator
 *   could name BAJAOVRLAY_SOURCE_BAJA_TOKEN in a header of a source pointed at any
 *   address, and the server would send the token there. BAJAOVRLAY_SOURCE_ALLOWED_HOSTS
 *   closes that: with the list set, a request to a host not on it is refused before
 *   anything is read or sent; with the list unset, any host may be fetched, but a request
 *   that names a variable is refused. Either check runs before any variable is read, so
 *   the "variável não definida" message cannot tell anyone which secrets exist.
 *
 * What these tests prove (a real HTTP server on 127.0.0.1 and a random port standing in
 * for an address someone wants the secrets sent to, real fetch):
 *   - The proven exfiltration case: a source with a secret header and a secret query
 *     value, pointed at a host not on the list, fails its poll naming the host in pt-BR,
 *     and that host receives nothing.
 *   - The same source pointed at a listed host sends both values.
 *   - Unset list: a source with typed values only is fetched from any host; one naming a
 *     variable fails its poll in pt-BR and nothing is sent.
 *   - No oracle: with the list set and the host off it, or with the list unset, a source
 *     naming a variable that is set and one naming a variable that is not get the very
 *     same error, and no variable is read at all.
 *
 * What these tests deliberately do not cover:
 *   - How an entry matches a host (ports, capitals, IPv6): sourceHostAllowlist.test.ts.
 *   - The same refusal through the sample route: httpJsonSampleRouteHostAllowlist.test.ts
 *     in the data-source module; through a polled source:
 *     core/boot/startServerSourceHostAllowlist.test.ts; on save:
 *     reducers/dataSourceHostAllowlist.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { createLogger } from '../../../../core/logger/createLogger.js';
import { createHttpJsonAdapter } from './httpJsonAdapter.js';
import { parseSourceHostAllowlist, type SourceHostAllowlist } from './sourceHostAllowlist.js';
import {
  readExampleConfigPointedAt,
  readExampleTimingSystemResponse,
  startTimingSystemTestServer,
} from './timingSystemTestServer.testSupport.js';

/** 14:24:01 in Brasília (17:24:01 UTC) on Saturday 20 March 2027, the moment every poll here is made at. */
const pollMomentMs = Date.parse('2027-03-20T17:24:01.000Z');

/** The two secrets the server holds: the timing system's token and its query key. */
const secretsOfTheServer: Record<string, string> = {
  BAJAOVRLAY_SOURCE_BAJA_TOKEN: 'Bearer token-secreto-da-baja-9f2c',
  BAJAOVRLAY_SOURCE_BAJA_CHAVE: 'chave-secreta-7d41',
};

/** A poll context at the poll moment, with a signal that never fires. */
function buildPollContextThatNeverTimesOut() {
  return {
    readCurrentTime: () => new Date(pollMomentMs),
    signal: new AbortController().signal,
  };
}

/** Parses a list that must be valid, as the server does at boot. */
function readAllowlist(text: string | undefined): SourceHostAllowlist {
  const parsing = parseSourceHostAllowlist(text);
  if (!parsing.isValid) {
    throw new Error(`the test list "${String(text)}" must be valid`);
  }
  return parsing.allowlist;
}

/**
 * The adapter as the server builds it, silent, with this list, reading variables from
 * `environment` and counting every read, so a test can prove none happened.
 */
function createAdapterWithAllowlist(
  allowlist: SourceHostAllowlist,
  environment: Record<string, string>,
) {
  const variablesRead: string[] = [];
  const adapter = createHttpJsonAdapter({
    logger: createLogger({ level: 'silent' }),
    sourceHostAllowlist: allowlist,
    readEnvironmentVariable: (name) => {
      variablesRead.push(name);
      return environment[name];
    },
  });
  return { adapter, readVariablesRead: () => [...variablesRead] };
}

/** The example preset at `url`, sending the token header and the key in the query from variables. */
function buildConfigWithSecretsAt(url: string, tokenVariable = 'BAJAOVRLAY_SOURCE_BAJA_TOKEN') {
  const exampleConfig = readExampleConfigPointedAt(url);
  const requests = exampleConfig.requests.map((request) => ({
    ...request,
    headers: [{ name: 'Authorization', valueFromEnvironment: tokenVariable }],
    queryParameters: [{ name: 'chave', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_CHAVE' }],
  }));
  return { ...exampleConfig, requests };
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

describe('a list of allowed hosts that is set', () => {
  it('refuses to send a secret header and query value to a host not on the list', async () => {
    // Arrange: a server listening for whatever it is sent (on 127.0.0.1), a list that
    // allows the timing system only, and a source pointed at the listening server that
    // names both secrets.
    const collector = await startTimingSystemTestServer();
    collector.answer('/recebe', { kind: 'json', body: readExampleTimingSystemResponse() });
    const { adapter } = createAdapterWithAllowlist(
      readAllowlist('cronometragem.local:8080'),
      secretsOfTheServer,
    );
    const collectorHost = new URL(collector.baseUrl).host;

    // Act: poll once.
    const error = await captureThePollError(
      adapter.pollOnce(
        buildConfigWithSecretsAt(`${collector.baseUrl}/recebe`),
        buildPollContextThatNeverTimesOut(),
      ),
    );

    // Assert: the poll fails naming the host, and the listening server received nothing.
    expect(error, 'the error must name the host that is not on the list').toBe(
      `O servidor não busca dados em ${collectorHost} (classificacao): esse endereço não está em BAJAOVRLAY_SOURCE_ALLOWED_HOSTS.`,
    );
    expect(
      collector.readRequestsReceived(),
      'a host not on the list must receive nothing, no token and no key',
    ).toEqual([]);
  });

  it('sends the secret header and query value to a host on the list', async () => {
    // Arrange: the timing system on 127.0.0.1, listed by host only (any port).
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const { adapter } = createAdapterWithAllowlist(
      readAllowlist('cronometragem.local:8080, 127.0.0.1'),
      secretsOfTheServer,
    );

    // Act: poll once.
    await adapter.pollOnce(
      buildConfigWithSecretsAt(`${timingSystem.baseUrl}/cronometragem/classificacao`),
      buildPollContextThatNeverTimesOut(),
    );

    // Assert: the timing system received the token and the key.
    const [requestReceived] = timingSystem.readRequestsReceived();
    expect(requestReceived?.headers.authorization, 'the token must be sent as the header').toBe(
      'Bearer token-secreto-da-baja-9f2c',
    );
    expect(requestReceived?.pathWithQuery, 'the key must be sent in the query').toBe(
      '/cronometragem/classificacao?chave=chave-secreta-7d41',
    );
  });
});

describe('a list of allowed hosts that is not set', () => {
  it('fetches any host for a source with typed values only', async () => {
    // Arrange: the timing system on 127.0.0.1, no list, and the example preset as it is
    // (typed headers, no variable).
    const timingSystem = await startTimingSystemTestServer();
    timingSystem.answer('/cronometragem/classificacao', {
      kind: 'json',
      body: readExampleTimingSystemResponse(),
    });
    const { adapter } = createAdapterWithAllowlist(readAllowlist(undefined), {});

    // Act: poll once.
    const polledShapes = await adapter.pollOnce(
      readExampleConfigPointedAt(`${timingSystem.baseUrl}/cronometragem/classificacao`),
      buildPollContextThatNeverTimesOut(),
    );

    // Assert: the poll answered its shapes, read from the timing system.
    expect(Object.keys(polledShapes.shapes), 'the poll must answer the mapped shapes').toEqual([
      'positions',
      'session',
    ]);
    expect(timingSystem.readRequestsReceived().length, 'the host must have been asked once').toBe(
      1,
    );
  });

  it('refuses a source that names a variable, and sends nothing', async () => {
    // Arrange: the timing system on 127.0.0.1, no list, both secrets set on the server.
    const timingSystem = await startTimingSystemTestServer();
    const { adapter } = createAdapterWithAllowlist(readAllowlist(undefined), secretsOfTheServer);

    // Act: poll a source that names them.
    const error = await captureThePollError(
      adapter.pollOnce(
        buildConfigWithSecretsAt(`${timingSystem.baseUrl}/cronometragem/classificacao`),
        buildPollContextThatNeverTimesOut(),
      ),
    );

    // Assert: refused in pt-BR, saying the list is missing, and nothing was sent.
    expect(error, 'the error must say a variable needs the list').toBe(
      'A requisição classificacao usa uma variável de ambiente, mas BAJAOVRLAY_SOURCE_ALLOWED_HOSTS não está definida no servidor; sem essa lista, nenhum valor de variável é enviado.',
    );
    expect(timingSystem.readRequestsReceived(), 'nothing may be sent').toEqual([]);
  });
});

describe('no way to learn which variables exist', () => {
  const oracleScenarios = [
    // Set list, host off it: the host is refused before anything else.
    {
      name: 'gives the same error for a set and an unset variable when the host is off the list',
      allowlistText: 'cronometragem.local:8080',
    },
    // No list: the variable is refused before it is read.
    {
      name: 'gives the same error for a set and an unset variable when no list is set',
      allowlistText: undefined,
    },
  ];

  it.each(oracleScenarios)('$name', async ({ allowlistText }) => {
    // Arrange: a listening server, and the row's list; the token variable is set, the
    // "BAJAOVRLAY_SOURCE_CLOUD_KEY" one someone is guessing at is not.
    const collector = await startTimingSystemTestServer();
    const { adapter, readVariablesRead } = createAdapterWithAllowlist(
      readAllowlist(allowlistText),
      secretsOfTheServer,
    );
    const addressOfTheCollector = `${collector.baseUrl}/recebe`;

    // Act: poll once naming the variable that exists, once naming one that does not.
    const errorForASetVariable = await captureThePollError(
      adapter.pollOnce(
        buildConfigWithSecretsAt(addressOfTheCollector, 'BAJAOVRLAY_SOURCE_BAJA_TOKEN'),
        buildPollContextThatNeverTimesOut(),
      ),
    );
    const errorForAnUnsetVariable = await captureThePollError(
      adapter.pollOnce(
        buildConfigWithSecretsAt(addressOfTheCollector, 'BAJAOVRLAY_SOURCE_CLOUD_KEY'),
        buildPollContextThatNeverTimesOut(),
      ),
    );

    // Assert: the two errors are the same and name neither variable, no variable was
    // read, and nothing reached the listening server.
    expect(errorForAnUnsetVariable, 'both polls must fail with the very same error').toBe(
      errorForASetVariable,
    );
    expect(errorForASetVariable, 'the error must not name the variable').not.toContain(
      'BAJAOVRLAY_SOURCE_BAJA_TOKEN',
    );
    expect(errorForAnUnsetVariable, 'the error must not name the variable').not.toContain(
      'BAJAOVRLAY_SOURCE_CLOUD_KEY',
    );
    expect(readVariablesRead(), 'no variable may be read before the host is allowed').toEqual([]);
    expect(collector.readRequestsReceived(), 'nothing may be sent').toEqual([]);
  });
});
