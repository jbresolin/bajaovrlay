// Test support: data sources, their last data and their recordings as the server sends
// them in the `dataSources`, `dataSnapshots` and `recordings` slices. The race data is
// the shared samples of packages/shared/src/dataShapes/samples (the 60-car enduro at lap
// 34), read through the shared schemas so a sample that drifts from its shape fails here
// first. Every builder returns new objects, so no test can change another test's data.
import {
  type DataSnapshot,
  type DataSourceStatus,
  PositionsShapeSchema,
  type Recording,
  type ReplayDataSource,
  SessionShapeSchema,
  type SimulatorDataSource,
  type Slices,
  StandingsShapeSchema,
} from '@bajaovrlay/shared';

import positionsAtLap34Sample from '../../../../packages/shared/src/dataShapes/samples/positions.enduro-lap-34.json';
import greenFlagSessionSample from '../../../../packages/shared/src/dataShapes/samples/session.enduro-green.json';
import overallStandingsSample from '../../../../packages/shared/src/dataShapes/samples/standings.overall.json';
import { buildSlicesWithNothingOnAir } from './slicesLikeTheServerSends.testSupport';

/** The id the server gives the simulator it seeds on its first boot. */
export const seededSimulatorId = 'simulador-enduro';
/** The id of a replay source an operator made for Friday's rehearsal. */
export const rehearsalReplayId = 'reproducao-ensaio';

/**
 * The moment of the samples (Saturday 20 March 2027, 15:44:00.948 in Brasília): when
 * their data was produced and when the session clock was read. The sources below had
 * their last good poll then.
 */
export const momentOfTheSamplesMs = 1_805_568_240_948;

/**
 * When the failing simulators below started failing: their first failed poll, one poll
 * interval (2 s) after the moment of the samples. "Erro" counts its minute from here.
 */
export const momentTheSimulatorStartedFailingMs = momentOfTheSamplesMs + 2_000;

/** The simulator's config as the server stores it after parsing `{}`: every default. */
function buildDefaultSimulatorConfigAsStored(): SimulatorDataSource['config'] {
  return {
    seed: 2027,
    carCount: 60,
    sessionDurationMs: 14_400_000,
    lapLengthKm: 2,
    speed: 1,
    isFailing: false,
  };
}

/** The status of a source whose every poll has been good, the last at `lastOkAtMs`. */
function buildHealthyStatus(lastOkAtMs: number): DataSourceStatus {
  return {
    lastAttemptAtMs: lastOkAtMs,
    lastOkAtMs,
    lastError: null,
    consecutiveFailures: 0,
    isStale: false,
    staleAfterMs: 6_000,
    recordingError: null,
  };
}

/** The seeded "Simulador — Enduro", off, as the server sends it after its first boot. */
export function buildSeededSimulatorThatIsOff(): SimulatorDataSource {
  return {
    id: seededSimulatorId,
    label: 'Simulador — Enduro',
    kind: 'simulator',
    config: buildDefaultSimulatorConfigAsStored(),
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

/** The seeded simulator turned on, its last poll good at the moment of the samples. */
export function buildSimulatorThatIsOk(): SimulatorDataSource {
  return {
    ...buildSeededSimulatorThatIsOff(),
    config: { ...buildDefaultSimulatorConfigAsStored(), simulatedStartAtMs: 1_805_553_000_000 },
    isEnabled: true,
    status: buildHealthyStatus(momentOfTheSamplesMs),
  };
}

/**
 * The simulator with "Falha simulada" switched on: three polls failed after the last good
 * one, the first at momentTheSimulatorStartedFailingMs, so it is late ("atrasada") and
 * keeps its last data.
 */
export function buildSimulatorThatIsStale(): SimulatorDataSource {
  const simulatorThatIsOk = buildSimulatorThatIsOk();
  return {
    ...simulatorThatIsOk,
    config: { ...simulatorThatIsOk.config, isFailing: true },
    status: {
      ...buildHealthyStatus(momentOfTheSamplesMs),
      lastAttemptAtMs: momentOfTheSamplesMs + 6_000,
      lastError: 'Falha simulada.',
      consecutiveFailures: 3,
      isStale: true,
      failingSinceMs: momentTheSimulatorStartedFailingMs,
    },
  };
}

/**
 * The simulator whose data stood still for ten minutes (a finished session repeats the
 * same data, so the server kept lastOkAtMs ten minutes back) and whose first poll failed
 * at momentTheSimulatorStartedFailingMs: João's case at the gate 2 re-check of PR #16.
 */
export function buildSimulatorFailingAfterItsDataStoodStillForTenMinutes(): SimulatorDataSource {
  const simulatorThatIsOk = buildSimulatorThatIsOk();
  return {
    ...simulatorThatIsOk,
    status: {
      ...simulatorThatIsOk.status,
      lastAttemptAtMs: momentTheSimulatorStartedFailingMs,
      lastOkAtMs: momentTheSimulatorStartedFailingMs - 600_000,
      lastError: 'Falha simulada.',
      consecutiveFailures: 1,
      isStale: true,
      failingSinceMs: momentTheSimulatorStartedFailingMs,
    },
  };
}

/**
 * The healthy simulator right after a restart: its old data kept, marked late by the
 * restart, with no error and not failing, waiting for its first poll.
 */
export function buildSimulatorMarkedLateByARestart(): SimulatorDataSource {
  const simulatorThatIsOk = buildSimulatorThatIsOk();
  return {
    ...simulatorThatIsOk,
    status: { ...simulatorThatIsOk.status, isStale: true },
  };
}

/**
 * The simulator turned on but failing from its first poll: no good data ever, so there is
 * nothing to be late, only an error.
 */
export function buildSimulatorThatNeverHadData(): SimulatorDataSource {
  return {
    ...buildSimulatorThatIsOk(),
    status: {
      lastAttemptAtMs: momentOfTheSamplesMs,
      lastError: 'Tempo esgotado: a fonte não respondeu em 2 s.',
      consecutiveFailures: 4,
      isStale: true,
      staleAfterMs: 6_000,
      recordingError: null,
      failingSinceMs: momentOfTheSamplesMs - 6_000,
    },
  };
}

/** The simulator, healthy, with every good poll appended to a recording. */
export function buildSimulatorThatIsRecording(): SimulatorDataSource {
  return { ...buildSimulatorThatIsOk(), isRecording: true };
}

/** The simulator whose recording stopped on its own because the disk filled up. */
export function buildSimulatorWhoseRecordingFailed(): SimulatorDataSource {
  const simulatorThatIsOk = buildSimulatorThatIsOk();
  return {
    ...simulatorThatIsOk,
    status: {
      ...simulatorThatIsOk.status,
      recordingError:
        'A gravação parou: o servidor não conseguiu escrever o arquivo (disco cheio ou sem permissão).',
    },
  };
}

/** Friday's rehearsal: a replay of Friday's recording at 10×, on and healthy. */
export function buildRehearsalReplayThatIsOk(): ReplayDataSource {
  return {
    id: rehearsalReplayId,
    label: 'Ensaio de sexta',
    kind: 'replay',
    config: {
      recordingId: buildFridaysEndedRecording().id,
      speed: 10,
      isLooping: true,
      replayStartedAtMs: momentOfTheSamplesMs - 60_000,
    },
    pollIntervalMs: 2_000,
    isEnabled: true,
    isRecording: false,
    status: buildHealthyStatus(momentOfTheSamplesMs),
  };
}

/** Friday's recording of the simulator: one hour, 1 800 readings, ended. */
export function buildFridaysEndedRecording(): Recording {
  return {
    id: 'simulador-enduro/2027-03-19T13-00-00.000Z.jsonl',
    sourceId: seededSimulatorId,
    sourceLabel: 'Simulador — Enduro',
    fileName: '2027-03-19T13-00-00.000Z.jsonl',
    startedAtMs: Date.parse('2027-03-19T13:00:00.000Z'),
    endedAtMs: Date.parse('2027-03-19T14:00:00.000Z'),
    snapshotCount: 1_800,
  };
}

/** The recording the simulator is making right now: still open, so it cannot be replayed. */
export function buildRecordingStillOpen(): Recording {
  return {
    id: 'simulador-enduro/2027-03-20T18-30-00.000Z.jsonl',
    sourceId: seededSimulatorId,
    sourceLabel: 'Simulador — Enduro',
    fileName: '2027-03-20T18-30-00.000Z.jsonl',
    startedAtMs: Date.parse('2027-03-20T18:30:00.000Z'),
    endedAtMs: null,
    snapshotCount: 420,
  };
}

/**
 * The last data of `sourceId`: the enduro under green flag at lap 34 (session, 60 cars,
 * overall standings), received at the moment of the samples.
 */
export function buildEnduroSnapshotAtLap34(sourceId: string): DataSnapshot {
  return {
    sourceId,
    receivedAtMs: momentOfTheSamplesMs,
    shapes: {
      session: SessionShapeSchema.parse(greenFlagSessionSample),
      positions: PositionsShapeSchema.parse(positionsAtLap34Sample),
      standings: StandingsShapeSchema.parse(overallStandingsSample),
    },
  };
}

/** The same snapshot with the session under a red flag: the clock is held. */
export function buildEnduroSnapshotUnderRedFlag(sourceId: string): DataSnapshot {
  const snapshot = buildEnduroSnapshotAtLap34(sourceId);
  const session = SessionShapeSchema.parse(greenFlagSessionSample);
  snapshot.shapes.session = {
    ...session,
    state: 'red',
    clock: { ...session.clock, running: false },
  };
  return snapshot;
}

/** What a hello holds with nothing on air and these data sources, data and recordings. */
export function buildSlicesWithDataSources(parts: {
  dataSources: Slices['dataSources'];
  dataSnapshots?: Slices['dataSnapshots'];
  recordings?: Slices['recordings'];
}): Slices {
  return {
    ...buildSlicesWithNothingOnAir(),
    dataSources: parts.dataSources,
    dataSnapshots: parts.dataSnapshots ?? [],
    recordings: parts.recordings ?? [],
  };
}
