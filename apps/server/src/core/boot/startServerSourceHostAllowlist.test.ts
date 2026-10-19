/**
 * A booted server and BAJAOVRLAY_SOURCE_ALLOWED_HOSTS (apps/server)
 *
 * What this module is for:
 *   main.ts reads BAJAOVRLAY_SOURCE_ALLOWED_HOSTS once at boot and startServer hands the
 *   list to the store (which refuses saving a flex source to a host off it), to the
 *   poller (whose polls refuse such a host before anything is sent) and to the sample
 *   route. With no list it logs a boot warning. This drives the real startServer, so
 *   the wiring between those pieces is what is proven, not each piece's rule.
 *
 * What these tests prove (with a real port, a real SQLite file and real fetch):
 *   - The proven exfiltration case through a polled source: a flex source saved while
 *     no list was set, naming a secret header and a secret query value and pointed at a
 *     host that then is off the list, fails every poll after the restart with the pt-BR
 *     refusal naming that host, and the host receives nothing.
 *   - A server booted with the list refuses "+ Fonte" for a flex source to a host off it.
 *   - A server booted with no list logs the warning saying so; one with a list does not.
 *
 * What these tests deliberately do not cover:
 *   - How an entry matches a host, and the refusal of a variable with no list:
 *     modules/dataSources/adapters/httpJson/*HostAllowlist.test.ts.
 *   - The sample route: httpJsonSampleRouteHostAllowlist.test.ts in the data-source module.
 *   - main.ts reading the variable: core/env/readServerEnvironment.test.ts.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { startTimingSystemTestServer } from '../../modules/dataSources/adapters/httpJson/timingSystemTestServer.testSupport.js';
import type { SourceHostAllowlist } from '../../modules/dataSources/index.js';
import { committedMigrationsFolder } from '../db/openDatabase.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import type { StateStore } from '../store/createStateStore.js';
import { buildBootOptions, operatorActor } from './bootedServer.testSupport.js';
import { startServer } from './startServer.js';

/** BAJAOVRLAY_SOURCE_ALLOWED_HOSTS=cronometragem.local:8080: the LAN timing system only. */
const allowlistOfTheLanTimingSystemOnly: SourceHostAllowlist = {
  isSet: true,
  allowedHosts: [{ hostName: 'cronometragem.local', port: '8080' }],
};

/** A flex config reading the session from `url`, sending the token and the key from variables. */
function buildFlexConfigWithSecretsAt(url: string) {
  return {
    requests: [
      {
        requestId: 'classificacao',
        url,
        headers: [{ name: 'Authorization', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_TOKEN' }],
        queryParameters: [{ name: 'chave', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_BAJA_CHAVE' }],
      },
    ],
    mappings: [
      {
        shapeKey: 'session',
        requestId: 'classificacao',
        fields: [
          { targetField: 'sessionId', fromPath: 'prova.id' },
          { targetField: 'sessionKind', constantValue: 'enduro' },
        ],
      },
    ],
  };
}

/** Sends "+ Fonte" for a flex source named "Coletor" with this config; gives back the answer. */
function createTheCollectorSource(stateStore: StateStore, config: unknown) {
  return stateStore.applyCommand(
    { type: 'createDataSource', label: 'Coletor', kind: 'httpJson', config, pollIntervalMs: 1_000 },
    operatorActor,
  );
}

/** Sets both secrets in the server's own environment, for this test only. */
function setTheSecretsOfTheServer(): void {
  vi.stubEnv('BAJAOVRLAY_SOURCE_BAJA_TOKEN', 'Bearer token-secreto-da-baja-9f2c');
  vi.stubEnv('BAJAOVRLAY_SOURCE_BAJA_CHAVE', 'chave-secreta-7d41');
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
}

describe('startServer with BAJAOVRLAY_SOURCE_ALLOWED_HOSTS', () => {
  it('refuses to send the secrets of a polled source to a host that is off the list', async () => {
    // Arrange: a server listening for whatever it is sent (on 127.0.0.1) and both secrets
    // set; a first boot with no list saves a flex source pointed at it (off, so it is not
    // polled yet), and a second boot on the same database has the list, which leaves
    // that host out.
    const collector = await startTimingSystemTestServer();
    setTheSecretsOfTheServer();
    const bootOptions = buildBootOptions(committedMigrationsFolder);
    const firstBoot = await startServer(bootOptions);
    createTheCollectorSource(
      firstBoot.stateStore,
      buildFlexConfigWithSecretsAt(`${collector.baseUrl}/recebe`),
    );
    await firstBoot.close();
    const secondBoot = await startServer({
      ...bootOptions,
      sourceHostAllowlist: allowlistOfTheLanTimingSystemOnly,
    });
    onTestFinished(() => secondBoot.close());
    const collectorSource = secondBoot.stateStore
      .readAllSlices()
      .dataSources.find((source) => source.label === 'Coletor');
    const collectorHost = new URL(collector.baseUrl).host;

    // Act: the operator turns the source on, and the poller polls it.
    secondBoot.stateStore.applyCommand(
      { type: 'setDataSourceEnabled', sourceId: collectorSource?.id, isEnabled: true },
      operatorActor,
    );
    const lastError = await vi.waitFor(() => {
      const source = secondBoot.stateStore
        .readAllSlices()
        .dataSources.find((each) => each.id === collectorSource?.id);
      const error = source?.status.lastError ?? null;
      if (error === null) {
        throw new Error('the source has not failed a poll yet');
      }
      return error;
    });

    // Assert: the poll failed naming the host, and the listening server received nothing.
    expect(lastError, 'the poll must fail naming the host that is off the list').toBe(
      `O servidor não busca dados em ${collectorHost} (classificacao): esse endereço não está em BAJAOVRLAY_SOURCE_ALLOWED_HOSTS.`,
    );
    expect(
      collector.readRequestsReceived(),
      'a host off the list must receive nothing, no token and no key',
    ).toEqual([]);
  });

  it('refuses "+ Fonte" for a flex source to a host off the list', async () => {
    // Arrange: a server booted with a list that allows the LAN timing system only.
    const runningServer = await startServer({
      ...buildBootOptions(committedMigrationsFolder),
      sourceHostAllowlist: allowlistOfTheLanTimingSystemOnly,
    });
    onTestFinished(() => runningServer.close());

    // Act: "+ Fonte" for a flex source pointed at an address on the internet.
    const outcome = createTheCollectorSource(
      runningServer.stateStore,
      buildFlexConfigWithSecretsAt('https://coletor.example/recebe'),
    );

    // Assert: refused with its code, naming the host.
    expect(outcome, 'the store must refuse a source to a host off the list').toEqual({
      ok: false,
      error: {
        code: 'DATA_SOURCE_HOST_NOT_ALLOWED',
        message:
          'O servidor não busca dados em coletor.example (classificacao): esse endereço não está em BAJAOVRLAY_SOURCE_ALLOWED_HOSTS.',
      },
    });
  });
});

describe('the boot warning', () => {
  it('warns at boot when BAJAOVRLAY_SOURCE_ALLOWED_HOSTS is not set', async () => {
    // Arrange: a logger that keeps every line.
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot with no list.
    const runningServer = await startServer({
      ...buildBootOptions(committedMigrationsFolder),
      logger,
    });
    onTestFinished(() => runningServer.close());

    // Assert: one warning naming the variable.
    const warnings = readRecordedLines().filter(
      (line) => line.level === 'warn' && line.variable === 'BAJAOVRLAY_SOURCE_ALLOWED_HOSTS',
    );
    expect(warnings.length, 'a boot with no list must warn once').toBe(1);
    expect(warnings[0]?.message, 'the warning must say what having no list means').toBe(
      'BAJAOVRLAY_SOURCE_ALLOWED_HOSTS is not set: flex sources may fetch any host, and no BAJAOVRLAY_SOURCE_ variable value will be sent',
    );
  });

  it('does not warn when BAJAOVRLAY_SOURCE_ALLOWED_HOSTS is set', async () => {
    // Arrange: a logger that keeps every line.
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot with a list.
    const runningServer = await startServer({
      ...buildBootOptions(committedMigrationsFolder),
      logger,
      sourceHostAllowlist: allowlistOfTheLanTimingSystemOnly,
    });
    onTestFinished(() => runningServer.close());

    // Assert: no line names the variable.
    const linesNamingTheVariable = readRecordedLines().filter(
      (line) => line.variable === 'BAJAOVRLAY_SOURCE_ALLOWED_HOSTS',
    );
    expect(linesNamingTheVariable, 'a boot with a list must not warn').toEqual([]);
  });
});
