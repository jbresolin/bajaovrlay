/**
 * GET /api/v1/data-sources/{sourceId}/snapshot (apps/server)
 *
 * What this module is for:
 *   The latest good data of one source, the same snapshot the `dataSnapshots` slice
 *   holds, for anyone who wants to look at it without a WebSocket (a curl while
 *   debugging the simulator, a later tool). The route is thin: it reads the store.
 *
 * What these tests prove:
 *   - A source with data answers 200 with its snapshot, which passes the shared schema.
 *   - An unknown source answers a JSON 404 naming the source, in pt-BR.
 *   - A known source with no data yet answers a JSON 404 saying so, in pt-BR.
 *   - The OpenAPI document describes the route.
 *
 * What these tests deliberately do not cover:
 *   - How the snapshot got there (the poller and recordDataSourcePoll, tested apart).
 */
import { DataSnapshotSchema } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createServerApp } from '../../core/http/createServerApp.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { missingGraphicsFolderPath } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { buildDataSourcePollerActor } from '../../core/store/commandActors.js';
import { createStateStore } from '../../core/store/createStateStore.js';
import { buildGreenFlagSessionAt } from './reducers/dataSourceSlices.testSupport.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
const pollAtTwoPmMs = Date.parse('2027-08-14T14:00:00.000Z');

/** Builds the server app on a fresh store, with "Simulador — Enduro" seeded and off. */
function createServerAppWithTheSeededSimulator() {
  const logger = createLogger({ level: 'silent' });
  const stateStore = createStateStore({
    database: openTemporaryDatabase().database,
    logger,
    graphicPackagesFolder: missingGraphicsFolderPath,
  });
  const app = createServerApp({ logger, version: '0.3.1', stateStore });
  return { app, stateStore };
}

describe('GET /api/v1/data-sources/{sourceId}/snapshot', () => {
  it('answers 200 with the latest snapshot of a source that has data', async () => {
    // Arrange: the simulator on, with one good poll at 14:00 recorded by its poller.
    const { app, stateStore } = createServerAppWithTheSeededSimulator();
    stateStore.applyCommand(
      { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: true },
      operatorActor,
    );
    stateStore.applyCommand(
      {
        type: 'recordDataSourcePoll',
        sourceId: 'simulador-enduro',
        result: {
          ok: true,
          shapes: { session: buildGreenFlagSessionAt(pollAtTwoPmMs) },
          receivedAtMs: pollAtTwoPmMs,
        },
      },
      buildDataSourcePollerActor('simulador-enduro'),
    );

    // Act: ask for the simulator's snapshot.
    const response = await app.request('/api/v1/data-sources/simulador-enduro/snapshot');
    const body: unknown = await response.json();

    // Assert: 200, a snapshot the shared schema accepts, the one of 14:00.
    expect(response.status, 'a source with data must answer 200 OK').toBe(200);
    expect(DataSnapshotSchema.safeParse(body).success, 'the body must be a DataSnapshot').toBe(
      true,
    );
    expect(body, 'the body must be the snapshot of the poll at 14:00').toEqual({
      sourceId: 'simulador-enduro',
      receivedAtMs: pollAtTwoPmMs,
      shapes: { session: buildGreenFlagSessionAt(pollAtTwoPmMs) },
    });
  });

  const notFoundScenarios = [
    // A mistyped or deleted source.
    {
      name: 'answers a JSON 404 naming a source that does not exist',
      sourceId: 'cronometragem-oficial',
      expectedError: {
        code: 'DATA_SOURCE_NOT_FOUND',
        message: 'A fonte de dados "cronometragem-oficial" não existe; ela pode ter sido excluída.',
      },
    },
    // The seeded simulator, never turned on: it exists but has nothing to show.
    {
      name: 'answers a JSON 404 for a source that has no data yet',
      sourceId: 'simulador-enduro',
      expectedError: {
        code: 'DATA_SNAPSHOT_NOT_FOUND',
        message: 'A fonte de dados "Simulador — Enduro" ainda não tem dados.',
      },
    },
  ];

  it.each(notFoundScenarios)('$name', async ({ sourceId, expectedError }) => {
    // Arrange: the server app with the seeded simulator, off and without data.
    const { app } = createServerAppWithTheSeededSimulator();

    // Act: ask for the snapshot of the source.
    const response = await app.request(`/api/v1/data-sources/${sourceId}/snapshot`);
    const body: unknown = await response.json();

    // Assert: 404 in JSON, with a stable code and a pt-BR message.
    expect(response.status, 'no snapshot must answer 404 Not Found').toBe(404);
    expect(body, 'the error must carry a stable code and a message in pt-BR').toEqual({
      error: expectedError,
    });
  });
});

describe('the OpenAPI document', () => {
  it('describes the snapshot route', async () => {
    // Arrange: the server app.
    const { app } = createServerAppWithTheSeededSimulator();

    // Act: ask for the generated OpenAPI document.
    const response = await app.request('/api/v1/openapi.json');
    const document = (await response.json()) as {
      paths: Record<string, { get?: { parameters?: Array<{ name: string; in: string }> } }>;
    };
    const snapshotRoute = document.paths['/data-sources/{sourceId}/snapshot'];

    // Assert: the route is in it, with its path parameter.
    expect(
      snapshotRoute,
      'the snapshot route must be described in the OpenAPI document',
    ).toBeDefined();
    expect(
      snapshotRoute?.get?.parameters?.map((parameter) => [parameter.name, parameter.in]),
      'the source id must be described as a path parameter',
    ).toEqual([['sourceId', 'path']]);
  });
});
