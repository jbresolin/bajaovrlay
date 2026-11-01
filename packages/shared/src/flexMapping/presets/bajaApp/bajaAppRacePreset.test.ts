/**
 * The Baja app race preset against the race answers (packages/shared)
 *
 * What this module is for:
 *   The race preset (corrida.preset.json, BAJAOVRLAY-54) reads the Baja app's corrida.php
 *   into a session and positions, the names joined from the event's teams (equipes.php).
 *   These tests run it on the doc's race answers with the real 26BR and 26SE teams, and
 *   validate every shape it gives, as the store does with a poll.
 *
 * What these tests prove:
 *   - The doc's race ten minutes in, with the real 26BR teams, names its cars by the teams'
 *     short names and works out the gaps; with 26SE's teams (no short names) it falls back
 *     to the race's own names; before the start it is a stopped clock at 0:00.
 *   - A simulated race is refused with its sentence unless "Aceitar corrida simulada" is
 *     ticked.
 *   - A word the API adds later to the clock's state or a car's status still maps.
 *
 * What these tests deliberately do not cover:
 *   - The other presets and the parameters: bajaAppPresets.test.ts.
 *   - Gaps from laps rule by rule: gapsFromLaps.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { bajaAppFixtureFiles, readBajaAppFixture } from '../../bajaAppFixtures.testSupport.js';
import { buildRaceConfigOf26BREnduro, mapAndValidate } from './bajaAppPresetMapping.testSupport.js';
import { simulatedRaceRefusalMessage } from './bajaAppPresets.js';

/** A car of the positions as a short row: place, number, team, school, laps, laps down. */
function describeCarsOf(shapes: Record<string, unknown> | undefined) {
  const positions = shapes?.positions as { entries: Array<Record<string, unknown>> } | undefined;
  return (positions?.entries ?? []).map((car) => [
    car.position,
    car.carNumber,
    car.teamName,
    car.schoolName,
    car.laps,
    car.gapToLeaderLaps,
  ]);
}

/** The doc's race ten minutes in, with one change made to a copy of it. */
function buildDocRaceWith(change: (race: Record<string, unknown>) => void) {
  const race = readBajaAppFixture(bajaAppFixtureFiles.raceTenMinutesIn00NE);
  change(race);
  return race;
}

describe('the race preset', () => {
  it('names the doc race’s cars by the 26BR teams’ short names, with gaps in laps', () => {
    // Arrange: the doc's race ten minutes in and the real 26BR teams (11, 22 and 33 in it).
    const responses = {
      corrida: readBajaAppFixture(bajaAppFixtureFiles.raceTenMinutesIn00NE),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(buildRaceConfigOf26BREnduro(), responses);

    // Assert: a running session at 10:00, and the three cars by their short names.
    expect(problems, 'the race must map with no problem').toEqual([]);
    expect(shapes?.session, 'the session must be running at 10:00').toMatchObject({
      sessionName: 'Enduro de teste',
      state: 'green',
      clock: { clockMode: 'elapsed', referenceTimeMs: 600_000, running: true },
    });
    expect(describeCarsOf(shapes), 'the cars, short names, car 22 one lap down').toEqual([
      [1, 11, 'Parahybaja', 'UFCG', 3, undefined],
      [2, 22, 'Corisco', 'UPE', 2, 1],
      [3, 33, 'PAC', 'UNESP-Bauru', 0, 3],
    ]);
  });

  it('falls back to the race’s own names when the teams have no short names (26SE)', () => {
    // Arrange: the doc's race and the real 26SE teams, whose short names are all empty.
    const responses = {
      corrida: readBajaAppFixture(bajaAppFixtureFiles.raceTenMinutesIn00NE),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26SE),
    };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(buildRaceConfigOf26BREnduro(), responses);

    // Assert: the names the race itself gives.
    expect(problems, 'the race must map with no problem').toEqual([]);
    expect(describeCarsOf(shapes), 'the race’s own names').toEqual([
      [1, 11, 'Equipe 11', 'Escola 11', 3, undefined],
      [2, 22, 'Equipe 22', 'Escola 22', 2, 1],
      [3, 33, 'Equipe 33', 'Escola 33', 0, 3],
    ]);
  });

  it('gives a stopped clock at 0:00 and no car before the start', () => {
    // Arrange: the doc's 26BR Enduro, never started (elapsed_ms null), and its teams.
    const responses = {
      corrida: readBajaAppFixture(bajaAppFixtureFiles.raceBeforeTheStart26BR),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(buildRaceConfigOf26BREnduro(), responses);

    // Assert: a valid session waiting at 0, stopped, and an empty positions list.
    expect(problems, 'the race before its start must map with no problem').toEqual([]);
    expect(shapes?.session, 'the clock must be stopped at 0').toMatchObject({
      state: 'pre',
      clock: { referenceTimeMs: 0, running: false },
    });
    expect(shapes?.positions, 'there must be no car yet').toMatchObject({ entries: [] });
  });

  it('refuses a simulated race with its sentence while the box is not ticked', () => {
    // Arrange: the doc's race, marked as a simulation, and the 26BR teams.
    const responses = {
      corrida: buildDocRaceWith((race) => {
        race.simulation = true;
      }),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map and validate with the preset as it ships.
    const { problems, shapes } = mapAndValidate(buildRaceConfigOf26BREnduro(false), responses);

    // Assert: no shape, and the simulation sentence alone.
    expect(shapes, 'no shape may come from a simulated race').toBeUndefined();
    expect(problems, 'the sentence must say how to accept it').toEqual([
      "Corrida em modo simulação: marque 'Aceitar corrida simulada' para usar.",
    ]);
    expect(simulatedRaceRefusalMessage, 'the exported sentence is the one shown').toBe(problems[0]);
  });

  it('maps a simulated race once "Aceitar corrida simulada" is ticked', () => {
    // Arrange: the same simulated race and teams.
    const responses = {
      corrida: buildDocRaceWith((race) => {
        race.simulation = true;
      }),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map and validate with the box ticked.
    const { problems, shapes } = mapAndValidate(buildRaceConfigOf26BREnduro(true), responses);

    // Assert: the race maps as a real one would.
    expect(problems, 'an accepted simulation must map with no problem').toEqual([]);
    expect(describeCarsOf(shapes), 'its three cars').toHaveLength(3);
  });

  const newWordScenarios = [
    // The contract says the clock's word list may grow: a new word must not break the poll.
    {
      name: 'maps a clock state the API adds later to a yellow flag, the clock held',
      change: (race: Record<string, unknown>) => {
        (race.clock as Record<string, unknown>).state = 'suspended';
      },
      check: (shapes: Record<string, unknown> | undefined) => {
        expect(shapes?.session, 'an unknown state reads as caution').toMatchObject({
          state: 'yellow',
          clock: { running: false },
        });
      },
    },
    // The same for a car's status: a car still listed is taken as still in the race.
    {
      name: 'maps a car status the API adds later to running',
      change: (race: Record<string, unknown>) => {
        const cars = race.cars as Array<Record<string, unknown>>;
        (cars[1] as Record<string, unknown>).status = 'penalized';
      },
      check: (shapes: Record<string, unknown> | undefined) => {
        const positions = shapes?.positions as { entries: Array<Record<string, unknown>> };
        expect(positions.entries[1]?.status, 'an unknown status reads as running').toBe('running');
      },
    },
  ];

  it.each(newWordScenarios)('$name', ({ change, check }) => {
    // Arrange: the doc's race with this row's new word, and the 26BR teams.
    const responses = {
      corrida: buildDocRaceWith(change),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(buildRaceConfigOf26BREnduro(), responses);

    // Assert: no problem, and the word mapped as this row says.
    expect(problems, 'a new word must not fail the poll').toEqual([]);
    check(shapes);
  });
});
