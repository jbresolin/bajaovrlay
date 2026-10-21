// Test support: a race clock on air whose title and flag follow the simulator, as the
// server sends it after a take of a bound item (BAJAOVRLAY-20): the instance with the data
// the lap-34 snapshot gave it, its entry of `instanceBindings`, the simulator and its data.
// Every function builds fresh objects on each call.
import type {
  DataSource,
  Instance,
  InstanceBindingsEntry,
  Override,
  Slices,
} from '@bajaovrlay/shared';

import {
  buildEnduroSnapshotAtLap34,
  buildSimulatorThatIsOk,
  seededSimulatorId,
} from './dataSourcesLikeTheServerSends.testSupport';
import {
  buildRaceClockGraphic,
  buildSlicesWithNothingOnAir,
} from './slicesLikeTheServerSends.testSupport';

/** The id of the bound race clock on the program output. */
export const idOfTheBoundRaceClockOnAir = '5a9e2c71-0b3d-4f86-9c14-7e2b6d8a1f03';

/** The id of the item it was taken from, "Relógio do enduro — fonte". */
export const idOfTheBoundRaceClockItem = 'c3d9f1a7-2b4e-4f60-8a1c-5e7d9b3f0a26';

/** The race clock on air as the lap-34 snapshot filled it: green, counting down. */
export function buildBoundRaceClockOnAir(): Instance {
  return {
    id: idOfTheBoundRaceClockOnAir,
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'remaining',
      referenceTimeMs: 4_559_052,
      referenceWallClockMs: 1_805_568_240_948,
      running: true,
    },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2027-03-20T19:24:00.000Z',
    itemId: idOfTheBoundRaceClockItem,
  };
}

/** Its bindings: the title and the flag read live from the simulator's session. */
export function buildBindingsOfTheBoundRaceClock(): InstanceBindingsEntry {
  return {
    instanceId: idOfTheBoundRaceClockOnAir,
    boundFields: [
      {
        fieldKey: 'sessionName',
        binding: {
          kind: 'binding',
          sourceId: seededSimulatorId,
          shapeKey: 'session',
          path: 'sessionName',
          isLive: true,
        },
      },
      {
        fieldKey: 'state',
        binding: {
          kind: 'binding',
          sourceId: seededSimulatorId,
          shapeKey: 'session',
          path: 'state',
          isLive: true,
        },
      },
    ],
  };
}

/** The operator's correction of the session name the simulator sends. */
export function buildSessionNameCorrection(): Override {
  return {
    sourceId: seededSimulatorId,
    scope: 'session',
    field: 'sessionName',
    value: 'Enduro — Etapa Nacional',
    reason: 'Nome oficial da prova.',
    setBy: 'operador:3f2a9c1e',
    setAt: '2027-03-20T19:25:00.000Z',
  };
}

/**
 * What a hello holds with the bound race clock on air: the simulator (healthy unless
 * other sources are given) and its lap-34 data, and the corrections given (none unless
 * given).
 */
export function buildSlicesWithTheBoundRaceClockOnAir(parts: {
  dataSources?: DataSource[];
  overrides?: Override[];
}): Slices {
  return {
    ...buildSlicesWithNothingOnAir(),
    graphics: [buildRaceClockGraphic()],
    instances: [buildBoundRaceClockOnAir()],
    instanceBindings: [buildBindingsOfTheBoundRaceClock()],
    dataSources: parts.dataSources ?? [buildSimulatorThatIsOk()],
    dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
    overrides: parts.overrides ?? [],
  };
}
