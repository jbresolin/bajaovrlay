/**
 * The config of a flex HTTP/JSON source (packages/shared)
 *
 * What this module is for:
 *   A source of kind `httpJson` says which addresses to read (one to five GET requests,
 *   each with its headers and query parameters) and how their JSON maps into the
 *   canonical shapes (the flex mapping). `HttpJsonConfigSchema` checks all of it when the
 *   config is saved, so the operator's form and the server's createDataSource refuse a
 *   broken config before it is polled. A secret (a token) is never written in the
 *   config: it names an environment variable of the server, and only names that start
 *   with BAJAOVRLAY_SOURCE_ are accepted, so a config cannot send some other server
 *   secret to an address someone typed.
 *
 * What these tests prove:
 *   - The example timing-system preset passes the whole schema, unchanged.
 *   - Headers and query parameters are optional (an empty list), and each one is either a
 *     value or the name of an environment variable.
 *   - Refused, each at its place with a pt-BR sentence: a repeated request id, a request
 *     id with spaces, no request and six requests, a mapping naming a request that does
 *     not exist, an unknown transform, a bad mapValues table, an environment variable
 *     without the prefix (in a header and in a query parameter), a header with both a
 *     value and a variable or with neither, a header name with a space, a header value
 *     with a line break, an address that is not http or https or not an address at all,
 *     a method key (GET only), a shape mapped twice, and brackets (not built yet).
 *
 * What these tests deliberately do not cover:
 *   - Every rule of the mapping itself (paths, targets, sources of a rule):
 *     flexMappingConfig.test.ts in flexMapping/ covers them; here a few rows prove they
 *     are reached through this schema, at the right place.
 *   - Reading the variables and fetching: the server's httpJson adapter does both at poll
 *     time (apps/server/src/modules/dataSources/adapters/httpJson/).
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { HttpJsonConfigSchema } from './httpJsonConfig.js';

/** Reads the example preset's whole config, exactly as the file has it. */
function readExampleConfig(): unknown {
  const configUrl = new URL(
    '../flexMapping/examples/timing-system-like.config.json',
    import.meta.url,
  );
  return JSON.parse(readFileSync(configUrl, 'utf8'));
}

/** The request of an imaginary timing system's classification, with no header or query. */
function buildClassificationRequest(): Record<string, unknown> {
  return {
    requestId: 'classificacao',
    url: 'http://cronometragem.local:8080/api/classificacao',
  };
}

/** A positions mapping that reads the cars under "classificacao", from request `requestId`. */
function buildPositionsMappingFrom(requestId: string): Record<string, unknown> {
  return {
    shapeKey: 'positions',
    requestId,
    entriesPath: 'classificacao',
    fields: [
      { targetField: 'sessionId', fromPath: 'prova.id' },
      { targetField: 'updatedAtMs', fromPollMoment: true },
    ],
    entryFields: [
      { targetField: 'position', fromListOrder: true },
      { targetField: 'carNumber', fromPath: 'carro', transformId: 'textToInteger' },
      { targetField: 'teamName', fromPath: 'equipe' },
      { targetField: 'schoolName', fromPath: 'escola' },
      { targetField: 'laps', fromPath: 'voltas' },
    ],
  };
}

/** A whole config: the classification request, its positions mapping, and `changes` on top. */
function buildClassificationConfig(changes: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    requests: [buildClassificationRequest()],
    mappings: [buildPositionsMappingFrom('classificacao')],
    ...changes,
  };
}

/** The classification config whose one request has `requestChanges` on top. */
function buildConfigWithRequestChanges(
  requestChanges: Record<string, unknown>,
): Record<string, unknown> {
  return buildClassificationConfig({
    requests: [{ ...buildClassificationRequest(), ...requestChanges }],
  });
}

/** The classification config whose positions mapping has this one extra car rule. */
function buildConfigWithExtraCarRule(rule: Record<string, unknown>): Record<string, unknown> {
  const positionsMapping = buildPositionsMappingFrom('classificacao');
  const entryFields = positionsMapping.entryFields as unknown[];
  return buildClassificationConfig({
    mappings: [{ ...positionsMapping, entryFields: [...entryFields, rule] }],
  });
}

/** The first problem the schema found: where, and the sentence it gave. */
function findFirstIssue(config: unknown): { path: string; message: string } | undefined {
  const parsing = HttpJsonConfigSchema.safeParse(config);
  const firstIssue = parsing.error?.issues[0];
  if (firstIssue === undefined) {
    return undefined;
  }
  return { path: firstIssue.path.map(String).join('.'), message: firstIssue.message };
}

describe('HttpJsonConfigSchema', () => {
  it('accepts the example timing-system preset whole, unchanged', () => {
    // Arrange: the example preset's config, as the file has it.
    const exampleConfig = readExampleConfig();

    // Act: check it with the whole config schema, as "Importar configuração" will.
    const parsing = HttpJsonConfigSchema.safeParse(exampleConfig);

    // Assert: it passes, and nothing in it was changed or dropped.
    expect(parsing.error?.issues, 'the example preset must have no problem').toBeUndefined();
    expect(parsing.data, 'the example preset must pass unchanged').toEqual(exampleConfig);
  });

  it('gives a request with no headers and no query parameters two empty lists', () => {
    // Arrange: the classification request, naming neither headers nor query parameters.
    const config = buildClassificationConfig();

    // Act: parse it.
    const parsedConfig = HttpJsonConfigSchema.parse(config);

    // Assert: both lists are there, empty, so the adapter never has to ask.
    expect(parsedConfig.requests[0], 'missing lists must be filled as empty').toEqual({
      requestId: 'classificacao',
      url: 'http://cronometragem.local:8080/api/classificacao',
      headers: [],
      queryParameters: [],
    });
  });

  it('accepts a header with its value and a token named by an environment variable', () => {
    // Arrange: the Baja app's endpoint, which wants JSON and a bearer token kept on the server.
    const config = buildConfigWithRequestChanges({
      url: 'https://app.bajasaebrasil.org.br/api/v1/enduro/classificacao',
      headers: [
        { name: 'Accept', value: 'application/json' },
        { name: 'Authorization', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_TOKEN' },
      ],
      queryParameters: [
        { name: 'etapa', value: 'nacional-2027' },
        { name: 'chave', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_CHAVE' },
      ],
    });

    // Act: check it.
    const parsing = HttpJsonConfigSchema.safeParse(config);

    // Assert: accepted; the variable names are kept as names, never as values.
    expect(parsing.error?.issues, 'a value and a prefixed variable must both pass').toBeUndefined();
    expect(parsing.data?.requests[0]?.headers, 'the headers must be kept as written').toEqual([
      { name: 'Accept', value: 'application/json' },
      { name: 'Authorization', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_TOKEN' },
    ]);
  });

  it('accepts two requests, each shape reading its own', () => {
    // Arrange: the classification for positions, and the race control's own endpoint for the session.
    const config = {
      requests: [
        buildClassificationRequest(),
        { requestId: 'direcao_de_prova', url: 'http://cronometragem.local:8080/api/prova' },
      ],
      mappings: [
        buildPositionsMappingFrom('classificacao'),
        {
          shapeKey: 'session',
          requestId: 'direcao_de_prova',
          fields: [{ targetField: 'sessionId', fromPath: 'id' }],
        },
      ],
    };

    // Act: check it.
    const parsing = HttpJsonConfigSchema.safeParse(config);

    // Assert: accepted.
    expect(parsing.error?.issues, 'two requests read by two shapes must pass').toBeUndefined();
  });

  const refusedConfigScenarios: Array<{
    name: string;
    config: unknown;
    expectedPath: string;
    expectedMessage: string;
  }> = [
    // Each mapping names its request by id, so two requests with one id would be ambiguous.
    {
      name: 'refuses two requests with the same id',
      config: buildClassificationConfig({
        requests: [
          buildClassificationRequest(),
          { requestId: 'classificacao', url: 'http://cronometragem.local:8080/api/voltas' },
        ],
      }),
      expectedPath: 'requests.1.requestId',
      expectedMessage:
        'Há mais de uma requisição chamada "classificacao"; cada requisição tem um nome só seu.',
    },
    // The id is quoted in every error line, so it stays a short plain name.
    {
      name: 'refuses a request id with spaces and accents',
      config: buildConfigWithRequestChanges({ requestId: 'classificação geral' }),
      expectedPath: 'requests.0.requestId',
      expectedMessage:
        'O nome da requisição "classificação geral" só pode ter letras sem acento, números, "_" e "-", até 40 caracteres.',
    },
    // A source with nothing to fetch has nothing to map.
    {
      name: 'refuses a config with no request',
      config: buildClassificationConfig({ requests: [] }),
      expectedPath: 'requests',
      expectedMessage: 'Uma fonte HTTP/JSON precisa de pelo menos uma requisição.',
    },
    // Five requests per poll is the cap: a poll fetches all of them every interval.
    {
      name: 'refuses six requests',
      config: buildClassificationConfig({
        requests: ['a', 'b', 'c', 'd', 'e', 'f'].map((letter) => ({
          requestId: `pagina_${letter}`,
          url: `http://cronometragem.local:8080/api/pagina-${letter}`,
        })),
      }),
      expectedPath: 'requests',
      expectedMessage: 'Uma fonte HTTP/JSON tem no máximo 5 requisições.',
    },
    // A mapping reading a response no request fetches would fail every poll.
    {
      name: 'refuses a mapping naming a request that does not exist',
      config: buildClassificationConfig({ mappings: [buildPositionsMappingFrom('voltas')] }),
      expectedPath: 'mappings.0.requestId',
      expectedMessage: 'Posições lê a requisição "voltas", que não existe nesta fonte.',
    },
    // An unknown transform is refused at save time, at its place, through this schema.
    {
      name: 'refuses a transform the registry does not have',
      config: buildConfigWithExtraCarRule({
        targetField: 'lastLapMs',
        fromPath: 'ultima_volta',
        transformId: 'formatLapTime',
      }),
      expectedPath: 'mappings.0.entryFields.5.transformId',
      expectedMessage: 'A transformação "formatLapTime" não existe.',
    },
    // The status table is checked by mapValues' own schema when the config is saved.
    {
      name: 'refuses an empty status table',
      config: buildConfigWithExtraCarRule({
        targetField: 'status',
        fromPath: 'situacao',
        transformId: 'mapValues',
        transformParameters: {},
      }),
      expectedPath: 'mappings.0.entryFields.5.transformParameters',
      expectedMessage: 'A tabela de valores está vazia.',
    },
    // A config must not be able to send DATABASE_PATH, or any other server variable, away.
    {
      name: 'refuses a header from a variable without the BAJAOVRLAY_SOURCE_ prefix',
      config: buildConfigWithRequestChanges({
        headers: [{ name: 'Authorization', valueFromEnvironment: 'DATABASE_PATH' }],
      }),
      expectedPath: 'requests.0.headers.0.valueFromEnvironment',
      expectedMessage:
        'A variável de ambiente "DATABASE_PATH" não pode ser usada: só variáveis com nome BAJAOVRLAY_SOURCE_ e letras maiúsculas, números ou "_" podem ser enviadas a uma fonte.',
    },
    // A query parameter goes to the same address, so the same rule holds there.
    {
      name: 'refuses a query parameter from a variable without the prefix',
      config: buildConfigWithRequestChanges({
        queryParameters: [{ name: 'chave', valueFromEnvironment: 'HOME' }],
      }),
      expectedPath: 'requests.0.queryParameters.0.valueFromEnvironment',
      expectedMessage:
        'A variável de ambiente "HOME" não pode ser usada: só variáveis com nome BAJAOVRLAY_SOURCE_ e letras maiúsculas, números ou "_" podem ser enviadas a uma fonte.',
    },
    // Two values would leave the reader guessing which one is sent.
    {
      name: 'refuses a header with both a value and a variable',
      config: buildConfigWithRequestChanges({
        headers: [
          {
            name: 'Authorization',
            value: 'Bearer 123',
            valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_TOKEN',
          },
        ],
      }),
      expectedPath: 'requests.0.headers.0',
      expectedMessage:
        '"Authorization" precisa de exatamente um valor: um valor digitado ou uma variável de ambiente.',
    },
    // A header with no value at all is almost always a row left half-filled.
    {
      name: 'refuses a query parameter with neither a value nor a variable',
      config: buildConfigWithRequestChanges({ queryParameters: [{ name: 'etapa' }] }),
      expectedPath: 'requests.0.queryParameters.0',
      expectedMessage:
        '"etapa" precisa de exatamente um valor: um valor digitado ou uma variável de ambiente.',
    },
    // fetch refuses such a name at poll time; refusing it here says so before the race.
    {
      name: 'refuses a header name with a space',
      config: buildConfigWithRequestChanges({
        headers: [{ name: 'Chave da API', value: 'aberta' }],
      }),
      expectedPath: 'requests.0.headers.0.name',
      expectedMessage:
        'O nome de cabeçalho "Chave da API" é inválido: use só letras, números e "-", como X-Api-Key.',
    },
    // A line break in a header value would let a value write a second header.
    {
      name: 'refuses a header value with a line break',
      config: buildConfigWithRequestChanges({
        headers: [{ name: 'Accept', value: 'application/json\r\nX-Outro: 1' }],
      }),
      expectedPath: 'requests.0.headers.0.value',
      expectedMessage: 'O valor do cabeçalho "Accept" não pode ter quebra de linha.',
    },
    // The adapter speaks HTTP only; a file or FTP address would read something else entirely.
    {
      name: 'refuses an address that is not http or https',
      config: buildConfigWithRequestChanges({
        url: 'ftp://cronometragem.local/classificacao.json',
      }),
      expectedPath: 'requests.0.url',
      expectedMessage:
        'O endereço "ftp://cronometragem.local/classificacao.json" precisa começar com http:// ou https://.',
    },
    // Text that is no address at all is refused with the same plain sentence.
    {
      name: 'refuses text that is not an address',
      config: buildConfigWithRequestChanges({ url: 'cronometragem/classificacao' }),
      expectedPath: 'requests.0.url',
      expectedMessage:
        'O endereço "cronometragem/classificacao" precisa começar com http:// ou https://.',
    },
    // GET only: a poll must never change anything on the other side, so there is no method key.
    {
      name: 'refuses a method on a request, since every request is a GET',
      config: buildConfigWithRequestChanges({ method: 'POST' }),
      expectedPath: 'requests.0',
      expectedMessage: 'A requisição tem uma chave que não existe: "method".',
    },
    // A shape comes from one mapping only, also through this schema.
    {
      name: 'refuses positions mapped twice',
      config: buildClassificationConfig({
        mappings: [
          buildPositionsMappingFrom('classificacao'),
          buildPositionsMappingFrom('classificacao'),
        ],
      }),
      expectedPath: 'mappings.1.shapeKey',
      expectedMessage:
        'Posições está mapeada mais de uma vez; cada formato vem de um só mapeamento.',
    },
    // Brackets are a draft shape (BAJAOVRLAY-25): their mapping is not built in this PR.
    {
      name: 'refuses a brackets mapping, saying in pt-BR it is not built yet',
      config: buildClassificationConfig({
        mappings: [{ shapeKey: 'brackets', requestId: 'classificacao', fields: [] }],
      }),
      expectedPath: 'mappings.0.shapeKey',
      expectedMessage:
        'Mapear as Chaves ainda não foi construído: o formato das chaves ainda é um rascunho.',
    },
  ];

  it.each(refusedConfigScenarios)('$name', ({ config, expectedPath, expectedMessage }) => {
    // Arrange: nothing more to set up; the config is the row's.

    // Act: check it as a saved config is checked.
    const firstIssue = findFirstIssue(config);

    // Assert: refused, at this place, with this sentence.
    expect(firstIssue, 'the config must be refused at this place, for this reason').toEqual({
      path: expectedPath,
      message: expectedMessage,
    });
  });
});
