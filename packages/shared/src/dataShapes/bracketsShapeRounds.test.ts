/**
 * The brackets shape's rounds, and the real Super Prime (packages/shared)
 *
 * What this module is for:
 *   The brackets shape (bracketsShape.ts) holds an elimination's rounds, first round
 *   first. One of them may be the third-place match (`isThirdPlace`), run by the
 *   semifinals' losers, which the graphic draws at the foot of the final's column.
 *   bracketsShape.test.ts covers one match's rules; this file covers the rounds.
 *
 * What these tests prove:
 *   - A third place after the semifinals passes, after the final too (the real export's
 *     order); a second third place, one before the semifinals, and one in brackets with
 *     no semifinals are refused at that round, with the pt-BR sentence the operator reads.
 *   - The real Super Prime of the 30ª Competição (33 cars in 64 slots) passes as a whole,
 *     and reads like the real draw: 31 byes, best of 3 from the semifinals on.
 *
 * What these tests deliberately do not cover:
 *   - Whether a round's winners are really the next round's cars: progression is the
 *     source's, and a source mid-update may list a round before the last one is written.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { validateDataShape } from './validateDataShape.js';

/** One car as the brackets list it. */
function buildBracketCar(carNumber: number, teamName: string, schoolName: string) {
  return { carNumber, teamName, schoolName };
}

/** Brackets of one session holding the given rounds, as a source would send them. */
function buildBracketsWithRounds(rounds: unknown[]) {
  return { sessionId: 'super-prime-30a-competicao', updatedAtMs: 1_793_552_400_000, rounds };
}

/** A round of `matchCount` decided timed matches between made-up pairs of cars. */
function buildRoundOfMatches(
  name: string,
  matchCount: number,
  extra: Record<string, unknown> = {},
) {
  const matches = Array.from({ length: matchCount }, (_unused, index) => {
    const carA = buildBracketCar(100 + index * 2, `Equipe ${100 + index * 2}`, 'UFPR');
    const carB = buildBracketCar(101 + index * 2, `Equipe ${101 + index * 2}`, 'UFSC');
    return { matchId: `${name}-${index + 1}`, carA, carB, winnerCarNumber: carA.carNumber };
  });
  return { name, ...extra, matches };
}

/** Reads one sample payload from samples/ as plain JSON, exactly as a source would send it. */
function readSamplePayload(fileName: string): unknown {
  const sampleUrl = new URL(`./samples/${fileName}`, import.meta.url);
  return JSON.parse(readFileSync(sampleUrl, 'utf8')) as unknown;
}

describe('the third-place round', () => {
  it('accepts a third place listed after the final, as the real export does', () => {
    // Arrange: semifinals, the final, then the third place.
    const brackets = buildBracketsWithRounds([
      buildRoundOfMatches('Semifinal', 2),
      buildRoundOfMatches('Final', 1),
      buildRoundOfMatches('Disputa de 3º lugar', 1, { isThirdPlace: true }),
    ]);

    // Act: validate them.
    const validation = validateDataShape('brackets', brackets);

    // Assert: accepted.
    expect(validation.isValid, 'a third place after the semifinals must pass').toBe(true);
  });

  const refusedThirdPlaceScenarios = [
    // Two matches for one bronze would leave the tree two places to put them.
    {
      name: 'refuses a second third-place round',
      rounds: [
        buildRoundOfMatches('Semifinal', 2),
        buildRoundOfMatches('Disputa de 3º lugar', 1, { isThirdPlace: true }),
        buildRoundOfMatches('Final', 1),
        buildRoundOfMatches('Outra disputa de 3º lugar', 1, { isThirdPlace: true }),
      ],
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.3.isThirdPlace": só uma fase pode ser a disputa de 3º lugar.',
    },
    // The third place is run by the semifinals' losers, so it cannot come before them.
    {
      name: 'refuses a third place before the semifinals',
      rounds: [
        buildRoundOfMatches('Quartas de final', 4),
        buildRoundOfMatches('Disputa de 3º lugar', 1, { isThirdPlace: true }),
        buildRoundOfMatches('Semifinal', 2),
        buildRoundOfMatches('Final', 1),
      ],
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.1.isThirdPlace": a disputa de 3º lugar vem depois das semifinais (a fase de duas disputas).',
    },
    // With no semifinals at all there are no losers to play for third.
    {
      name: 'refuses a third place in brackets with no semifinals',
      rounds: [
        buildRoundOfMatches('Final', 1),
        buildRoundOfMatches('Disputa de 3º lugar', 1, { isThirdPlace: true }),
      ],
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.1.isThirdPlace": a disputa de 3º lugar vem depois das semifinais (a fase de duas disputas).',
    },
  ];

  it.each(refusedThirdPlaceScenarios)('$name', ({ rounds, expectedErrorMessage }) => {
    // Arrange: brackets with this row's rounds.
    const brackets = buildBracketsWithRounds(rounds);

    // Act: validate them.
    const validation = validateDataShape('brackets', brackets);

    // Assert: refused at the third-place round, with this row's reason.
    expect(validation, 'the rounds must be refused for the rule this row breaks').toEqual({
      isValid: false,
      errorMessage: expectedErrorMessage,
    });
  });
});

describe('the real Super Prime of the 30ª Competição', () => {
  it('passes the brackets shape whole', () => {
    // Arrange: the sample made from docs/design/sample_data/results/super_prime.md.
    const superPrime = readSamplePayload('brackets.super-prime.json');

    // Act: validate it.
    const validation = validateDataShape('brackets', superPrime);

    // Assert: accepted, nothing dropped.
    expect(validation, 'the real Super Prime must pass as it is').toEqual({
      isValid: true,
      shape: superPrime,
    });
  });

  it('reads like the real draw: 33 cars in 64 slots, 31 byes, best of 3 from the semifinals on', () => {
    // Arrange: the same sample, read as plain JSON.
    const superPrime = readSamplePayload('brackets.super-prime.json') as {
      rounds: Array<{
        name: string;
        isThirdPlace?: boolean;
        matches: Array<{ carB?: unknown; walkover?: boolean; bestOf?: number }>;
      }>;
    };

    // Act: count what a reviewer would check against the results sheet.
    const matchCountsByRound = superPrime.rounds.map((round) => round.matches.length);
    const firstRoundMatches = superPrime.rounds[0]?.matches ?? [];
    const byeCount = firstRoundMatches.filter((match) => match.carB === undefined).length;
    const carsInTheDraw = firstRoundMatches.length * 2 - byeCount;
    const roundsPlayedAsBestOfThree = superPrime.rounds
      .filter((round) => round.matches.every((match) => match.bestOf === 3))
      .map((round) => round.name);

    // Assert: the draw and the series are the real ones.
    expect(
      matchCountsByRound,
      'six rounds from 32 avos to the final, then the third place',
    ).toEqual([32, 16, 8, 4, 2, 1, 1]);
    expect(byeCount, 'the 32 avos must be 31 byes and one race').toBe(31);
    expect(carsInTheDraw, '33 cars entered the Super Prime').toBe(33);
    expect(
      roundsPlayedAsBestOfThree,
      'only the semifinals, the final and the third place are best of 3',
    ).toEqual(['Semifinal', 'Final', 'Disputa de 3º lugar']);
    expect(superPrime.rounds.at(-1)?.isThirdPlace, 'the third place is the last round').toBe(true);
  });
});
