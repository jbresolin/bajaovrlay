/**
 * Nested lists of entries (packages/shared)
 *
 * What this module is for:
 *   The Baja app's tournament answer keeps its matches inside its rounds
 *   (`rounds[].matches[]`), where BAJAOVRLAY-25's brackets mapping read a flat list of
 *   matches. A mapping may now name the outer list (`entriesPath`) and the list inside each
 *   of its elements (`nestedEntriesPath`): each inner element is one entry, and its rules
 *   may read the outer element with `fromParent` (BAJAOVRLAY-53).
 *
 * What these tests prove:
 *   - The real 25SU Super Prime maps into its five rounds, in order, with 8, 4, 2, 1 and 1
 *     matches, each round named from its own `name`, each match in the draw's order.
 *   - An outer element with no inner list is a problem naming its place in the outer list.
 *
 * What these tests deliberately do not cover:
 *   - The flat list of BAJAOVRLAY-25, which keeps working as before:
 *     applyFlexMappingBrackets.test.ts.
 *   - Pending rounds and the third place's place: applyFlexMappingBracketContracts.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { applyFlexMapping } from './applyFlexMapping.js';
import { bajaAppFixtureFiles, readBajaAppFixture } from './bajaAppFixtures.testSupport.js';
import { FlexMappingConfigSchema } from './flexMappingConfig.js';

/** The moment of the poll in these tests: the 25SU Super Prime's afternoon. */
const pollMomentMs = Date.UTC(2025, 9, 26, 18, 0, 0);

/** A bracket mapping reading matches inside rounds, each named from its round. */
function buildRoundsOfMatchesMapping() {
  return FlexMappingConfigSchema.parse([
    {
      shapeKey: 'brackets',
      requestId: 'torneio',
      entriesPath: 'rounds',
      nestedEntriesPath: 'matches',
      fields: [],
      entryFields: [
        { targetField: 'roundName', fromParent: 'name' },
        { targetField: 'matchId', fromPath: 'match_id', transformId: 'numberToText' },
        { targetField: 'carA.carNumber', fromPath: 'slots[0].team.number' },
      ],
    },
  ]);
}

/** The rounds a successful brackets mapping built; none when it failed. */
function readRounds(result: ReturnType<typeof applyFlexMapping>) {
  if (!result.ok) {
    return [];
  }
  const brackets = result.shapes.brackets as {
    rounds: Array<{ name: string; matches: Array<{ matchId: string; carA: unknown }> }>;
  };
  return brackets.rounds;
}

describe('applyFlexMapping, nested lists', () => {
  it('maps the real 25SU Super Prime into its five rounds of matches', () => {
    // Arrange: the nested mapping and the real 25SU tournament answer.
    const mappings = buildRoundsOfMatchesMapping();
    const tournament = readBajaAppFixture(bajaAppFixtureFiles.superPrime25SU);

    // Act: map it.
    const result = applyFlexMapping(mappings, { torneio: tournament }, pollMomentMs);
    const rounds = readRounds(result);

    // Assert: five rounds in the answer's order, each with its own count of matches, and
    // the first round's matches in the draw's order (113 first, car 4 its top seed).
    expect(result.ok ? [] : result.problems, 'the tournament must map with no problem').toEqual([]);
    expect(
      rounds.map((round) => [round.name, round.matches.length]),
      'the rounds must come in order with their matches',
    ).toEqual([
      ['Oitavas de Final', 8],
      ['Quartas de final', 4],
      ['Semifinais', 2],
      ['Final', 1],
      ['Disputa 3° lugar', 1],
    ]);
    expect(rounds[0]?.matches.slice(0, 2), 'the matches must keep the draw order').toEqual([
      { matchId: '113', carA: { carNumber: 4 } },
      { matchId: '114', carA: { carNumber: 6 } },
    ]);
  });

  it('names the outer element that has no inner list', () => {
    // Arrange: a tournament whose second round lost its matches list.
    const mappings = buildRoundsOfMatchesMapping();
    const tournament = {
      rounds: [
        { name: 'Semifinais', matches: [] },
        { name: 'Final', partidas: [] },
      ],
    };

    // Act: map it.
    const result = applyFlexMapping(mappings, { torneio: tournament }, pollMomentMs);

    // Assert: the mapping fails, naming the second element of "rounds".
    expect(result.ok ? [] : result.problems, 'the problem must name the outer element').toEqual([
      'Chaves › item 2 de "rounds": não há uma lista em "matches"',
    ]);
  });
});
