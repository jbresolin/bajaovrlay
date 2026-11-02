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
 *   - The results table: the real 26BR overall table gives 51 teams, Poli first with
 *     816.24, the parts the operator picked, and cars 46 and 54 unranked at the end; the
 *     doc's 25SU table during spoilers is refused with the spoilers sentence.
 *
 * What these tests deliberately do not cover:
 *   - The race preset on the race answers: bajaAppRacePreset.test.ts.
 *   - The tournament preset on the tournament answers: bajaAppTournamentPreset.test.ts.
 *   - Each mapping addition on its own: the applyFlexMapping*.test.ts files.
 *   - The page that picks a preset and saves it: apps/control's bajaAppSource tests.
 *   - Fetching over HTTP: the server's httpJson adapter tests and the e2e walk.
 */
import { describe, expect, it } from 'vitest';

import { bajaAppFixtureFiles, readBajaAppFixture } from '../../bajaAppFixtures.testSupport.js';
import {
  buildBracketConfigOf25SU,
  buildOverallConfigOf26BR,
  buildRaceConfigOf26BREnduro,
  mapAndValidate,
} from './bajaAppPresetMapping.testSupport.js';
import {
  buildBajaAppEndpointAddress,
  buildBajaAppResultsTableSourceConfig,
  proposedScorePartHeaders,
  spoilersRefusalMessage,
} from './bajaAppPresets.js';

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

  it('writes an endpoint’s address as the presets do, a typed last "/" dropped', () => {
    // Arrange: a local copy of the API typed with a last "/" and a space.
    const typedAddress = 'http://127.0.0.1:4791/ ';

    // Act: write the address of evento.php on it.
    const eventAddress = buildBajaAppEndpointAddress(typedAddress, 'evento.php');

    // Assert: one "/" between the address and the path.
    expect(eventAddress, 'the event endpoint of the local copy').toBe(
      'http://127.0.0.1:4791/resultados/evento.php',
    );
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
