// Test support: the slices, sources, snapshots and recordings the data-source reducer
// tests start from, and the context the store would hand those reducers. Every function
// builds fresh objects on each call; nothing here is shared or mutated between tests.
import type {
  DataSnapshot,
  DataSource,
  Recording,
  ReplayDataSource,
  SessionShape,
  SimulatorDataSource,
} from '@bajaovrlay/shared';

import type {
  ReducerContext,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { buildRaceDaySlicesWithRundown } from '../../../core/store/reducers/rundownSlices.testSupport.js';
import { noSourceHostAllowlist } from '../adapters/httpJson/sourceHostAllowlist.js';

/** The moment every reducer test runs at: 14:32:05 UTC on 14 August 2027, the enduro day. */
export const momentOfTheCommandMs = Date.parse('2027-08-14T14:32:05.000Z');

/** The ids and time the store would hand a data-source reducer at that moment. */
export const contextOfTheDataSourceCommand: ReducerContext = {
  newInstanceId: '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f',
  now: '2027-08-14T14:32:05.000Z',
  newItemId: '5e8a2c1d-9f3b-4a7e-b6d4-2c1f0e9a8b7c',
  newQuickFirePanelId: 'd4b2e8f1-6a3c-4d7e-9b05-1c8f2a6e3d90',
  newMacroId: '8f3a1c6e-2d4b-4e9a-b7c5-0a1d3e5f7b92',
  newDataSourceId: 'c7e1a3f5-9b2d-4c6e-8a0f-3d5b7c9e1a24',
  newEventId: 'evento-digitado-1',
  sourceHostAllowlist: noSourceHostAllowlist,
  actor: 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81',
};

/** The id of the recording of Friday's training session, closed, ready to replay. */
export const fridayRecordingId = 'simulador-enduro/2027-08-13T13-00-00.000Z.jsonl';

/** Builds the seeded "Simulador — Enduro": default config, 2 s interval, off. */
export function buildEnduroSimulatorTurnedOff(): SimulatorDataSource {
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
      isFailing: false,
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

/**
 * Builds the same simulator turned on at 14:00 and polled well ever since: its race
 * started at 14:00, its last poll (good) two seconds before the command.
 */
export function buildHealthyEnduroSimulator(): SimulatorDataSource {
  const simulatorTurnedOff = buildEnduroSimulatorTurnedOff();
  return {
    ...simulatorTurnedOff,
    config: {
      ...simulatorTurnedOff.config,
      simulatedStartAtMs: Date.parse('2027-08-14T14:00:00.000Z'),
    },
    isEnabled: true,
    status: {
      ...simulatorTurnedOff.status,
      lastAttemptAtMs: momentOfTheCommandMs - 2_000,
      lastOkAtMs: momentOfTheCommandMs - 2_000,
    },
  };
}

/**
 * Builds the healthy simulator after three failed polls of "Falha simulada.": stale,
 * failing since the first of them, six seconds before the command.
 */
export function buildStaleEnduroSimulator(): SimulatorDataSource {
  const healthySimulator = buildHealthyEnduroSimulator();
  return {
    ...healthySimulator,
    status: {
      ...healthySimulator.status,
      lastAttemptAtMs: momentOfTheCommandMs - 2_000,
      lastOkAtMs: momentOfTheCommandMs - 8_000,
      lastError: 'Falha simulada.',
      consecutiveFailures: 3,
      isStale: true,
      failingSinceMs: momentOfTheCommandMs - 6_000,
    },
  };
}

/** Builds a replay of Friday's recording at 10×, off. */
export function buildFridayReplayTurnedOff(): ReplayDataSource {
  return {
    id: 'reproducao-sexta',
    label: 'Reprodução — Treino de sexta',
    kind: 'replay',
    config: { recordingId: fridayRecordingId, speed: 10, isLooping: false },
    pollIntervalMs: 1_000,
    isEnabled: false,
    isRecording: false,
    status: {
      lastError: null,
      consecutiveFailures: 0,
      isStale: false,
      staleAfterMs: 3_000,
      recordingError: null,
    },
  };
}

/** Builds Friday's recording of the simulator: an hour, 1 800 snapshots, closed. */
export function buildFridayRecording(): Recording {
  return {
    id: fridayRecordingId,
    sourceId: 'simulador-enduro',
    sourceLabel: 'Simulador — Enduro',
    fileName: '2027-08-13T13-00-00.000Z.jsonl',
    startedAtMs: Date.parse('2027-08-13T13:00:00.000Z'),
    endedAtMs: Date.parse('2027-08-13T14:00:00.000Z'),
    snapshotCount: 1_800,
  };
}

/**
 * Builds today's recording of the simulator, open since 14:30 (two minutes before the
 * command), holding 62 snapshots unless a test needs another count.
 */
export function buildRecordingOpenSince1430(snapshotCount = 62): Recording {
  return {
    ...buildFridayRecording(),
    id: 'simulador-enduro/2027-08-14T14-30-00.000Z.jsonl',
    fileName: '2027-08-14T14-30-00.000Z.jsonl',
    startedAtMs: Date.parse('2027-08-14T14:30:00.000Z'),
    endedAtMs: null,
    snapshotCount,
  };
}

/** Builds the session of the enduro under green flag, as the simulator says it at a moment. */
export function buildGreenFlagSessionAt(updatedAtMs: number): SessionShape {
  return {
    sessionId: 'enduro-2027-nacional',
    eventName: 'Baja SAE Brasil 2027 — Etapa Nacional',
    sessionName: 'Enduro de Resistência',
    sessionKind: 'enduro',
    state: 'green',
    clock: {
      clockMode: 'remaining',
      referenceTimeMs: 12_475_000,
      referenceWallClockMs: updatedAtMs,
      running: true,
    },
    scheduledDurationMs: 14_400_000,
    lapsCompletedByLeader: 6,
    updatedAtMs,
  };
}

/** Builds the simulator's last good snapshot: the green-flag session received at a moment. */
export function buildSimulatorSnapshotReceivedAt(receivedAtMs: number): DataSnapshot {
  return {
    sourceId: 'simulador-enduro',
    receivedAtMs,
    shapes: { session: buildGreenFlagSessionAt(receivedAtMs) },
  };
}

/**
 * Builds race day slices (layers, graphics, rundowns as the other reducer tests have them)
 * with the given sources, snapshots and recordings.
 */
export function buildRaceDaySlicesWithDataSources(parts: {
  dataSources: DataSource[];
  dataSnapshots?: DataSnapshot[];
  recordings?: Recording[];
}): SlicesChangedByCommands {
  return {
    ...buildRaceDaySlicesWithRundown({ items: [] }),
    dataSources: parts.dataSources,
    dataSnapshots: parts.dataSnapshots ?? [],
    recordings: parts.recordings ?? [],
    teams: [],
    people: [],
    sponsors: [],
    scheduleSlots: [],
    media: [],
  };
}
