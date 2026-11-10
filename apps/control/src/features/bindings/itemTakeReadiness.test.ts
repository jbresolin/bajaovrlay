/**
 * Whether a bound item can be taken now (apps/control)
 *
 * What this module is for:
 *   A take of a bound item is refused by the server when a field cannot be read (no such
 *   source, no data yet, a shape it does not send, a required value absent). Rundown rows
 *   and shortcut buttons say so before the press (brief G): findWhyItemCannotBeTakenNow
 *   runs the shared resolution against the slices the page holds and answers the first
 *   reason, named as the server names it, or undefined.
 *
 * What these tests prove:
 *   - A typed item, and a bound item whose source has data, can be taken.
 *   - A bound item whose source has no data yet cannot, and the reason names the field and
 *     the source; nor can one whose source was deleted.
 *   - A title that reads a car the source does not list cannot, naming the car.
 *   - An optional field whose value is absent does not stop the take.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the hint; ItemSourceMarker.test.tsx.
 */
import type { Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEnduroSnapshotAtLap34,
  buildSimulatorThatIsOk,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';
import { buildRaceClockGraphic } from '@/state/slicesLikeTheServerSends.testSupport';

import { findWhyItemCannotBeTakenNow } from './itemTakeReadiness';

/** The race clock item with the fields given (the rest typed). */
function buildClockItemWithFields(fields: Item['fields']): Item {
  return {
    id: 'c3d9f1a7-2b4e-4f60-8a1c-5e7d9b3f0a26',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    order: 0,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'green' },
      ...fields,
    },
    label: 'Relógio do enduro — fonte',
    color: 'success',
    notes: '',
  };
}

/** A live binding to the simulator's session at the path given. */
function buildSessionBinding(path: string) {
  return {
    kind: 'binding' as const,
    sourceId: seededSimulatorId,
    shapeKey: 'session' as const,
    path,
    isLive: true,
  };
}

const readinessScenarios = [
  // Nothing is read: always ready.
  {
    name: 'a typed item can be taken',
    item: buildClockItemWithFields({}),
    sources: { dataSources: [], dataSnapshots: [], overrides: [], bracketMatchFocuses: [] },
    expected: undefined,
  },
  // The simulator at lap 34 sends the flag.
  {
    name: 'a bound flag with data can be taken',
    item: buildClockItemWithFields({ state: buildSessionBinding('state') }),
    sources: {
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
      overrides: [],
      bracketMatchFocuses: [],
    },
    expected: undefined,
  },
  // Turned on a moment ago: no good poll yet.
  {
    name: 'a bound flag whose source has no data cannot, naming the field and source',
    item: buildClockItemWithFields({ state: buildSessionBinding('state') }),
    sources: {
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [],
      overrides: [],
      bracketMatchFocuses: [],
    },
    expected: 'Bandeira: a fonte Simulador — Enduro ainda não tem dados.',
  },
  // The simulator was deleted after the item was saved.
  {
    name: 'a bound flag whose source was deleted cannot',
    item: buildClockItemWithFields({ state: buildSessionBinding('state') }),
    sources: { dataSources: [], dataSnapshots: [], overrides: [], bracketMatchFocuses: [] },
    expected: 'Bandeira: a fonte de dados "simulador-enduro" não existe.',
  },
  // Car 999 is in no race: the required title has nothing to read.
  {
    name: 'a title read from a car the source does not list cannot, naming the car',
    item: buildClockItemWithFields({
      sessionName: {
        kind: 'binding',
        sourceId: seededSimulatorId,
        shapeKey: 'positions',
        path: 'entryOfCar.teamName',
        carNumber: 999,
        isLive: true,
      },
    }),
    sources: {
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
      overrides: [],
      bracketMatchFocuses: [],
    },
    expected: 'Título: a fonte Simulador — Enduro não tem o carro 999 em Posições.',
  },
  // The leader's laps are optional on the race clock: absent, they are left out.
  {
    name: 'an optional field whose value is absent does not stop the take',
    item: buildClockItemWithFields({
      lapsCompletedByLeader: {
        kind: 'binding',
        sourceId: seededSimulatorId,
        shapeKey: 'positions',
        path: 'entries.0.gapToLeaderLaps',
        isLive: true,
      },
    }),
    sources: {
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
      overrides: [],
      bracketMatchFocuses: [],
    },
    expected: undefined,
  },
];

describe('findWhyItemCannotBeTakenNow', () => {
  it.each(readinessScenarios)('$name', ({ item, sources, expected }) => {
    // Arrange: the item and sources of this row, and the race clock (no teams: none of
    // these items reads the library).
    const graphic = buildRaceClockGraphic();

    // Act: ask whether it can be taken now.
    const reason = findWhyItemCannotBeTakenNow(item, graphic, sources, { teams: [] });

    // Assert: no reason, or the server's reason.
    expect(reason, 'the reason must be this one').toBe(expected);
  });
});
