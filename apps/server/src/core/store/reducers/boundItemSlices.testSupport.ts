// Test support: a race day whose items read fields from a data source. The simulator is
// on and healthy, the race clock is registered with its real schema, and bindings read
// like the item editor stores them. Its snapshot is the shared sample of the enduro at
// lap 34 (60 cars, car 31 Acauã Baja leading, car 42 Jequitibá Racing 19th). Every
// function builds fresh objects on each call.
import { readFileSync } from 'node:fs';

import type {
  BindingFieldValue,
  DataSnapshot,
  DataSource,
  Instance,
  InstanceBindings,
  Item,
  ItemFields,
  Override,
  Rundown,
} from '@bajaovrlay/shared';

import type { SlicesChangedByCommands } from './reducerTypes.js';
import {
  buildRaceDaySlicesWithTheRaceClockSchema,
  mainSessionRundownId,
} from './rundownSlices.testSupport.js';

/** The seeded simulator's id, as every bound item of these tests names it. */
export const simulatorSourceId = 'simulador-enduro';

/** The moment the simulator last answered well: 14:32:03 UTC on 9 October 2026. */
export const simulatorLastGoodPollMs = Date.parse('2026-10-09T14:32:03.000Z');

/** Builds "Simulador — Enduro", on and healthy: its last poll, two seconds ago, was good. */
export function buildSimulatorSourceThatIsOn(): DataSource {
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
      simulatedStartAtMs: Date.parse('2026-10-09T13:00:00.000Z'),
    },
    pollIntervalMs: 2_000,
    isEnabled: true,
    isRecording: false,
    status: {
      lastAttemptAtMs: simulatorLastGoodPollMs,
      lastOkAtMs: simulatorLastGoodPollMs,
      lastError: null,
      consecutiveFailures: 0,
      isStale: false,
      staleAfterMs: 6_000,
      recordingError: null,
    },
  };
}

/** A live binding to the simulator's session at the path given ("state", "clock"). */
export function buildLiveBindingToTheSimulatorSession(path: string): BindingFieldValue {
  return { kind: 'binding', sourceId: simulatorSourceId, shapeKey: 'session', path, isLive: true };
}

/**
 * The fields of "Relógio do enduro — fonte": the title typed, the flag following the
 * simulator, and the whole clock read from it ("Relógio da fonte"), stored on the time
 * field alone, as the item editor stores it.
 */
export function buildEnduroClockFieldsBoundToTheSimulator(): ItemFields {
  return {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: buildLiveBindingToTheSimulatorSession('state'),
    referenceTimeMs: buildLiveBindingToTheSimulatorSession('clock'),
  };
}

/** The item "Relógio do enduro — fonte" in the main rundown, at the position given. */
export function buildEnduroClockItemBoundToTheSimulator(order: number): Item {
  return {
    id: 'c3d9f1a7-2b4e-4f60-8a1c-5e7d9b3f0a26',
    home: { kind: 'rundown', rundownId: mainSessionRundownId },
    order,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: buildEnduroClockFieldsBoundToTheSimulator(),
    label: 'Relógio do enduro — fonte',
    color: 'success',
    notes: 'Segue a bandeira e o relógio do simulador.',
  };
}

/**
 * Builds race day slices with the race clock's real schema, the simulator on (unless
 * other sources are given), the given snapshots (none unless given), items, instances,
 * their bindings and rundowns.
 */
export function buildRaceDaySlicesWithTheSimulator(parts: {
  items: Item[];
  instances?: Instance[];
  rundowns?: Rundown[];
  dataSources?: DataSource[];
  dataSnapshots?: DataSnapshot[];
  instanceBindings?: InstanceBindings;
}): SlicesChangedByCommands {
  const raceDaySlices = buildRaceDaySlicesWithTheRaceClockSchema({
    items: parts.items,
    instances: parts.instances,
    rundowns: parts.rundowns,
  });
  return {
    ...raceDaySlices,
    dataSources: parts.dataSources ?? [buildSimulatorSourceThatIsOn()],
    dataSnapshots: parts.dataSnapshots ?? [],
    instanceBindings: parts.instanceBindings ?? [],
  };
}

/** Reads one sample of packages/shared/src/dataShapes/samples afresh. */
function readSharedSample(fileName: string): unknown {
  const sampleUrl = new URL(
    `../../../../../../packages/shared/src/dataShapes/samples/${fileName}`,
    import.meta.url,
  );
  return JSON.parse(readFileSync(sampleUrl, 'utf8'));
}

/**
 * The simulator's last good poll at lap 34: the session (green unless the flag given
 * says otherwise), the 60-car positions and the overall standings.
 */
export function readSimulatorSnapshotAtLap34(
  sessionSampleFileName = 'session.enduro-green.json',
): DataSnapshot {
  return {
    sourceId: simulatorSourceId,
    receivedAtMs: simulatorLastGoodPollMs,
    shapes: {
      session: readSharedSample(sessionSampleFileName),
      positions: readSharedSample('positions.enduro-lap-34.json'),
      standings: readSharedSample('standings.overall.json'),
    } as DataSnapshot['shapes'],
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
    setAt: '2026-10-09T14:30:00.000Z',
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
    setAt: '2026-10-09T14:30:00.000Z',
  };
}
