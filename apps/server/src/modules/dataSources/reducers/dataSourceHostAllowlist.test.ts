/**
 * "+ Fonte" and "Editar" against BAJAOVRLAY_SOURCE_ALLOWED_HOSTS (apps/server)
 *
 * What this module is for:
 *   With BAJAOVRLAY_SOURCE_ALLOWED_HOSTS set, a flex source may only read hosts on that
 *   list. Its polls and the sample route already refuse any other host; saving one is
 *   refused too, so the operator learns at "Salvar" instead of from a source that fails
 *   every poll. The list is read at boot and handed to the reducers by the store, in
 *   the reducer context, like the clock: a reducer never reads process.env itself.
 *
 * What these tests prove:
 *   - With the list set, createDataSource and updateDataSource refuse a flex config whose
 *     request goes to a host off the list, with DATA_SOURCE_HOST_NOT_ALLOWED and a pt-BR
 *     message naming the request and the host; a config whose hosts are all listed is
 *     saved.
 *   - With no list set, a flex source to any host is saved, also one naming a variable
 *     (its polls are refused until the list is set, see httpJsonHostAllowlist.test.ts).
 *   - An edit that sends no config (a rename) is not checked against the list.
 *
 * What these tests deliberately do not cover:
 *   - How an entry matches a host: adapters/httpJson/sourceHostAllowlist.test.ts.
 *   - The store handing the list over from the boot:
 *     core/boot/startServerSourceHostAllowlist.test.ts.
 */
import type { HttpJsonDataSource } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { ReducerContext } from '../../../core/store/reducers/reducerTypes.js';
import {
  parseSourceHostAllowlist,
  type SourceHostAllowlist,
} from '../adapters/httpJson/sourceHostAllowlist.js';
import {
  buildEnduroSimulatorTurnedOff,
  buildRaceDaySlicesWithDataSources,
  contextOfTheDataSourceCommand,
} from './dataSourceSlices.testSupport.js';
import { reduceDataSourceCommand } from './reduceDataSourceCommand.js';

/** The context the store would hand a reducer on a server booted with this host list. */
function buildContextOfAServerAllowing(allowedHostsText: string | undefined): ReducerContext {
  const parsing = parseSourceHostAllowlist(allowedHostsText);
  if (!parsing.isValid) {
    throw new Error(`the test list "${String(allowedHostsText)}" must be valid`);
  }
  const sourceHostAllowlist: SourceHostAllowlist = parsing.allowlist;
  return { ...contextOfTheDataSourceCommand, sourceHostAllowlist };
}

/** A flex config reading the session from `url`, with these headers on its request. */
function buildFlexConfigReading(url: string, headers: unknown[] = []) {
  return {
    requests: [{ requestId: 'classificacao', url, headers }],
    mappings: [
      {
        shapeKey: 'session' as const,
        requestId: 'classificacao',
        fields: [
          { targetField: 'sessionId', fromPath: 'prova.id' },
          { targetField: 'sessionKind', constantValue: 'enduro' },
        ],
      },
    ],
  };
}

/** "Cronometragem — Enduro", a flex source saved off, reading the timing system on the LAN. */
function buildTimingSystemFlexSource(): HttpJsonDataSource {
  return {
    id: 'cronometragem-enduro',
    label: 'Cronometragem — Enduro',
    kind: 'httpJson',
    config: {
      requests: [
        {
          requestId: 'classificacao',
          url: 'http://cronometragem.local:8080/api/classificacao',
          headers: [],
          queryParameters: [],
        },
      ],
      mappings: buildFlexConfigReading('http://cronometragem.local:8080/api/classificacao')
        .mappings,
    },
    pollIntervalMs: 2_000,
    isEnabled: false,
    isRecording: false,
    status: {
      lastError: null,
      consecutiveFailures: 0,
      isStale: false,
      staleAfterMs: 6_000,
      recordingError: null,
    },
  };
}

describe('createDataSource with BAJAOVRLAY_SOURCE_ALLOWED_HOSTS set', () => {
  it('refuses a flex source whose request goes to a host off the list, naming the host', () => {
    // Arrange: a server that allows the timing system on the LAN only.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });
    const context = buildContextOfAServerAllowing('cronometragem.local:8080');

    // Act: create a flex source pointed at an address on the internet.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'createDataSource',
        label: 'Coletor',
        kind: 'httpJson',
        config: buildFlexConfigReading('https://coletor.example:8443/recebe'),
        pollIntervalMs: 2_000,
      },
      context,
    );

    // Assert: refused with its own code, the host and request named in pt-BR.
    expect(outcome, 'a source to a host off the list must be refused').toEqual({
      status: 'refused',
      error: {
        code: 'DATA_SOURCE_HOST_NOT_ALLOWED',
        message:
          'O servidor não busca dados em coletor.example:8443 (classificacao): esse endereço não está em BAJAOVRLAY_SOURCE_ALLOWED_HOSTS.',
      },
    });
  });

  it('saves a flex source whose request goes to a listed host', () => {
    // Arrange: a server that allows the timing system on the LAN.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });
    const context = buildContextOfAServerAllowing('cronometragem.local:8080');

    // Act: create the flex source reading it, a token from a variable in its header.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'createDataSource',
        label: 'Cronometragem — Enduro',
        kind: 'httpJson',
        config: buildFlexConfigReading('http://cronometragem.local:8080/api/classificacao', [
          { name: 'Authorization', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_TOKEN' },
        ]),
        pollIntervalMs: 2_000,
      },
      context,
    );

    // Assert: the source was added.
    expect(outcome.status, 'a source to a listed host must be saved').toBe('applied');
  });
});

describe('createDataSource with no BAJAOVRLAY_SOURCE_ALLOWED_HOSTS', () => {
  it('saves a flex source to any host, also one naming a variable', () => {
    // Arrange: a server with no list.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });
    const context = buildContextOfAServerAllowing(undefined);

    // Act: create a flex source to an address on the internet, naming a token variable.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'createDataSource',
        label: 'API da federação',
        kind: 'httpJson',
        config: buildFlexConfigReading('https://api.bajasaebrasil.org.br/v1/enduro', [
          { name: 'Authorization', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_TOKEN' },
        ]),
        pollIntervalMs: 5_000,
      },
      context,
    );

    // Assert: saved; its polls, not its save, say the variable needs the list.
    expect(outcome.status, 'with no list a source to any host must be saved').toBe('applied');
  });
});

describe('updateDataSource with BAJAOVRLAY_SOURCE_ALLOWED_HOSTS set', () => {
  it('refuses a new config whose request goes to a host off the list', () => {
    // Arrange: the timing system's flex source, on a server that allows only it.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildTimingSystemFlexSource()],
    });
    const context = buildContextOfAServerAllowing('cronometragem.local:8080');

    // Act: "Editar" points its request at another port of the same machine.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'updateDataSource',
        sourceId: 'cronometragem-enduro',
        config: buildFlexConfigReading('http://cronometragem.local:9000/api/classificacao'),
      },
      context,
    );

    // Assert: refused, naming the host with its port.
    expect(outcome, 'a config to a host off the list must be refused').toEqual({
      status: 'refused',
      error: {
        code: 'DATA_SOURCE_HOST_NOT_ALLOWED',
        message:
          'O servidor não busca dados em cronometragem.local:9000 (classificacao): esse endereço não está em BAJAOVRLAY_SOURCE_ALLOWED_HOSTS.',
      },
    });
  });

  it('renames a source without checking its stored config against the list', () => {
    // Arrange: the timing system's flex source, saved before a list that leaves it out.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildTimingSystemFlexSource()],
    });
    const context = buildContextOfAServerAllowing('api.bajasaebrasil.org.br');

    // Act: "Editar" changes only its name.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'updateDataSource', sourceId: 'cronometragem-enduro', label: 'Cronometragem — LAN' },
      context,
    );

    // Assert: renamed; its polls are what the list refuses.
    const renamedSource = outcome.status === 'applied' ? outcome.slices.dataSources[0] : undefined;
    expect(renamedSource?.label, 'a rename must be saved whatever the list says').toBe(
      'Cronometragem — LAN',
    );
  });
});
