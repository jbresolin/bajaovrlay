/**
 * "Editar": the updateDataSource reducer (apps/server)
 *
 * What this module is for:
 *   The "Fontes" page edits a source. Only what the command carries changes; a new
 *   config is checked by the schema of the source's kind and replaces the stored one
 *   whole, with defaults filled in. The timeline start (when the race or the replay
 *   began) is the server's: the stored one is kept, so saving the form does not restart
 *   anything, except a replay switched to another recording, offset or speed, which
 *   starts again from the top (decision D5).
 *
 * What these tests prove:
 *   - Only what the command carries changes; the stale limit follows the interval.
 *   - The stored race start is kept, also over one the page sends.
 *   - A replay that is on and switched to another recording starts again now; a replay
 *     edited without touching its playback keeps its start.
 *   - An edit that changes nothing hands back the same slices; an unknown source and a
 *     config that fails its schema are refused.
 *
 * What these tests deliberately do not cover:
 *   - Creating a source; createDataSource.test.ts covers it, with every config refusal.
 *   - Turning a source on and off; setDataSourceEnabled.test.ts covers it.
 *   - Who may send these commands; authorizeDataSourceCommands.test.ts in core/store.
 */
import { describe, expect, it } from 'vitest';

import {
  buildEnduroSimulatorTurnedOff,
  buildFridayRecording,
  buildFridayReplayTurnedOff,
  buildHealthyEnduroSimulator,
  buildRaceDaySlicesWithDataSources,
  contextOfTheDataSourceCommand,
  fridayRecordingId,
  momentOfTheCommandMs,
} from './dataSourceSlices.testSupport.js';
import { reduceDataSourceCommand } from './reduceDataSourceCommand.js';

/** The moment the replay in these tests was turned on: 14:20, twelve minutes before the edit. */
const replayTurnedOnAtMs = Date.parse('2027-08-14T14:20:00.000Z');

/** Builds the replay of Friday's recording, on since 14:20. */
function buildFridayReplayOnSince1420() {
  const replayTurnedOff = buildFridayReplayTurnedOff();
  return {
    ...replayTurnedOff,
    config: { ...replayTurnedOff.config, replayStartedAtMs: replayTurnedOnAtMs },
    isEnabled: true,
  };
}

/** Builds Thursday's recording of the simulator, closed: a second recording to switch to. */
function buildThursdayRecording() {
  return {
    ...buildFridayRecording(),
    id: 'simulador-enduro/2027-08-12T15-00-00.000Z.jsonl',
    fileName: '2027-08-12T15-00-00.000Z.jsonl',
    startedAtMs: Date.parse('2027-08-12T15:00:00.000Z'),
    endedAtMs: Date.parse('2027-08-12T15:30:00.000Z'),
    snapshotCount: 900,
  };
}

describe('updateDataSource', () => {
  it('changes only the label when only the label is sent', () => {
    // Arrange: the seeded simulator.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: rename it.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'updateDataSource', sourceId: 'simulador-enduro', label: 'Enduro simulado' },
      contextOfTheDataSourceCommand,
    );

    // Assert: new label, everything else as it was.
    const sourcesAfter = outcome.status === 'applied' ? outcome.slices.dataSources : [];
    expect(sourcesAfter, 'only the label may change').toEqual([
      { ...buildEnduroSimulatorTurnedOff(), label: 'Enduro simulado' },
    ]);
  });

  it('moves the stale limit with the poll interval', () => {
    // Arrange: the seeded simulator, polled every 2 s (stale after 6 s).
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: poll it every 10 s instead.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'updateDataSource', sourceId: 'simulador-enduro', pollIntervalMs: 10_000 },
      contextOfTheDataSourceCommand,
    );

    // Assert: the interval and the stale limit (three intervals) both changed.
    const sourceAfter = outcome.status === 'applied' ? outcome.slices.dataSources[0] : undefined;
    expect(sourceAfter?.pollIntervalMs, 'the new interval must be stored').toBe(10_000);
    expect(sourceAfter?.status.staleAfterMs, 'stale after three intervals').toBe(30_000);
  });

  it('completes a new config and keeps the race start the config leaves out', () => {
    // Arrange: the simulator on, its race started at 14:00.
    const runningSimulator = buildHealthyEnduroSimulator();
    const slicesBefore = buildRaceDaySlicesWithDataSources({ dataSources: [runningSimulator] });

    // Act: the edit form sends the failing switch on, and nothing else.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'updateDataSource', sourceId: 'simulador-enduro', config: { isFailing: true } },
      contextOfTheDataSourceCommand,
    );

    // Assert: defaults filled, failing, and the race still started at 14:00.
    const sourceAfter = outcome.status === 'applied' ? outcome.slices.dataSources[0] : undefined;
    expect(sourceAfter?.config, 'editing must not restart the race').toEqual({
      seed: 2027,
      carCount: 60,
      sessionDurationMs: 14_400_000,
      lapLengthKm: 2,
      speed: 1,
      isFailing: true,
      simulatedStartAtMs: Date.parse('2027-08-14T14:00:00.000Z'),
    });
  });

  it('keeps the stored race start over one the page sends', () => {
    // Arrange: the simulator on, its race started at 14:00.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
    });

    // Act: an edit form sends back the config it read, with the race start rewound to 09:00.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'updateDataSource',
        sourceId: 'simulador-enduro',
        config: { isFailing: true, simulatedStartAtMs: Date.parse('2027-08-14T09:00:00.000Z') },
      },
      contextOfTheDataSourceCommand,
    );

    // Assert: the race still started at 14:00.
    const sourceAfter = outcome.status === 'applied' ? outcome.slices.dataSources[0] : undefined;
    const simulatedStartAtMs =
      sourceAfter?.kind === 'simulator' ? sourceAfter.config.simulatedStartAtMs : undefined;
    expect(simulatedStartAtMs, 'a page must not be able to rewind the race').toBe(
      Date.parse('2027-08-14T14:00:00.000Z'),
    );
  });

  const replayTimelineScenarios = [
    // Keeping the old start would jump Thursday's half-hour to "12 min × 10" = past its end.
    {
      name: 'starts a replay that is on again from the top when it switches recording',
      config: { recordingId: 'simulador-enduro/2027-08-12T15-00-00.000Z.jsonl', speed: 10 },
      expectedReplayStartedAtMs: momentOfTheCommandMs,
    },
    // A new speed moves the playback point as much as a new recording does.
    {
      name: 'starts a replay that is on again from the top when its speed changes',
      config: { recordingId: fridayRecordingId, speed: 30 },
      expectedReplayStartedAtMs: momentOfTheCommandMs,
    },
    // Looping only matters past the end; the playback point stays where it is.
    {
      name: 'keeps the start of a replay edited without touching its playback',
      config: { recordingId: fridayRecordingId, speed: 10, isLooping: true },
      expectedReplayStartedAtMs: replayTurnedOnAtMs,
    },
  ];

  it.each(replayTimelineScenarios)('$name', ({ config, expectedReplayStartedAtMs }) => {
    // Arrange: Friday's replay at 10×, on since 14:20; Thursday's recording also closed.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildFridayReplayOnSince1420()],
      recordings: [buildThursdayRecording(), buildFridayRecording()],
    });

    // Act: save the edit form with this row's config at 14:32:05.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'updateDataSource', sourceId: 'reproducao-sexta', config },
      contextOfTheDataSourceCommand,
    );

    // Assert: the replay's start is the one this row expects.
    const sourceAfter = outcome.status === 'applied' ? outcome.slices.dataSources[0] : undefined;
    const replayStartedAtMs =
      sourceAfter?.kind === 'replay' ? sourceAfter.config.replayStartedAtMs : undefined;
    expect(
      replayStartedAtMs,
      'a replay restarts from the top only when what it plays changes (decision D5)',
    ).toBe(expectedReplayStartedAtMs);
  });

  it('hands back the very same slices when nothing changes', () => {
    // Arrange: the seeded simulator.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: save the edit form without touching anything.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      {
        type: 'updateDataSource',
        sourceId: 'simulador-enduro',
        label: 'Simulador — Enduro',
        config: {},
        pollIntervalMs: 2_000,
      },
      contextOfTheDataSourceCommand,
    );

    // Assert: the same arrays, so the store saves, logs and broadcasts nothing.
    expect(outcome, 'an edit that changes nothing must hand back the same slices').toEqual({
      status: 'applied',
      slices: slicesBefore,
    });
    expect(
      outcome.status === 'applied' ? outcome.slices.dataSources : undefined,
      'the sources must be the very same array',
    ).toBe(slicesBefore.dataSources);
  });

  const refusedUpdateScenarios = [
    // A source deleted on another tablet a moment ago.
    {
      name: 'refuses an unknown source',
      command: {
        type: 'updateDataSource' as const,
        sourceId: 'planilha-apagada',
        label: 'Planilha da cronometragem',
      },
      expectedError: {
        code: 'DATA_SOURCE_NOT_FOUND',
        message: 'A fonte de dados "planilha-apagada" não existe; ela pode ter sido excluída.',
      },
    },
    // Speed 61 is beyond the simulator's range.
    {
      name: 'refuses a simulator config at speed 61, naming config.speed',
      command: {
        type: 'updateDataSource' as const,
        sourceId: 'simulador-enduro',
        config: { speed: 61 },
      },
      expectedError: {
        code: 'INVALID_DATA_SOURCE_CONFIG',
        message:
          'A configuração da fonte é inválida: o campo "config.speed" está ausente ou tem um valor errado.',
      },
    },
  ];

  it.each(refusedUpdateScenarios)('$name', ({ command, expectedError }) => {
    // Arrange: the seeded simulator.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: send the update of this row.
    const outcome = reduceDataSourceCommand(slicesBefore, command, contextOfTheDataSourceCommand);

    // Assert: refused with this row's code and pt-BR text.
    expect(outcome, 'this update must be refused').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});
