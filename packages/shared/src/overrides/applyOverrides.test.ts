/**
 * Applying the operator's corrections to a source's data (packages/shared)
 *
 * What this module is for:
 *   An override corrects what one source says, everywhere it is bound, until it is
 *   cleared (concept §4). It is keyed by a session field, or by a car and one of its
 *   fields; a car's correction follows the car wherever it is listed, in the positions
 *   and in the standings, because a correction for "the third car" would land on
 *   another team after the next pass. applyOverridesToSnapshotShapes lays a source's
 *   overrides over its shapes before any binding reads them.
 *
 * What these tests prove:
 *   - A session name override replaces the name and nothing else.
 *   - A car's team name override reaches that car in the positions and in the
 *     standings, whatever its place, and no other car.
 *   - An override of another source changes nothing, nor does one naming a car the
 *     snapshot does not list; the shapes given are never changed.
 *   - A status override touches the positions only, and a points override the
 *     standings only, each list having only its own fields.
 *
 * What these tests deliberately do not cover:
 *   - Which values an override may hold; overrideValue.test.ts (with the commands).
 *   - Re-checking the shape rules after a correction: a correction is the operator's
 *     word and is shown as it is.
 */
import { describe, expect, it } from 'vitest';

import {
  buildCarOverride,
  buildSessionNameOverride,
  readSimulatorSnapshotAtLap34,
  simulatorSourceId,
} from '../bindings/sourcesForBindingTests.testSupport.js';
import { applyOverridesToSnapshotShapes } from './applyOverrides.js';

describe('applyOverridesToSnapshotShapes', () => {
  it('replaces the session name with the corrected one, and nothing else', () => {
    // Arrange: the simulator at lap 34 and a corrected session name.
    const shapes = readSimulatorSnapshotAtLap34().shapes;

    // Act: lay the correction over the shapes.
    const correctedShapes = applyOverridesToSnapshotShapes(simulatorSourceId, shapes, [
      buildSessionNameOverride('Enduro de Resistência — Etapa Nacional'),
    ]);

    // Assert: the name changed; the flag, the clock and the lists did not.
    expect(correctedShapes.session, 'only the session name must change').toEqual({
      ...shapes.session,
      sessionName: 'Enduro de Resistência — Etapa Nacional',
    });
    expect(correctedShapes.positions, 'the positions must be untouched').toBe(shapes.positions);
  });

  it('follows car 42 into the positions and the standings, whatever its place', () => {
    // Arrange: car 42 (19th in the positions) whose team name the source misspells.
    const shapes = readSimulatorSnapshotAtLap34().shapes;

    // Act: correct its team name.
    const correctedShapes = applyOverridesToSnapshotShapes(simulatorSourceId, shapes, [
      buildCarOverride(42, 'teamName', 'Jequitibá Racing Team'),
    ]);

    // Assert: car 42 carries the corrected name in both lists, and car 31 does not.
    const car42InPositions = correctedShapes.positions?.entries.find(
      (entry) => entry.carNumber === 42,
    );
    const car42InStandings = correctedShapes.standings?.entries.find(
      (entry) => entry.carNumber === 42,
    );
    const leaderInPositions = correctedShapes.positions?.entries[0];
    expect(car42InPositions?.teamName, 'the positions must show the corrected name').toBe(
      'Jequitibá Racing Team',
    );
    expect(car42InStandings?.teamName, 'the standings must show the corrected name').toBe(
      'Jequitibá Racing Team',
    );
    expect(leaderInPositions?.teamName, 'another car must keep its own name').toBe('Acauã Baja');
  });

  const overridesThatChangeNothing = [
    // Another source's correction stays with that source.
    {
      name: 'an override of another source',
      overrides: [{ ...buildSessionNameOverride('Enduro'), sourceId: 'cronometragem' }],
    },
    // Car 7 is not in this field of 60 (cars are numbered by the source).
    {
      name: 'an override of a car the snapshot does not list',
      overrides: [buildCarOverride(7, 'teamName', 'Baja UFPR')],
    },
  ];

  it.each(overridesThatChangeNothing)('changes nothing for $name', ({ overrides }) => {
    // Arrange: the simulator at lap 34, and a copy to compare with.
    const shapes = readSimulatorSnapshotAtLap34().shapes;
    const copyOfShapes = structuredClone(shapes);

    // Act: lay the overrides of this row over the shapes.
    const correctedShapes = applyOverridesToSnapshotShapes(simulatorSourceId, shapes, overrides);

    // Assert: the same data, and the shapes given were not changed in place.
    expect(correctedShapes, 'nothing must change').toEqual(copyOfShapes);
    expect(shapes, 'the shapes given must never be changed in place').toEqual(copyOfShapes);
  });

  it('corrects a status in the positions only, and points in the standings only', () => {
    // Arrange: car 42 shown running though it stopped, and its points mistyped.
    const shapes = readSimulatorSnapshotAtLap34().shapes;

    // Act: correct both.
    const correctedShapes = applyOverridesToSnapshotShapes(simulatorSourceId, shapes, [
      buildCarOverride(42, 'status', 'stopped'),
      buildCarOverride(42, 'points', 512.5),
    ]);

    // Assert: each list got the field it has, and no field it lacks.
    const car42InPositions = correctedShapes.positions?.entries.find(
      (entry) => entry.carNumber === 42,
    );
    const car42InStandings = correctedShapes.standings?.entries.find(
      (entry) => entry.carNumber === 42,
    );
    expect(car42InPositions?.status, 'the positions must show the corrected status').toBe(
      'stopped',
    );
    expect(car42InPositions, 'the positions have no points').not.toHaveProperty('points');
    expect(car42InStandings?.points, 'the standings must show the corrected points').toBe(512.5);
    expect(car42InStandings, 'the standings have no status').not.toHaveProperty('status');
  });
});
