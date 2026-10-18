/**
 * The config of a flex HTTP/JSON source: misspelt keys and wrong types (packages/shared)
 *
 * What this module is for:
 *   A flex config is often written by hand or imported from a file ("Importar
 *   configuração"), so a misspelt key or a value of the wrong type is the commonest
 *   mistake. `HttpJsonConfigSchema` refuses each one at its place with a pt-BR sentence
 *   the operator can act on, never Zod's English default ("Unrecognized key").
 *
 * What these tests prove:
 *   - A misspelt key is refused naming the key: on a header (naming the header), on a
 *     query parameter (naming the parameter) and at the top of the config.
 *   - A missing field, a field of the wrong type and something other than an object or a
 *     list where one goes are each refused with a pt-BR sentence naming the field.
 *
 * What these tests deliberately do not cover:
 *   - The rules of the values themselves (request ids, addresses, variables, header
 *     values): httpJsonConfig.test.ts.
 *   - The keys of the mapping's own rules and mappings: flexMappingConfig.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildClassificationConfig,
  buildClassificationRequest,
  buildConfigWithRequestChanges,
  buildPositionsMappingFrom,
  findFirstIssue,
} from './httpJsonConfigExamples.testSupport.js';

describe('HttpJsonConfigSchema with misspelt keys and wrong types', () => {
  const refusedConfigScenarios: Array<{
    name: string;
    config: unknown;
    expectedPath: string;
    expectedMessage: string;
  }> = [
    // "valueFromEnv" for "valueFromEnvironment" is the slip a hand-written import makes.
    {
      name: 'refuses a misspelt key on a header, naming the header',
      config: buildConfigWithRequestChanges({
        headers: [{ name: 'Authorization', valueFromEnv: 'BAJAOVRLAY_SOURCE_BAJA_TOKEN' }],
      }),
      expectedPath: 'requests.0.headers.0',
      expectedMessage: 'O cabeçalho "Authorization" tem uma chave que não existe: "valueFromEnv".',
    },
    // The same slip on a query parameter is refused the same way, naming the parameter.
    {
      name: 'refuses a misspelt key on a query parameter, naming the parameter',
      config: buildConfigWithRequestChanges({
        queryParameters: [{ name: 'etapa', valor: 'nacional-2027' }],
      }),
      expectedPath: 'requests.0.queryParameters.0',
      expectedMessage: 'O parâmetro "etapa" tem uma chave que não existe: "valor".',
    },
    // "mapping" for "mappings" at the top would otherwise read as a config with no mapping.
    {
      name: 'refuses a misspelt key at the top of the config',
      config: {
        requests: [buildClassificationRequest()],
        mappings: [buildPositionsMappingFrom('classificacao')],
        mapping: [],
      },
      expectedPath: '',
      expectedMessage: 'A configuração tem uma chave que não existe: "mapping".',
    },
    // An import that wrote "mapping" alone has no mappings at all; the sentence names the key.
    {
      name: 'refuses a config whose mappings are missing',
      config: { requests: [buildClassificationRequest()] },
      expectedPath: 'mappings',
      expectedMessage: 'Os mapeamentos ("mappings") precisam ser uma lista, um por formato.',
    },
    // A number where a name goes is refused in pt-BR, not with Zod's English default.
    {
      name: 'refuses a request id that is a number, not text',
      config: buildConfigWithRequestChanges({ requestId: 5 }),
      expectedPath: 'requests.0.requestId',
      expectedMessage: 'O campo "requestId" precisa ser um texto.',
    },
    // A request with no address has nothing to fetch.
    {
      name: 'refuses a request with no address',
      config: buildClassificationConfig({ requests: [{ requestId: 'classificacao' }] }),
      expectedPath: 'requests.0.url',
      expectedMessage: 'Falta o campo "url".',
    },
    // Headers written as one line of text instead of a list of name and value.
    {
      name: 'refuses headers that are text instead of a list',
      config: buildConfigWithRequestChanges({ headers: 'Accept: application/json' }),
      expectedPath: 'requests.0.headers',
      expectedMessage: 'O campo "headers" precisa ser uma lista.',
    },
    // A header written as "Accept: application/json" inside the list, instead of an object.
    {
      name: 'refuses a header that is text instead of an object',
      config: buildConfigWithRequestChanges({ headers: ['Accept: application/json'] }),
      expectedPath: 'requests.0.headers.0',
      expectedMessage:
        'Cada cabeçalho precisa ser um objeto com "name" e "value" (ou "valueFromEnvironment").',
    },
    // An imported file holding just a list of requests, not the config object.
    {
      name: 'refuses a config that is a list instead of an object',
      config: [buildClassificationRequest()],
      expectedPath: '',
      expectedMessage: 'A configuração precisa ser um objeto com "requests" e "mappings".',
    },
  ];

  it.each(refusedConfigScenarios)('$name', ({ config, expectedPath, expectedMessage }) => {
    // Arrange: nothing more to set up; the config is the row's.

    // Act: check it as a saved or imported config is checked.
    const firstIssue = findFirstIssue(config);

    // Assert: refused, at this place, with this pt-BR sentence.
    expect(firstIssue, 'the config must be refused at this place, in pt-BR').toEqual({
      path: expectedPath,
      message: expectedMessage,
    });
  });
});
