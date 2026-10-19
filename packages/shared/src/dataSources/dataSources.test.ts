/**
 * Data sources, their configs, snapshots and recordings (packages/shared)
 *
 * What this module is for:
 *   A data source is something the server polls for race data (today the simulator and
 *   a replay of a recording). The `dataSources` slice lists the sources with their
 *   configuration and health, `dataSnapshots` keeps the last good shapes of each source,
 *   and `recordings` lists the recorded feeds a replay can play back. Operators create,
 *   change, delete, turn on and off, poll and record sources; the server's poller
 *   reports every poll with recordDataSourcePoll.
 *
 * What these tests prove:
 *   - Each kind's config fills its defaults (the seeded simulator is `{}` plus defaults)
 *     and refuses values out of range, naming the field; the simulator's seed is a
 *     whole number from 0 to 2^32 − 1, the values its generator tells apart.
 *   - A simulator source, a replay source (its status with failingSinceMs included), a
 *     flex HTTP/JSON source, a snapshot and a recording are accepted unchanged; a source
 *     whose config belongs to another kind is refused.
 *
 * What these tests deliberately do not cover:
 *   - The commands; dataSourceCommands.test.ts covers them.
 *   - The rules of the flex source's config; httpJsonConfig.test.ts covers them.
 *   - Whether the shapes in a poll are valid, and every other rule (unknown source,
 *     replay of an unknown recording, who may send what): the reducers and the
 *     authorisation hook in apps/server cover them.
 */
import { describe, expect, it } from 'vitest';

import { DataSnapshotSchema } from './dataSnapshot.js';
import { DataSourceSchema } from './dataSource.js';
import { RecordingSchema } from './recording.js';
import { ReplayConfigSchema } from './replayConfig.js';
import { SimulatorConfigSchema } from './simulatorConfig.js';

/** Builds the seeded "Simulador — Enduro" after it was turned on and polled once, healthy. */
function buildHealthyEnduroSimulatorSource() {
  return {
    id: 'simulador-enduro',
    label: 'Simulador — Enduro',
    kind: 'simulator',
    config: {
      seed: 2027,
      carCount: 60,
      sessionDurationMs: 14_400_000,
      lapLengthKm: 2,
      speed: 1,
      simulatedStartAtMs: 1_805_563_800_000,
      isFailing: false,
    },
    pollIntervalMs: 2_000,
    isEnabled: true,
    isRecording: false,
    status: {
      lastAttemptAtMs: 1_805_568_240_948,
      lastOkAtMs: 1_805_568_240_948,
      lastError: null,
      consecutiveFailures: 0,
      isStale: false,
      staleAfterMs: 6_000,
      recordingError: null,
    },
  };
}

/** Builds a replay of Saturday's enduro recording at 10×, stale after a failed poll. */
function buildStaleReplaySource() {
  return {
    id: 'replay-enduro-sabado',
    label: 'Reprodução — Enduro de sábado',
    kind: 'replay',
    config: {
      recordingId: 'simulador-enduro/2027-08-14T13-00-00.000Z.jsonl',
      speed: 10,
      isLooping: true,
      replayStartedAtMs: 1_805_568_000_000,
    },
    pollIntervalMs: 1_000,
    isEnabled: true,
    isRecording: false,
    pollNowRequestedAtMs: 1_805_568_230_000,
    status: {
      lastAttemptAtMs: 1_805_568_240_000,
      lastOkAtMs: 1_805_568_236_000,
      lastError: 'Gravação ilegível.',
      consecutiveFailures: 2,
      isStale: true,
      staleAfterMs: 3_000,
      recordingError: null,
      // Failing since its first failed poll, two seconds after its last good one.
      failingSinceMs: 1_805_568_238_000,
    },
  };
}

/** Builds a flex source reading an imaginary timing system's classification, off. */
function buildTimingSystemFlexSourceTurnedOff() {
  return {
    id: 'cronometragem-classificacao',
    label: 'Cronometragem — Classificação',
    kind: 'httpJson',
    config: {
      requests: [
        {
          requestId: 'classificacao',
          url: 'http://cronometragem.local:8080/api/classificacao',
          headers: [
            { name: 'Authorization', valueFromEnvironment: 'BAJAOVRLAY_SOURCE_CRONO_TOKEN' },
          ],
          queryParameters: [],
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

describe('SimulatorConfigSchema and ReplayConfigSchema', () => {
  it('fills every default of the simulator from an empty config', () => {
    // Arrange: the config the seed starts from: nothing chosen.
    const emptyConfig = {};

    // Act: parse it.
    const parsedConfig = SimulatorConfigSchema.parse(emptyConfig);

    // Assert: seed 2027, 60 cars, four hours, 2 km laps, real time, not failing.
    expect(parsedConfig, "the simulator defaults must be the brief's").toEqual({
      seed: 2027,
      carCount: 60,
      sessionDurationMs: 14_400_000,
      lapLengthKm: 2,
      speed: 1,
      isFailing: false,
    });
  });

  it('accepts the largest 32-bit seed, 4 294 967 295', () => {
    // Arrange: the last seed the generator can tell apart from every other.
    const largestSeedConfig = { seed: 4_294_967_295 };

    // Act: parse it.
    const result = SimulatorConfigSchema.safeParse(largestSeedConfig);

    // Assert: accepted, unchanged.
    expect(result.success, 'the largest 32-bit seed must be accepted').toBe(true);
    expect(result.data?.seed, 'the seed must be kept as given').toBe(4_294_967_295);
  });

  it('fills the replay defaults around the recording it names', () => {
    // Arrange: a replay config naming only its recording.
    const configNamingTheRecording = {
      recordingId: 'simulador-enduro/2027-08-14T13-00-00.000Z.jsonl',
    };

    // Act: parse it.
    const parsedConfig = ReplayConfigSchema.parse(configNamingTheRecording);

    // Assert: real speed, no loop, from the start.
    expect(parsedConfig, 'a replay plays once at real speed by default').toEqual({
      recordingId: 'simulador-enduro/2027-08-14T13-00-00.000Z.jsonl',
      speed: 1,
      isLooping: false,
    });
  });

  const refusedConfigScenarios = [
    // Fewer than ten cars is not an enduro worth rehearsing a tower with.
    {
      name: 'refuses a simulator with 9 cars',
      schema: SimulatorConfigSchema,
      config: { carCount: 9 },
      badField: 'carCount',
    },
    // More than a hundred cars is beyond the fictional team list.
    {
      name: 'refuses a simulator with 101 cars',
      schema: SimulatorConfigSchema,
      config: { carCount: 101 },
      badField: 'carCount',
    },
    // Simulated time runs at most 60 times faster than real time.
    {
      name: 'refuses a simulator at speed 61',
      schema: SimulatorConfigSchema,
      config: { speed: 61 },
      badField: 'speed',
    },
    // A session of no length has no race in it.
    {
      name: 'refuses a simulator session of 0 ms',
      schema: SimulatorConfigSchema,
      config: { sessionDurationMs: 0 },
      badField: 'sessionDurationMs',
    },
    // A typo with extra zeros (167 days) would make every poll drive the cars for months.
    {
      name: 'refuses a simulator session longer than a day',
      schema: SimulatorConfigSchema,
      config: { sessionDurationMs: 144_000_000_000 },
      badField: 'sessionDurationMs',
    },
    // The generator reads only the low 32 bits of a seed, so 2^32 would replay seed 0's
    // race under another number: the seed is capped at 32 bits.
    {
      name: 'refuses a simulator seed of 2^32',
      schema: SimulatorConfigSchema,
      config: { seed: 4_294_967_296 },
      badField: 'seed',
    },
    // A negative seed would also be another seed's race in disguise (-1 is 2^32 − 1).
    {
      name: 'refuses a negative simulator seed',
      schema: SimulatorConfigSchema,
      config: { seed: -1 },
      badField: 'seed',
    },
    // The replay speeds are a fixed list; 3× is not on it.
    {
      name: 'refuses a replay at speed 3',
      schema: ReplayConfigSchema,
      config: { recordingId: 'simulador-enduro/2027-08-14T13-00-00.000Z.jsonl', speed: 3 },
      badField: 'speed',
    },
    // A replay that names no recording has nothing to play.
    {
      name: 'refuses a replay without its recording',
      schema: ReplayConfigSchema,
      config: { speed: 10 },
      badField: 'recordingId',
    },
  ];

  it.each(refusedConfigScenarios)('$name', ({ schema, config, badField }) => {
    // Arrange: the config of this row (built above).

    // Act: parse it.
    const result = schema.safeParse(config);

    // Assert: refused, naming the field.
    expect(result.success, 'this config must be refused').toBe(false);
    expect(result.error?.issues[0]?.path, 'the refusal must name the bad field').toEqual([
      badField,
    ]);
  });
});

describe('DataSourceSchema, DataSnapshotSchema and RecordingSchema', () => {
  const acceptedSourceScenarios = [
    // The seeded simulator, on and healthy.
    { name: 'accepts a healthy simulator source', source: buildHealthyEnduroSimulatorSource() },
    // A replay that failed twice (failingSinceMs kept), with a pending "Atualizar agora".
    { name: 'accepts a stale replay source', source: buildStaleReplaySource() },
    // A flex source whose token is named by a server variable, never written in the config.
    { name: 'accepts a flex HTTP/JSON source', source: buildTimingSystemFlexSourceTurnedOff() },
  ];

  it.each(acceptedSourceScenarios)('$name', ({ source }) => {
    // Arrange: the source of this row (built above).

    // Act: check it.
    const result = DataSourceSchema.safeParse(source);

    // Assert: accepted unchanged.
    expect(result.success, 'a realistic source must be accepted').toBe(true);
    expect(result.data, 'the accepted source must not be altered').toEqual(source);
  });

  it('refuses a replay source carrying a simulator config', () => {
    // Arrange: a replay whose config has no recording, only simulator fields.
    const replayWithSimulatorConfig = {
      ...buildStaleReplaySource(),
      config: buildHealthyEnduroSimulatorSource().config,
    };

    // Act: check it.
    const result = DataSourceSchema.safeParse(replayWithSimulatorConfig);

    // Assert: refused, at the config.
    expect(result.success, "the config must belong to the source's kind").toBe(false);
    expect(result.error?.issues[0]?.path[0], 'the refusal must point at the config').toBe('config');
  });

  it('accepts a snapshot holding a session shape, unchanged', () => {
    // Arrange: the last good session of the simulator.
    const snapshot = {
      sourceId: 'simulador-enduro',
      receivedAtMs: 1_805_568_240_948,
      shapes: {
        session: {
          sessionId: 'enduro-2027-nacional',
          eventName: 'Baja SAE Brasil 2027 — Etapa Nacional',
          sessionName: 'Enduro de Resistência',
          sessionKind: 'enduro',
          state: 'green',
          clock: {
            clockMode: 'remaining',
            referenceTimeMs: 4_559_052,
            referenceWallClockMs: 1_805_568_240_948,
            running: true,
          },
          scheduledDurationMs: 14_400_000,
          lapsCompletedByLeader: 34,
          updatedAtMs: 1_805_568_240_948,
        },
      },
    };

    // Act: check it.
    const result = DataSnapshotSchema.safeParse(snapshot);

    // Assert: accepted unchanged.
    expect(result.success, 'a realistic snapshot must be accepted').toBe(true);
    expect(result.data, 'the accepted snapshot must not be altered').toEqual(snapshot);
  });

  it('accepts a recording still open and one closed', () => {
    // Arrange: one recording under way and one finished with 1 800 snapshots.
    const openRecording = {
      id: 'simulador-enduro/2027-08-14T13-00-00.000Z.jsonl',
      sourceId: 'simulador-enduro',
      sourceLabel: 'Simulador — Enduro',
      fileName: '2027-08-14T13-00-00.000Z.jsonl',
      startedAtMs: 1_786_712_400_000,
      endedAtMs: null,
      snapshotCount: 12,
    };
    const closedRecording = {
      ...openRecording,
      endedAtMs: 1_786_716_000_000,
      snapshotCount: 1_800,
    };

    // Act: check both.
    const openResult = RecordingSchema.safeParse(openRecording);
    const closedResult = RecordingSchema.safeParse(closedRecording);

    // Assert: both accepted.
    expect(openResult.success, 'an open recording has no end yet').toBe(true);
    expect(closedResult.success, 'a closed recording carries its end').toBe(true);
  });
});
