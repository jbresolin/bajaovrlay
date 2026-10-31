/**
 * Joining a list from another request (lookups) (packages/shared)
 *
 * What this module is for:
 *   The Baja app's results API names a team by its number everywhere and keeps the names
 *   in `equipes` (BAJAOVRLAY-53, which reverses BAJAOVRLAY-40's "no joins"). A shape's
 *   mapping may declare named lookups: a request, the list in its answer, the key in each
 *   element, and the path of the entry's own key. A rule reads `fromLookup: { lookup, path }`
 *   on the element the entry's key matched. One level, strict equality.
 *
 * What these tests prove:
 *   - The real 26BR overall table, joined on team number with the real 26BR teams, gives
 *     each team its short name and short school ("Poli", "Poli"; "Imperador", "UTFPR").
 *   - A key with no match leaves the lookup's fields absent, so an alternative takes over:
 *     the doc's race (cars 11, 22, 33) joined with 26BR's teams keeps the cars' own names.
 *   - Strict equality: a key sent as the text "5" does not match the number 5.
 *   - Two elements with the same key are a problem naming the key; a lookup whose request
 *     gave no answer, or whose answer has no list at its path, is a problem too.
 *
 * What these tests deliberately do not cover:
 *   - Which lookups the config accepts: flexMappingConfigAdditions.test.ts.
 *   - Fetching the teams less often than the race: the server's httpJson adapter tests.
 */
import { describe, expect, it } from 'vitest';

import { applyFlexMapping } from './applyFlexMapping.js';
import { bajaAppFixtureFiles, readBajaAppFixture } from './bajaAppFixtures.testSupport.js';
import { FlexMappingConfigSchema } from './flexMappingConfig.js';

/** The moment of the poll in these tests: the last day of the 26BR competition. */
const pollMomentMs = Date.UTC(2026, 2, 29, 18, 0, 0);

/** The teams lookup: equipes' teams by number, joined on the entry's `entryKeyPath`. */
function buildTeamsLookup(entryKeyPath: string) {
  return {
    lookupName: 'equipes',
    requestId: 'equipes',
    listPath: 'teams',
    keyPath: 'number',
    entryKeyPath,
  };
}

/** The 26BR overall table's teams, named from the teams lookup, else from the row. */
function buildJoinedStandingsMapping() {
  return FlexMappingConfigSchema.parse([
    {
      shapeKey: 'standings',
      requestId: 'resultado',
      entriesPath: 'rows',
      lookups: [buildTeamsLookup('team.number')],
      fields: [],
      entryFields: [
        { targetField: 'carNumber', fromPath: 'team.number' },
        {
          targetField: 'teamName',
          firstOf: [
            { fromLookup: { lookup: 'equipes', path: 'short_name' } },
            { fromPath: 'team.name' },
          ],
        },
        {
          targetField: 'schoolName',
          firstOf: [
            { fromLookup: { lookup: 'equipes', path: 'school_short' } },
            { fromPath: 'team.school' },
          ],
        },
      ],
    },
  ]);
}

/** The first `count` entries a successful mapping built for the standings. */
function readFirstStandingsEntries(result: ReturnType<typeof applyFlexMapping>, count: number) {
  if (!result.ok) {
    return result.problems;
  }
  const standings = result.shapes.standings as { entries: unknown[] };
  return standings.entries.slice(0, count);
}

describe('applyFlexMapping, lookups', () => {
  it('names the real 26BR overall table from the real 26BR teams by car number', () => {
    // Arrange: the joined mapping, the 26BR table and the 26BR teams, as the API answers.
    const mappings = buildJoinedStandingsMapping();
    const responses = {
      resultado: readBajaAppFixture(bajaAppFixtureFiles.overall26BR),
      equipes: readBajaAppFixture(bajaAppFixtureFiles.teams26BR),
    };

    // Act: map them.
    const result = applyFlexMapping(mappings, responses, pollMomentMs);

    // Assert: the first three teams carry the short names the teams list gives.
    expect(readFirstStandingsEntries(result, 3), 'the names must come from the teams list').toEqual(
      [
        { carNumber: 5, teamName: 'Poli', schoolName: 'Poli' },
        { carNumber: 6, teamName: 'Imperador', schoolName: 'UTFPR' },
        { carNumber: 2, teamName: 'FEI', schoolName: 'FEI' },
      ],
    );
  });

  it('keeps the cars own names when the teams list has no element with their number', () => {
    // Arrange: the doc's test race (cars 11, 22 and 33 of event 00NE) joined with a teams
    // list where none of those numbers appears.
    const mappings = FlexMappingConfigSchema.parse([
      {
        shapeKey: 'positions',
        requestId: 'corrida',
        entriesPath: 'cars',
        lookups: [buildTeamsLookup('number')],
        fields: [],
        entryFields: [
          { targetField: 'carNumber', fromPath: 'number' },
          {
            targetField: 'teamName',
            firstOf: [
              { fromLookup: { lookup: 'equipes', path: 'short_name' } },
              { fromPath: 'team' },
            ],
          },
        ],
      },
    ]);
    const responses = {
      corrida: readBajaAppFixture(bajaAppFixtureFiles.raceTenMinutesIn00NE),
      equipes: { teams: [{ number: 4, short_name: 'Pato' }] },
    };

    // Act: map them.
    const result = applyFlexMapping(mappings, responses, pollMomentMs);

    // Assert: no match, so the alternative, the car's own name, fills each team name.
    expect(result, 'a key with no match must leave the lookup fields absent').toEqual({
      ok: true,
      shapes: {
        positions: {
          entries: [
            { carNumber: 11, teamName: 'Equipe 11' },
            { carNumber: 22, teamName: 'Equipe 22' },
            { carNumber: 33, teamName: 'Equipe 33' },
          ],
        },
      },
    });
  });

  it('matches by strict equality, so the text "5" does not find team 5', () => {
    // Arrange: a row whose team number came as text, and team 5 in the list as a number.
    const mappings = buildJoinedStandingsMapping();
    const responses = {
      resultado: { rows: [{ team: { number: '5', name: 'Poli Baja', school: 'Poli USP' } }] },
      equipes: { teams: [{ number: 5, short_name: 'Poli', school_short: 'Poli' }] },
    };

    // Act: map them.
    const result = applyFlexMapping(mappings, responses, pollMomentMs);

    // Assert: no match, so the row's own names are taken.
    expect(readFirstStandingsEntries(result, 1), '"5" must not match 5').toEqual([
      { carNumber: '5', teamName: 'Poli Baja', schoolName: 'Poli USP' },
    ]);
  });

  const problemScenarios: Array<{
    name: string;
    responses: Record<string, unknown>;
    expectedProblems: string[];
  }> = [
    // Two teams with one number: which name is right cannot be known.
    {
      name: 'names the key held by two elements of the list',
      responses: {
        resultado: { rows: [{ team: { number: 13, name: 'Bombaja', school: 'UFSM' } }] },
        equipes: {
          teams: [
            { number: 13, short_name: 'Bombaja' },
            { number: 13, short_name: 'Cefast' },
          ],
        },
      },
      expectedProblems: [
        'Pontuação › consulta "equipes": a chave 13 aparece em mais de um item da lista "teams"',
      ],
    },
    // The teams request answered nothing: the join cannot be made.
    {
      name: 'says when the lookup request gave no answer',
      responses: { resultado: { rows: [] } },
      expectedProblems: ['Pontuação › consulta "equipes": não há resposta da requisição "equipes"'],
    },
    // The answer is there but holds no list where the lookup expects it.
    {
      name: 'says when the lookup answer has no list at its path',
      responses: { resultado: { rows: [] }, equipes: { success: false, code: 'not_found' } },
      expectedProblems: [
        'Pontuação › consulta "equipes": não há uma lista em "teams" na resposta de equipes',
      ],
    },
  ];

  it.each(problemScenarios)('$name', ({ responses, expectedProblems }) => {
    // Arrange: the joined mapping.
    const mappings = buildJoinedStandingsMapping();

    // Act: map this row's answers.
    const result = applyFlexMapping(mappings, responses, pollMomentMs);

    // Assert: the mapping fails with the problem naming the lookup.
    expect(result.ok, 'the mapping must fail').toBe(false);
    expect(result.ok ? [] : result.problems, 'the problem must name the lookup').toEqual(
      expectedProblems,
    );
  });
});
