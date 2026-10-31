/**
 * Brackets' contracts A and C, applied on our side (packages/shared)
 *
 * What this module is for:
 *   The brackets shape wants whole rounds (contract A: no pending "Vencedor J125" slot) and
 *   the third place no later than the final (contract C). The Baja app's tournament answer
 *   lists pending slots mid-tournament and its third place after the final, so the flex
 *   mapping applies both itself, for any source (BAJAOVRLAY-53):
 *   - a match is incomplete when a rule says so (`entryIsIncompleteWhen`, such as a side
 *     whose slot type is pending or unknown); the first round holding an incomplete match
 *     is left out, with every round after it; the third place, which nothing follows, is
 *     left out alone, so a finished round is never lost;
 *   - a third-place round listed after the final is moved just before it.
 *
 * What these tests prove:
 *   - The real 25SU and 26BR Super Primes map into brackets that pass validateDataShape,
 *     their third place moved just before the final.
 *   - The made-up 25SU bracket with its semifinals running keeps its first three rounds and
 *     leaves out the final and the third place, whose sides are pending; the pending
 *     matches' own problems are not reported, since they are left out.
 *   - A pending side in the quarter-finals leaves out the quarter-finals and every round
 *     after them, even the complete ones.
 *   - A finished final is kept when only the third place is still pending.
 *
 * What these tests deliberately do not cover:
 *   - Nested rounds of matches on their own: applyFlexMappingNestedEntries.test.ts.
 *   - The shape's own rules for rounds: bracketsShapeRounds.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { validateDataShape } from '../dataShapes/validateDataShape.js';
import { applyFlexMapping } from './applyFlexMapping.js';
import { buildDraftTournamentMappings } from './bajaAppDraftPresets.testSupport.js';
import { bajaAppFixtureFiles, readBajaAppFixture } from './bajaAppFixtures.testSupport.js';

/** The moment of the poll in these tests: the 25SU Super Prime's afternoon. */
const pollMomentMs = Date.UTC(2025, 9, 26, 18, 0, 0);

/** A tournament answer's rounds, as the tests change them. */
type TournamentAnswer = {
  rounds: Array<{ round: number; matches: Array<{ slots: unknown[]; winner: unknown }> }>;
};

/** A slot not decided yet, as the API lists one: the winner or loser of an earlier match. */
function buildPendingSlot(fromMatch: number, takes: 'winner' | 'loser') {
  return { type: 'pending', from_match: fromMatch, takes };
}

/** Maps a tournament answer with the draft mapping, then validates the brackets. */
function mapAndValidateTournament(tournament: unknown) {
  const result = applyFlexMapping(
    buildDraftTournamentMappings(),
    { torneio: tournament },
    pollMomentMs,
  );
  const brackets = result.ok ? result.shapes.brackets : undefined;
  const validation = validateDataShape('brackets', brackets);
  const roundNames = result.ok
    ? (brackets as { rounds: Array<{ name: string }> }).rounds.map((round) => round.name)
    : result.problems;
  return { validation, roundNames };
}

describe('applyFlexMapping, brackets contracts A and C', () => {
  const realBracketScenarios: Array<{ name: string; fileName: string; expectedRounds: string[] }> =
    [
      // 25SU: from the round of 16, best of 3 throughout, byes in the first round.
      {
        name: 'maps the real 25SU Super Prime, its third place just before the final',
        fileName: bajaAppFixtureFiles.superPrime25SU,
        expectedRounds: [
          'Oitavas de Final',
          'Quartas de final',
          'Semifinais',
          'Disputa 3° lugar',
          'Final',
        ],
      },
      // 26BR: from the round of 64, single races until the semifinals.
      {
        name: 'maps the real 26BR Super Prime, its third place just before the final',
        fileName: bajaAppFixtureFiles.superPrime26BR,
        expectedRounds: [
          '32 avos de Final',
          '16 avos de Final',
          'Oitavas de Final',
          'Quartas de final',
          'Semifinais',
          'Disputa 3° lugar',
          'Final',
        ],
      },
    ];

  it.each(realBracketScenarios)('$name', ({ fileName, expectedRounds }) => {
    // Arrange: this row's real tournament answer.
    const tournament = readBajaAppFixture(fileName);

    // Act: map and validate it.
    const { validation, roundNames } = mapAndValidateTournament(tournament);

    // Assert: valid brackets, rounds in order, the third place before the final.
    expect(validation, 'the brackets must pass the canonical validation').toMatchObject({
      isValid: true,
    });
    expect(roundNames, 'the third place must sit just before the final').toEqual(expectedRounds);
  });

  it('leaves out the final and third place of the made-up 25SU bracket, whose sides are pending', () => {
    // Arrange: 25SU's Super Prime with its semifinals still running (made up).
    const tournament = readBajaAppFixture(bajaAppFixtureFiles.superPrime25SUWithPendingSlots);

    // Act: map and validate it.
    const { validation, roundNames } = mapAndValidateTournament(tournament);

    // Assert: valid, with the three whole rounds only.
    expect(validation, 'the brackets must pass the canonical validation').toMatchObject({
      isValid: true,
    });
    expect(roundNames, 'only the whole rounds must be kept').toEqual([
      'Oitavas de Final',
      'Quartas de final',
      'Semifinais',
    ]);
  });

  it('leaves out every round from the quarter-finals on when one quarter-final side is pending', () => {
    // Arrange: the real 25SU bracket with one side of its first quarter-final pending.
    const tournament = readBajaAppFixture(bajaAppFixtureFiles.superPrime25SU) as TournamentAnswer;
    const firstQuarterFinal = tournament.rounds[1]?.matches[0];
    if (firstQuarterFinal !== undefined) {
      firstQuarterFinal.slots[1] = buildPendingSlot(114, 'winner');
      firstQuarterFinal.winner = null;
    }

    // Act: map and validate it.
    const { validation, roundNames } = mapAndValidateTournament(tournament);

    // Assert: the round of 16 alone, though the later rounds are complete.
    expect(validation, 'the brackets must pass the canonical validation').toMatchObject({
      isValid: true,
    });
    expect(roundNames, 'every round from the first incomplete one must go').toEqual([
      'Oitavas de Final',
    ]);
  });

  it('keeps a finished final when only the third place is still pending', () => {
    // Arrange: the real 25SU bracket with its third place's sides pending.
    const tournament = readBajaAppFixture(bajaAppFixtureFiles.superPrime25SU) as TournamentAnswer;
    const thirdPlaceMatch = tournament.rounds.find((round) => round.round === -1)?.matches[0];
    if (thirdPlaceMatch !== undefined) {
      thirdPlaceMatch.slots = [buildPendingSlot(125, 'loser'), buildPendingSlot(126, 'loser')];
      thirdPlaceMatch.winner = null;
    }

    // Act: map and validate it.
    const { validation, roundNames } = mapAndValidateTournament(tournament);

    // Assert: the final stays; only the third place goes.
    expect(validation, 'the brackets must pass the canonical validation').toMatchObject({
      isValid: true,
    });
    expect(roundNames, 'a finished round must never be lost').toEqual([
      'Oitavas de Final',
      'Quartas de final',
      'Semifinais',
      'Final',
    ]);
  });
});
