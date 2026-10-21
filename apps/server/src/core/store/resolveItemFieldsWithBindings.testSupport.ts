// Test support: what the resolver tests hand resolveItemFieldsIntoGraphicData. The race
// clock with its real schema, a small positions tower (the catalogue has no graphic with a
// list field yet), the simulator at lap 34 and fields that read like the editor stores
// them. Every function builds fresh objects on each call.
import type {
  BindingFieldValue,
  DataSnapshot,
  Graphic,
  ItemFields,
  Override,
  SourcesForBindings,
} from '@bajaovrlay/shared';

import { raceClockManifestForTests } from './builtGraphicsFolder.testSupport.js';
import {
  buildSimulatorSourceThatIsOn,
  readSimulatorSnapshotAtLap34,
  simulatorSourceId,
} from './reducers/boundItemSlices.testSupport.js';

/** The moment of the take: 14:32:05 UTC on 9 October 2026. */
export const momentOfTheTake = '2026-10-09T14:32:05.000Z';

/** The race clock as the graphics slice lists it, with its real data schema. */
export function buildRaceClockGraphic(): Graphic {
  return {
    id: 'race-clock',
    manifest: raceClockManifestForTests,
    defaultLayerId: 'clock',
    category: 'clock',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** A positions tower with a title and a list of cars, for the list rows. */
export function buildPositionsTowerGraphic(): Graphic {
  return {
    id: 'positions-tower',
    manifest: {
      id: 'baja-positions-tower',
      name: 'Torre de posições',
      main: 'positions-tower.js',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string', title: 'Título' },
          entries: { type: 'array', title: 'Carros' },
          leaderSchool: { type: 'string', title: 'Escola do líder' },
        },
        required: ['title', 'entries'],
      },
    },
    defaultLayerId: 'fullscreen',
    category: 'standings',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The simulator on, its lap-34 snapshot (or the one given), and these overrides. */
export function buildSourcesAtLap34(
  overrides: Override[],
  snapshot: DataSnapshot = readSimulatorSnapshotAtLap34(),
): SourcesForBindings {
  return {
    dataSources: [buildSimulatorSourceThatIsOn()],
    dataSnapshots: [snapshot],
    overrides,
  };
}

/** A binding to the simulator's positions, live, at the path given. */
export function buildPositionsBinding(
  path: string,
  extra: Pick<BindingFieldValue, 'carNumber' | 'transformId' | 'transformParameters'> = {},
): BindingFieldValue {
  return {
    kind: 'binding',
    sourceId: simulatorSourceId,
    shapeKey: 'positions',
    path,
    isLive: true,
    ...extra,
  };
}

/** The race clock fields every row starts from: everything typed, a running enduro. */
export function buildTypedEnduroClockFields(): ItemFields {
  return {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: { kind: 'literal', value: 'green' },
    clockMode: { kind: 'literal', value: 'elapsed' },
    referenceTimeMs: { kind: 'literal', value: 3_900_000 },
    referenceWallClockMs: { kind: 'literal', value: 1_791_552_000_000 },
    running: { kind: 'literal', value: true },
  };
}

/**
 * The lap-34 snapshot with car 42 moved from 19th to the lead, as a later poll might
 * list it. Only the order matters here, so the other fields are left as they were.
 */
export function readSnapshotWithCar42Leading(): DataSnapshot {
  const snapshot = readSimulatorSnapshotAtLap34();
  const entries = snapshot.shapes.positions?.entries ?? [];
  const car42 = entries.find((entry) => entry.carNumber === 42);
  const otherCars = entries.filter((entry) => entry.carNumber !== 42);
  const reordered = car42 === undefined ? entries : [car42, ...otherCars];
  return {
    ...snapshot,
    shapes: {
      ...snapshot.shapes,
      positions: {
        sessionId: snapshot.shapes.positions?.sessionId ?? '',
        updatedAtMs: snapshot.shapes.positions?.updatedAtMs ?? 0,
        entries: reordered.map((entry, index) => ({ ...entry, position: index + 1 })),
      },
    },
  };
}

/** The data the typed enduro clock fields resolve to. */
export function readTypedEnduroClockData(): Record<string, unknown> {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: 1_791_552_000_000,
    running: true,
  };
}
