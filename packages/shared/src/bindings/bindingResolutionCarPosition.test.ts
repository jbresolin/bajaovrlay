/**
 * Reading where a car chosen by its number runs (packages/shared)
 *
 * What this module is for:
 *   The battle card's two positions read `positions.entryOfCar.position` for a car chosen
 *   by its number (BAJAOVRLAY-47), so the card follows that car wherever it runs. The
 *   resolution finds the car's entry by its number, not by its place in the list.
 *
 * What these tests prove:
 *   - Car 2 running 2nd reads 2.
 *   - After car 2 passes the leader, the same binding reads 1.
 *
 * What these tests deliberately do not cover:
 *   - The other fields of a car chosen by number, and a car not listed:
 *     bindingResolution.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { DataSnapshot } from '../dataSources/dataSnapshot.js';
import type { BindingFieldValue } from './bindingFieldValue.js';
import { resolveBindingAgainstSources } from './bindingResolution.js';
import { buildSimulatorSource, simulatorSourceId } from './sourcesForBindingTests.testSupport.js';

// The teams handed to the transforms; this binding has none.
const contextWithNoTeams = { teams: [] };

/** The battle card's "Posição do carro de trás": where car 2 runs, live. */
const positionOfCar2: BindingFieldValue = {
  kind: 'binding',
  sourceId: simulatorSourceId,
  shapeKey: 'positions',
  path: 'entryOfCar.position',
  carNumber: 2,
  isLive: true,
};

/** The simulator's last poll with the two leading cars in the order given, car numbers first. */
function buildSnapshotWithTheLeadersInOrder(carNumbersInOrder: number[]): DataSnapshot {
  const teams: Record<number, { teamName: string; schoolName: string }> = {
    1: { teamName: 'Cascavel Off-Road', schoolName: 'UNIOESTE' },
    2: { teamName: 'Biguá Off-Road', schoolName: 'FURG' },
  };
  return {
    sourceId: simulatorSourceId,
    receivedAtMs: 1_805_568_240_948,
    shapes: {
      positions: {
        sessionId: 'enduro-2027-nacional',
        updatedAtMs: 1_805_568_240_948,
        entries: carNumbersInOrder.map((carNumber, index) => ({
          position: index + 1,
          carNumber,
          ...teams[carNumber],
          laps: 34,
          status: 'running',
        })),
      },
    } as DataSnapshot['shapes'],
  };
}

describe('the position of a car chosen by its number', () => {
  it('reads 2 for car 2 running 2nd, then 1 once it has passed the leader', () => {
    // Arrange: car 1 leads car 2; then, a lap later, car 2 leads car 1.
    const sourcesBeforeThePass = {
      dataSources: [buildSimulatorSource(false)],
      dataSnapshots: [buildSnapshotWithTheLeadersInOrder([1, 2])],
      overrides: [],
    };
    const sourcesAfterThePass = {
      ...sourcesBeforeThePass,
      dataSnapshots: [buildSnapshotWithTheLeadersInOrder([2, 1])],
    };

    // Act: read car 2's position against each.
    const beforeThePass = resolveBindingAgainstSources(
      positionOfCar2,
      sourcesBeforeThePass,
      contextWithNoTeams,
    );
    const afterThePass = resolveBindingAgainstSources(
      positionOfCar2,
      sourcesAfterThePass,
      contextWithNoTeams,
    );

    // Assert: the binding follows car 2, not a place.
    expect(beforeThePass, 'car 2 runs 2nd before the pass').toEqual({
      status: 'resolved',
      value: 2,
      isOverridden: false,
    });
    expect(afterThePass, 'car 2 leads after the pass').toEqual({
      status: 'resolved',
      value: 1,
      isOverridden: false,
    });
  });
});
