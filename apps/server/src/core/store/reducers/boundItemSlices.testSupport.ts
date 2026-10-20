// Test support: a race day whose items read fields from a data source. The simulator is
// on and healthy, the race clock is registered with its real schema, and bindings read
// like the item editor stores them. Every function builds fresh objects on each call.
import type {
  BindingFieldValue,
  DataSnapshot,
  DataSource,
  Instance,
  Item,
  ItemFields,
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
 * other sources are given), the given snapshots (none unless given), items, instances
 * and rundowns.
 */
export function buildRaceDaySlicesWithTheSimulator(parts: {
  items: Item[];
  instances?: Instance[];
  rundowns?: Rundown[];
  dataSources?: DataSource[];
  dataSnapshots?: DataSnapshot[];
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
  };
}
