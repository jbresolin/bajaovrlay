// Test support: the sources, snapshots and overrides the binding tests resolve against.
// The snapshot is the realistic sample of packages/shared/src/dataShapes/samples: the
// enduro at lap 34, 60 cars, car 31 (Acauã Baja, Mauá) leading and car 42 (Jequitibá
// Racing, CEFET-MG) 19th. Every function builds fresh objects on each call.
import { readFileSync } from 'node:fs';

import type { DataSnapshot } from '../dataSources/dataSnapshot.js';
import type { DataSource } from '../dataSources/dataSource.js';
import type { Override } from '../overrides/override.js';
import type { SourcesForBindings } from './bindingResolution.js';

/** The seeded simulator's id, as every binding of these tests names it. */
export const simulatorSourceId = 'simulador-enduro';

/** Reads one sample of dataShapes/samples afresh. */
function readSample(fileName: string): unknown {
  const sampleUrl = new URL(`../dataShapes/samples/${fileName}`, import.meta.url);
  return JSON.parse(readFileSync(sampleUrl, 'utf8'));
}

/** The simulator's last good poll: green flag, lap 34, positions and overall standings. */
export function readSimulatorSnapshotAtLap34(): DataSnapshot {
  return {
    sourceId: simulatorSourceId,
    receivedAtMs: 1_805_568_240_948,
    shapes: {
      session: readSample('session.enduro-green.json'),
      positions: readSample('positions.enduro-lap-34.json'),
      standings: readSample('standings.overall.json'),
    } as DataSnapshot['shapes'],
  };
}

/** "Simulador — Enduro", on; `isStale` says whether its last poll failed. */
export function buildSimulatorSource(isStale: boolean): DataSource {
  return {
    id: simulatorSourceId,
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
    isEnabled: true,
    isRecording: false,
    status: {
      lastError: isStale ? 'Tempo esgotado' : null,
      consecutiveFailures: isStale ? 3 : 0,
      isStale,
      staleAfterMs: 6_000,
      recordingError: null,
    },
  };
}

/** The simulator, healthy, with its lap-34 snapshot and the overrides given. */
export function buildSourcesWithTheSimulatorAtLap34(overrides: Override[]): SourcesForBindings {
  return {
    dataSources: [buildSimulatorSource(false)],
    dataSnapshots: [readSimulatorSnapshotAtLap34()],
    overrides,
  };
}

/** The operator's correction of the session name the simulator sends. */
export function buildSessionNameOverride(correctedName: string): Override {
  return {
    sourceId: simulatorSourceId,
    scope: 'session',
    field: 'sessionName',
    value: correctedName,
    reason: 'O nome oficial da prova é outro.',
    setBy: 'operador:3f2a9c1e',
    setAt: '2027-08-14T14:35:00.000Z',
  };
}

/** The operator's correction of one field of one car, wherever the car is listed. */
export function buildCarOverride(
  carNumber: number,
  field: 'teamName' | 'schoolName' | 'status' | 'points',
  value: unknown,
): Override {
  return {
    sourceId: simulatorSourceId,
    scope: 'car',
    carNumber,
    field,
    value,
    reason: 'A equipe pediu a correção na secretaria de prova.',
    setBy: 'operador:3f2a9c1e',
    setAt: '2027-08-14T14:35:00.000Z',
  };
}
