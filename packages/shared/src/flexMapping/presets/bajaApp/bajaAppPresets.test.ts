/**
 * The Baja app presets against every real answer of its results API (packages/shared)
 *
 * What this module is for:
 *   BAJAOVRLAY-54 turns the draft mappings of BAJAOVRLAY-53 into three presets an operator
 *   picks on Fontes ("Adicionar fonte do app Baja"): the race (corrida.php) as a session
 *   and positions, a results table (resultado.php) as standings, and a tournament
 *   (torneio.php) as brackets. Each preset is a JSON file of this folder whose event id,
 *   prova or resultado id and API address are parameters; bajaAppPresets.ts fills them in
 *   and checks the config as a saved one is checked. These tests run each preset on every
 *   fixture of examples/bajaApp/ (real answers saved with curl, the doc's examples, one
 *   made-up bracket) and validate every shape it gives, as the store does with a poll.
 *
 * What these tests prove:
 *   - The parameters go where they belong (the query strings, the points column, the
 *     score parts, the scope) and no placeholder is left in any preset.
 *   - The race: the doc's race ten minutes in, with the real 26BR teams, names its cars by
 *     the teams' short names and works out the gaps; with 26SE's teams (no short names) it
 *     falls back to the race's own names; before the start it is a stopped clock at 0:00.
 *   - A simulated race is refused with its sentence unless "Aceitar corrida simulada" is
 *     ticked.
 *   - A word the API adds later to the clock's state or a car's status still maps.
 *   - The results table: the real 26BR overall table gives 51 teams, Poli first with
 *     816.24, the parts the operator picked, and cars 46 and 54 unranked at the end; the
 *     doc's 25SU table during spoilers is refused with the spoilers sentence.
 *   - The brackets: the real 25SU and 26BR Super Primes and the made-up pending one pass.
 *
 * What these tests deliberately do not cover:
 *   - Each mapping addition on its own: the applyFlexMapping*.test.ts files beside these.
 *   - The page that picks a preset and saves it: apps/control's bajaAppSource tests.
 *   - Fetching over HTTP: the server's httpJson adapter tests and the e2e walk.
 */
import { describe, expect, it } from 'vitest';

import type { DataShapeKey } from '../../../dataShapes/dataShapeKey.js';
import { validateDataShape } from '../../../dataShapes/validateDataShape.js';
import type { HttpJsonConfig } from '../../../dataSources/httpJsonConfig.js';
import { applyFlexMapping } from '../../applyFlexMapping.js';
import { bajaAppFixtureFiles, readBajaAppFixture } from '../../bajaAppFixtures.testSupport.js';
import {
  bajaAppApiAddress,
  buildBajaAppBracketSourceConfig,
  buildBajaAppRaceSourceConfig,
  buildBajaAppResultsTableSourceConfig,
  proposedScorePartHeaders,
  simulatedRaceRefusalMessage,
  spoilersRefusalMessage,
} from './bajaAppPresets.js';

/** The moment of the poll in these tests: when the doc's race was ten minutes in. */
const pollMomentMs = 1_760_000_600_000;

/** The race preset on 26BR's Enduro, a simulated race refused as the preset ships. */
function buildRaceConfigOf26BREnduro(acceptsSimulatedRace = false): HttpJsonConfig {
  return buildBajaAppRaceSourceConfig({
    apiAddress: bajaAppApiAddress,
    eventId: '26BR',
    provaId: 'END',
    acceptsSimulatedRace,
  });
}

/** The results table preset on 26BR's overall table, its points in "Total". */
function buildOverallConfigOf26BR(partHeaders: readonly string[] = proposedScorePartHeaders) {
  return buildBajaAppResultsTableSourceConfig({
    apiAddress: bajaAppApiAddress,
    eventId: '26BR',
    resultadoId: '26BR_GER',
    pointsHeader: 'Total',
    partHeaders,
    standingsScope: 'overall',
  });
}

/** The tournament preset on 25SU's Super Prime. */
function buildBracketConfigOf25SU(): HttpJsonConfig {
  return buildBajaAppBracketSourceConfig({
    apiAddress: bajaAppApiAddress,
    eventId: '25SU',
    resultadoId: '25SU_SPR',
  });
}

/**
 * Maps the answers with a preset's mappings and validates every shape the mapping gave:
 * the valid shapes by key, or the problems (a refusal, a mapping problem or a validation
 * one).
 */
function mapAndValidate(config: HttpJsonConfig, responses: Record<string, unknown>) {
  const result = applyFlexMapping(config.mappings, responses, pollMomentMs);
  if (!result.ok) {
    return { problems: result.problems, shapes: undefined };
  }
  const shapes: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const [shapeKey, mappedShape] of Object.entries(result.shapes)) {
    const validation = validateDataShape(shapeKey as DataShapeKey, mappedShape);
    if (validation.isValid) {
      shapes[shapeKey] = validation.shape;
    } else {
      problems.push(validation.errorMessage);
    }
  }
  return { problems, shapes };
}

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

describe('the presets’ parameters', () => {
  it('puts the event and the prova in the race’s query strings, the teams every 10 minutes', () => {
    // Arrange: nothing beyond the race preset on 26BR's Enduro.

    // Act: fill the race preset in.
    const config = buildRaceConfigOf26BREnduro();

    // Assert: the two requests read the API with this event and prova.
    expect(config.requests, 'the race and the teams of 26BR').toEqual([
      {
        requestId: 'corrida',
        url: 'https://api.bajasaebrasil.net/resultados/corrida.php',
        headers: [],
        queryParameters: [
          { name: 'evt', value: '26BR' },
          { name: 'p', value: 'END' },
        ],
      },
      {
        requestId: 'equipes',
        url: 'https://api.bajasaebrasil.net/resultados/equipes.php',
        headers: [],
        queryParameters: [{ name: 'evt', value: '26BR' }],
        refreshEveryMs: 600_000,
      },
    ]);
  });

  it('reads the table’s points from the column named and its parts from the headers picked', () => {
    // Arrange: 26BR's Enduro table, its points in "Pontos", two parts picked.
    const parameters = {
      apiAddress: 'http://127.0.0.1:4791/',
      eventId: '26BR',
      resultadoId: '26BR_END',
      pointsHeader: 'Pontos',
      partHeaders: ['Voltas', 'Penalidades'],
      standingsScope: 'enduro' as const,
    };

    // Act: fill the results table preset in.
    const config = buildBajaAppResultsTableSourceConfig(parameters);

    // Assert: the address without its last slash, the ids, the column, the parts, the scope.
    const standingsMapping = config.mappings[0];
    expect(config.requests[0], 'the table of 26BR_END on the local address').toMatchObject({
      url: 'http://127.0.0.1:4791/resultados/resultado.php',
      queryParameters: [
        { name: 'evt', value: '26BR' },
        { name: 'id', value: '26BR_END' },
      ],
    });
    expect(
      standingsMapping?.entryFields?.find((rule) => rule.targetField === 'points'),
      'the points must come from the column named',
    ).toEqual({ targetField: 'points', fromColumn: { header: 'Pontos', path: 'raw' } });
    expect(standingsMapping?.scorePartsFromColumns, 'the parts picked').toEqual({
      headers: ['Voltas', 'Penalidades'],
      valuePath: 'raw',
    });
    expect(
      standingsMapping?.fields.find((rule) => rule.targetField === 'scope'),
      'the scope given',
    ).toEqual({ targetField: 'scope', constantValue: 'enduro' });
  });

  it('leaves the score parts out when the operator picks none', () => {
    // Arrange: nothing beyond the overall table with no part picked.

    // Act: fill the results table preset in.
    const config = buildOverallConfigOf26BR([]);

    // Assert: no parts at all, rather than an empty list the schema would refuse.
    expect(config.mappings[0]?.scorePartsFromColumns, 'no parts').toBeUndefined();
  });

  it('proposes the overall table’s five parts', () => {
    // Arrange: nothing; the proposal is the preset's own.

    // Act: read the proposal.
    const proposal = proposedScorePartHeaders;

    // Assert: the five parts of 26BR's overall table, in its order.
    expect(proposal, 'the overall table’s parts').toEqual([
      'Penalidade',
      'Segurança',
      'Projeto',
      'Dinâmicas',
      'Enduro',
    ]);
  });

  it('leaves no placeholder in any preset', () => {
    // Arrange: each preset filled in.
    const configs = [
      buildRaceConfigOf26BREnduro(),
      buildOverallConfigOf26BR(),
      buildBracketConfigOf25SU(),
    ];

    // Act: write them out as text.
    const configTexts = configs.map((config) => JSON.stringify(config));

    // Assert: no "{{" anywhere.
    for (const configText of configTexts) {
      expect(configText, 'every placeholder must be filled in').not.toContain('{{');
    }
  });
});

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
    expect(simulatedRaceRefusalMessage, 'the exported sentence is the one shown').toBe(
      problems[0],
    );
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
        expect(positions.entries[1]?.status, 'an unknown status reads as running').toBe(
          'running',
        );
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

describe('the results table preset', () => {
  it('maps the real 26BR overall table: Poli first, the disqualified unranked at the end', () => {
    // Arrange: the real 26BR overall table and teams.
    const responses = {
      resultado: readBajaAppFixture(bajaAppFixtureFiles.overall26BR),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map and validate with the proposed parts.
    const { problems, shapes } = mapAndValidate(buildOverallConfigOf26BR(), responses);

    // Assert: 51 teams, the leader by short name with its total, the five parts, and
    // cars 46 and 54 disqualified with no rank.
    expect(problems, 'the table must map with no problem').toEqual([]);
    const standings = shapes?.standings as {
      scope: string;
      scoreParts: Array<Record<string, unknown>>;
      entries: Array<Record<string, unknown>>;
    };
    expect(standings.scope, 'the overall standings').toBe('overall');
    expect(standings.entries, 'all 51 teams').toHaveLength(51);
    expect(standings.entries[0], 'Poli leads with 816.24').toMatchObject({
      rank: 1,
      carNumber: 5,
      teamName: 'Poli',
      schoolName: 'Poli',
      points: 816.24,
    });
    expect(
      standings.scoreParts.map((part) => part.label),
      'the five parts, in the order picked',
    ).toEqual(['Penalidade', 'Segurança', 'Projeto', 'Dinâmicas', 'Enduro']);
    expect(
      standings.entries.slice(-2).map((team) => [team.carNumber, team.rank, team.isDisqualified]),
      'cars 46 and 54 disqualified with no rank',
    ).toEqual([
      [46, undefined, true],
      [54, undefined, true],
    ]);
  });

  it('refuses the doc 25SU table during spoilers with the spoilers sentence', () => {
    // Arrange: the doc's 25SU table during spoilers, and no teams.
    const responses = {
      resultado: readBajaAppFixture(bajaAppFixtureFiles.overallDuringSpoilers25SU),
      equipes: { event_id: '25SU', teams: [] },
    };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(buildOverallConfigOf26BR(), responses);

    // Assert: no shape, and the sentence alone.
    expect(shapes, 'no shape may come from a hidden table').toBeUndefined();
    expect(problems, 'the spoilers sentence alone').toEqual([
      'Resultado com spoilers ativos: a organização esconde as posições agora.',
    ]);
    expect(spoilersRefusalMessage, 'the exported sentence is the one shown').toBe(problems[0]);
  });
});

describe('the tournament preset', () => {
  const bracketScenarios = [
    // The real 25SU Super Prime: byes, best of 3, the third place listed after the final.
    {
      name: 'maps the real 25SU Super Prime, the third place moved before the final',
      fileName: bajaAppFixtureFiles.superPrime25SU,
      expectedLastRounds: ['Disputa 3° lugar', 'Final'],
    },
    // The real 26BR Super Prime: 64 slots, single races until the semifinals.
    {
      name: 'maps the real 26BR Super Prime',
      fileName: bajaAppFixtureFiles.superPrime26BR,
      expectedLastRounds: ['Disputa 3° lugar', 'Final'],
    },
    // The made-up bracket: the semifinals still running, so the final and third place
    // have pending sides and are left out until they are known.
    {
      name: 'leaves out the made-up bracket’s pending final and third place',
      fileName: bajaAppFixtureFiles.superPrime25SUWithPendingSlots,
      expectedLastRounds: ['Quartas de final', 'Semifinais'],
    },
  ];

  it.each(bracketScenarios)('$name', ({ fileName, expectedLastRounds }) => {
    // Arrange: this row's tournament answer.
    const responses = { torneio: readBajaAppFixture(fileName) };

    // Act: map and validate.
    const { problems, shapes } = mapAndValidate(buildBracketConfigOf25SU(), responses);

    // Assert: valid brackets, ending with this row's rounds.
    expect(problems, 'the tournament must map with no problem').toEqual([]);
    const brackets = shapes?.brackets as { rounds: Array<{ name: string }> };
    expect(
      brackets.rounds.slice(-2).map((round) => round.name),
      'the last two rounds listed',
    ).toEqual(expectedLastRounds);
  });
});
