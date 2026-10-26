/**
 * The brackets shape's rounds, and the real Super Prime (packages/shared)
 *
 * What this module is for:
 *   The brackets shape (bracketsShape.ts) holds an elimination's rounds, first round
 *   first. One of them may be the third-place match (`isThirdPlace`), run by the
 *   semifinals' losers, which the graphic draws at the foot of the final's column.
 *   bracketsShape.test.ts covers one match's rules; this file covers the rounds.
 *   A source lists a round only once every match in it is known (gate 2 of PR #30,
 *   contract A), so each round after the first has half the matches of the one before,
 *   rounded up, whatever was decided; and it lists the third place no later than the
 *   final (contract C), which the step plan's tests cover.
 *
 * What these tests prove:
 *   - Every round after the first has exactly ceil(previous ÷ 2) matches: a round listed
 *     part way (4 of 8 oitavas) and rounds listed in reverse (an endpoint ordered by its
 *     round code) are refused at the round that breaks it; the first round may have any
 *     number, and the third place stands outside the count.
 *   - A third place before the final passes, and so does one after it (the shape does not
 *     refuse it; the contract asks for it before); a second third place, one before the
 *     semifinals, one in brackets with no semifinals and one of two matches are refused.
 *   - A car appears at most once in a round, and a match id once in the whole brackets.
 *   - The real Super Prime of the 30ª Competição (33 cars in 64 slots) passes as a whole,
 *     and reads like the real draw: 31 byes, best of 3 from the semifinals on, the third
 *     place listed before the final.
 *
 * What these tests deliberately do not cover:
 *   - Whether a round's winners are really the next round's cars: progression is the
 *     source's; the shape checks the sizes, not who advanced.
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

describe('the size of each round', () => {
  it('accepts rounds of 8, 4, 2 and 1, the third place outside the count', () => {
    // Arrange: an elimination from the oitavas, the third place before the final.
    const brackets = buildBracketsWithRounds([
      buildRoundOfMatches('Oitavas de final', 8),
      buildRoundOfMatches('Quartas de final', 4),
      buildRoundOfMatches('Semifinal', 2),
      buildRoundOfMatches('Disputa de 3º lugar', 1, { isThirdPlace: true }),
      buildRoundOfMatches('Final', 1),
    ]);

    // Act: validate them.
    const validation = validateDataShape('brackets', brackets);

    // Assert: accepted.
    expect(validation.isValid, 'each round half the one before must pass').toBe(true);
  });

  const refusedSizeScenarios = [
    // A source listing a round match by match: 4 of the 8 oitavas would be drawn as a tree
    // column, then as a board at the 5th (contract A).
    {
      name: 'refuses a round listed part way, 4 of its 8 matches',
      rounds: [
        buildRoundOfMatches('16 avos de final', 16),
        buildRoundOfMatches('Oitavas de final', 4),
      ],
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.1.matches": a fase "Oitavas de final" tem 4 disputas, mas depois de uma fase de 16 precisa de 8 (uma fase só é listada inteira).',
    },
    // An endpoint ordered by the Baja app's round code (0 the final … 6) lists them in reverse.
    {
      name: 'refuses rounds listed in reverse, the final first',
      rounds: [
        buildRoundOfMatches('Final', 1),
        buildRoundOfMatches('Semifinal', 2),
        buildRoundOfMatches('Quartas de final', 4),
      ],
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.1.matches": a fase "Semifinal" tem 2 disputas, mas depois de uma fase de 1 precisa de 1 (uma fase só é listada inteira).',
    },
  ];

  it.each(refusedSizeScenarios)('$name', ({ rounds, expectedErrorMessage }) => {
    // Arrange: brackets with this row's rounds.
    const brackets = buildBracketsWithRounds(rounds);

    // Act: validate them.
    const validation = validateDataShape('brackets', brackets);

    // Assert: refused at the round that breaks the size, with this row's reason.
    expect(validation, 'the rounds must be refused for their size').toEqual({
      isValid: false,
      errorMessage: expectedErrorMessage,
    });
  });
});

describe('the third-place round', () => {
  const acceptedThirdPlaceScenarios = [
    // The contract's order (C), the simulator's too: the third place runs before the final.
    {
      name: 'accepts a third place listed before the final',
      rounds: [
        buildRoundOfMatches('Semifinal', 2),
        buildRoundOfMatches('Disputa de 3º lugar', 1, { isThirdPlace: true }),
        buildRoundOfMatches('Final', 1),
      ],
    },
    // After the final the shape does not refuse it; the step plan's tests say what happens.
    {
      name: 'accepts a third place listed after the final, which the contract asks sources not to do',
      rounds: [
        buildRoundOfMatches('Semifinal', 2),
        buildRoundOfMatches('Final', 1),
        buildRoundOfMatches('Disputa de 3º lugar', 1, { isThirdPlace: true }),
      ],
    },
  ];

  it.each(acceptedThirdPlaceScenarios)('$name', ({ rounds }) => {
    // Arrange: the row's rounds.
    const brackets = buildBracketsWithRounds(rounds);

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
    // One bronze, one match: a second would leave the tree two places to put them.
    {
      name: 'refuses a third place of two matches',
      rounds: [
        buildRoundOfMatches('Semifinal', 2),
        buildRoundOfMatches('Disputa de 3º lugar', 2, { isThirdPlace: true }),
        buildRoundOfMatches('Final', 1),
      ],
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.1.matches": a disputa de 3º lugar é uma disputa só, aqui 2.',
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

describe('a car or a match listed twice', () => {
  /** Quarter-finals of four matches, then the semifinals, with one change made by `change`. */
  function buildQuarterFinalsWithOneChange(
    change: (rounds: ReturnType<typeof buildRoundOfMatches>[]) => void,
  ) {
    const rounds = [
      buildRoundOfMatches('Quartas de final', 4),
      buildRoundOfMatches('Semifinal', 2),
    ];
    change(rounds);
    return buildBracketsWithRounds(rounds);
  }

  const listedTwiceScenarios = [
    // A typo putting car 100 in two quarter-finals would draw one car in two places.
    {
      name: 'refuses a car in two matches of one round',
      brackets: buildQuarterFinalsWithOneChange((rounds) => {
        const secondMatch = rounds[0]?.matches[1];
        if (secondMatch !== undefined) {
          secondMatch.carA = buildBracketCar(100, 'Equipe 100', 'UFPR');
          secondMatch.winnerCarNumber = 100;
        }
      }),
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.1.carA.carNumber": o carro 100 aparece mais de uma vez.',
    },
    // The tree and the crossfade find a match by its id, so two matches may not share one.
    {
      name: 'refuses a match id used twice in the brackets',
      brackets: buildQuarterFinalsWithOneChange((rounds) => {
        const semifinal = rounds[1]?.matches[0];
        if (semifinal !== undefined) {
          semifinal.matchId = 'Quartas de final-1';
        }
      }),
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.1.matches.0.matchId": a disputa "Quartas de final-1" aparece mais de uma vez.',
    },
  ];

  it.each(listedTwiceScenarios)('$name', ({ brackets, expectedErrorMessage }) => {
    // Arrange: nothing more; the row built its brackets.

    // Act: validate them.
    const validation = validateDataShape('brackets', brackets);

    // Assert: refused at the second appearance, with this row's reason.
    expect(validation, 'what is listed twice must be refused').toEqual({
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

  it('reads like the real draw: 33 cars in 64 slots, 31 byes, best of 3 from the semifinals on, the third place before the final', () => {
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
      'the rounds from 32 avos to the semifinals, the third place, the final',
    ).toEqual([32, 16, 8, 4, 2, 1, 1]);
    expect(byeCount, 'the 32 avos must be 31 byes and one race').toBe(31);
    expect(carsInTheDraw, '33 cars entered the Super Prime').toBe(33);
    expect(
      roundsPlayedAsBestOfThree,
      'only the semifinals, the final and the third place are best of 3',
    ).toEqual(['Semifinal', 'Disputa de 3º lugar', 'Final']);
    expect(
      superPrime.rounds.map((round) => round.isThirdPlace === true),
      'the third place is listed before the final (contract C)',
    ).toEqual([false, false, false, false, false, true, false]);
  });
});
