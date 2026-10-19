/**
 * "+ Fonte": the createDataSource reducer (apps/server)
 *
 * What this module is for:
 *   The "Fontes" page creates a source. The config arrives as whatever the page sent and
 *   is checked here by the schema of the source's kind (simulator, replay or httpJson), with
 *   defaults filled in, so the stored config is always complete. A replay may only name
 *   a recording that exists and is closed. The timeline start is the server's alone.
 *
 * What these tests prove:
 *   - createDataSource adds the source off, with the id the store made, its config
 *     completed with defaults, and a stale limit of three poll intervals.
 *   - A timeline start sent by the page is dropped.
 *   - A flex HTTP/JSON source is stored with its config as parsed (lists filled in).
 *   - A config that fails its kind's schema is refused with INVALID_DATA_SOURCE_CONFIG,
 *     naming the field as `config.<path>` in pt-BR; a replay of an unknown or still open
 *     recording is refused with RECORDING_NOT_FOUND; a flex source naming a variable
 *     without the BAJAOVRLAY_SOURCE_ prefix, or a request it does not have, is refused
 *     naming the path inside its config.
 *
 * What these tests deliberately do not cover:
 *   - Editing a source; updateDataSource.test.ts covers it.
 *   - Turning a source on, which starts its timeline; setDataSourceEnabled.test.ts.
 *   - Who may send these commands; authorizeDataSourceCommands.test.ts in core/store.
 */
import { describe, expect, it } from 'vitest';

import {
  buildEnduroSimulatorTurnedOff,
  buildFridayRecording,
  buildRaceDaySlicesWithDataSources,
  contextOfTheDataSourceCommand,
  fridayRecordingId,
} from './dataSourceSlices.testSupport.js';
import { reduceDataSourceCommand } from './reduceDataSourceCommand.js';

/** A flex config reading an imaginary timing system's session, with `requestChanges` on its request. */
function buildTimingSystemFlexConfig(requestChanges: Record<string, unknown> = {}) {
  return {
    requests: [
      {
        requestId: 'classificacao',
        url: 'http://cronometragem.local:8080/api/classificacao',
        ...requestChanges,
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

describe('createDataSource', () => {
  it("adds a simulator, off, with the store's id, its defaults and a stale limit of 3 polls", () => {
    // Arrange: the seeded simulator only.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: create a training simulator with its own seed, polled every 5 s.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'createDataSource',
        label: 'Simulador — Treino',
        kind: 'simulator',
        config: { seed: 7 },
        pollIntervalMs: 5_000,
      },
      contextOfTheDataSourceCommand,
    );

    // Assert: two sources, the new one last, off, complete and not stale.
    const sourcesAfter = outcome.status === 'applied' ? outcome.slices.dataSources : [];
    expect(sourcesAfter, 'the new source must come after the seeded one').toEqual([
      buildEnduroSimulatorTurnedOff(),
      {
        id: contextOfTheDataSourceCommand.newDataSourceId,
        label: 'Simulador — Treino',
        kind: 'simulator',
        config: {
          seed: 7,
          carCount: 60,
          sessionDurationMs: 14_400_000,
          lapLengthKm: 2,
          speed: 1,
          isFailing: false,
        },
        pollIntervalMs: 5_000,
        isEnabled: false,
        isRecording: false,
        status: {
          lastError: null,
          consecutiveFailures: 0,
          isStale: false,
          staleAfterMs: 15_000,
          recordingError: null,
        },
      },
    ]);
  });

  it('adds a replay of a closed recording', () => {
    // Arrange: the simulator and its recording of Friday.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
      recordings: [buildFridayRecording()],
    });

    // Act: create a replay of it at 10×.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'createDataSource',
        label: 'Reprodução — Treino de sexta',
        kind: 'replay',
        config: { recordingId: fridayRecordingId, speed: 10 },
        pollIntervalMs: 1_000,
      },
      contextOfTheDataSourceCommand,
    );

    // Assert: the replay is there, its config completed.
    const newSource = outcome.status === 'applied' ? outcome.slices.dataSources[1] : undefined;
    expect(newSource?.config, 'the replay config must be completed with its defaults').toEqual({
      recordingId: fridayRecordingId,
      speed: 10,
      isLooping: false,
    });
  });

  it('drops a race start sent by the page: only the server starts a timeline', () => {
    // Arrange: the seeded simulator only.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: create a simulator whose config claims its race started at 09:00.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'createDataSource',
        label: 'Simulador — Treino',
        kind: 'simulator',
        config: { seed: 7, simulatedStartAtMs: Date.parse('2027-08-14T09:00:00.000Z') },
        pollIntervalMs: 2_000,
      },
      contextOfTheDataSourceCommand,
    );

    // Assert: no race start; turning the source on sets it.
    const newSource = outcome.status === 'applied' ? outcome.slices.dataSources[1] : undefined;
    expect(
      newSource?.config,
      'a timeline start sent by the page must be dropped',
    ).not.toHaveProperty('simulatedStartAtMs');
  });

  it('adds a flex HTTP/JSON source with its config as parsed, header and query lists filled in', () => {
    // Arrange: the seeded simulator only.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: create a flex source reading the timing system's classification.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'createDataSource',
        label: 'Cronometragem — Classificação',
        kind: 'httpJson',
        config: buildTimingSystemFlexConfig(),
        pollIntervalMs: 2_000,
      },
      contextOfTheDataSourceCommand,
    );

    // Assert: the flex source is there, its request completed with empty lists.
    const newSource = outcome.status === 'applied' ? outcome.slices.dataSources[1] : undefined;
    expect(newSource?.kind, 'the new source must be a flex source').toBe('httpJson');
    expect(newSource?.config, 'the config must be stored as parsed').toEqual({
      ...buildTimingSystemFlexConfig(),
      requests: [
        {
          requestId: 'classificacao',
          url: 'http://cronometragem.local:8080/api/classificacao',
          headers: [],
          queryParameters: [],
        },
      ],
    });
  });

  const refusedCreateScenarios = [
    // Nine cars is below the simulator's range; the form shows the field.
    {
      name: 'refuses a simulator with 9 cars, naming config.carCount',
      kind: 'simulator' as const,
      config: { carCount: 9 },
      expectedCode: 'INVALID_DATA_SOURCE_CONFIG',
      expectedMessage:
        'A configuração da fonte é inválida: o campo "config.carCount" está ausente ou tem um valor errado.',
    },
    // 3× is not one of the replay speeds.
    {
      name: 'refuses a replay at 3×, naming config.speed',
      kind: 'replay' as const,
      config: { recordingId: fridayRecordingId, speed: 3 },
      expectedCode: 'INVALID_DATA_SOURCE_CONFIG',
      expectedMessage:
        'A configuração da fonte é inválida: o campo "config.speed" está ausente ou tem um valor errado.',
    },
    // A config that is not an object at all is named as a whole.
    {
      name: 'refuses a config sent as text, naming config',
      kind: 'simulator' as const,
      config: 'seed=7',
      expectedCode: 'INVALID_DATA_SOURCE_CONFIG',
      expectedMessage:
        'A configuração da fonte é inválida: o campo "config" está ausente ou tem um valor errado.',
    },
    // A flex config may only send BAJAOVRLAY_SOURCE_ variables, so another server secret stays home.
    {
      name: 'refuses a flex source sending a variable without the prefix, naming its path',
      kind: 'httpJson' as const,
      config: buildTimingSystemFlexConfig({
        headers: [{ name: 'Authorization', valueFromEnvironment: 'DATABASE_PATH' }],
      }),
      expectedCode: 'INVALID_DATA_SOURCE_CONFIG',
      expectedMessage:
        'A configuração da fonte é inválida: o campo "config.requests.0.headers.0.valueFromEnvironment" está ausente ou tem um valor errado.',
    },
    // A mapping reading a request the source does not make would fail every poll.
    {
      name: 'refuses a flex source whose mapping reads a request it does not have',
      kind: 'httpJson' as const,
      config: {
        ...buildTimingSystemFlexConfig(),
        requests: [{ requestId: 'voltas', url: 'http://cronometragem.local:8080/api/voltas' }],
      },
      expectedCode: 'INVALID_DATA_SOURCE_CONFIG',
      expectedMessage:
        'A configuração da fonte é inválida: o campo "config.mappings.0.requestId" está ausente ou tem um valor errado.',
    },
    // A recording nobody made cannot be replayed.
    {
      name: 'refuses a replay of a recording that does not exist',
      kind: 'replay' as const,
      config: { recordingId: 'simulador-enduro/2027-08-01T09-00-00.000Z.jsonl' },
      expectedCode: 'RECORDING_NOT_FOUND',
      expectedMessage:
        'A gravação "simulador-enduro/2027-08-01T09-00-00.000Z.jsonl" não existe ou ainda está sendo gravada.',
    },
    // A recording still under way has no end yet; it is offered once it is closed.
    {
      name: 'refuses a replay of a recording still open',
      kind: 'replay' as const,
      config: { recordingId: 'simulador-enduro/2027-08-14T14-00-00.000Z.jsonl' },
      expectedCode: 'RECORDING_NOT_FOUND',
      expectedMessage:
        'A gravação "simulador-enduro/2027-08-14T14-00-00.000Z.jsonl" não existe ou ainda está sendo gravada.',
    },
  ];

  it.each(refusedCreateScenarios)('$name', ({ kind, config, expectedCode, expectedMessage }) => {
    // Arrange: Friday's closed recording and today's, still open.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
      recordings: [
        buildFridayRecording(),
        {
          ...buildFridayRecording(),
          id: 'simulador-enduro/2027-08-14T14-00-00.000Z.jsonl',
          fileName: '2027-08-14T14-00-00.000Z.jsonl',
          startedAtMs: Date.parse('2027-08-14T14:00:00.000Z'),
          endedAtMs: null,
          snapshotCount: 900,
        },
      ],
    });

    // Act: create the source of this row.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'createDataSource', label: 'Fonte nova', kind, config, pollIntervalMs: 2_000 },
      contextOfTheDataSourceCommand,
    );

    // Assert: refused with the code and the pt-BR text of this row.
    expect(outcome, 'this config must be refused, saying why in pt-BR').toEqual({
      status: 'refused',
      error: { code: expectedCode, message: expectedMessage },
    });
  });
});
