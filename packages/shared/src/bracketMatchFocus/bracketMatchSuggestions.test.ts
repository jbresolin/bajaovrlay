/**
 * The matches the system suggests for "agora" and "a seguir" (packages/shared)
 *
 * What this module is for:
 *   During a Super Prime the match bug shows the match "agora" and the card the match "a
 *   seguir" (BAJAOVRLAY-65). The system suggests both from the scoring data, and the
 *   operator accepts the suggestion or picks another. The play order is the source's
 *   order: rounds first to last, matches as listed. The suggested "agora" is the first
 *   match without a winner, and "a seguir" the next match without a winner after it. A
 *   bye (a car alone, through by W.O.) is never suggested: nobody races it.
 *
 * What these tests prove:
 *   - One row per situation of the day: nothing decided yet, byes ahead of the races, a
 *     winner arriving, the third place listed after the final, a match skipped on track,
 *     the last match left, the last match decided, and a match the source stopped listing.
 *
 * What these tests deliberately do not cover:
 *   - The focus itself, which never moves by itself when a suggestion changes: the
 *     server's command tests (modules/bracketMatchFocus).
 *   - The order and the progress of each match in the list: bracketMatchPlayOrder.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { BracketRound } from '../dataShapes/index.js';
import { suggestBracketMatches } from './bracketMatchSuggestions.js';
import {
  buildBye,
  buildDecidedMatch,
  buildQuarterFinals,
  buildUndecidedMatch,
  superPrimeCars,
} from './superPrimeBrackets.testSupport.js';

const cars = superPrimeCars;

/** The quarter-finals all decided: Corisco, Pequi, Cactus and UFSC through. */
function buildQuarterFinalsAllDecided(): BracketRound {
  return buildQuarterFinals({
    'qf-1': cars.corisco,
    'qf-2': cars.pequi,
    'qf-3': cars.cactus,
    'qf-4': cars.ufsc,
  });
}

/** The semifinals of those four, each decided when its winner is given. */
function buildSemifinals(winnerOfTheFirst?: number, winnerOfTheSecond?: number): BracketRound {
  const first =
    winnerOfTheFirst === undefined
      ? buildUndecidedMatch('sf-1', cars.corisco, cars.pequi)
      : {
          ...buildUndecidedMatch('sf-1', cars.corisco, cars.pequi),
          winnerCarNumber: winnerOfTheFirst,
        };
  const second =
    winnerOfTheSecond === undefined
      ? buildUndecidedMatch('sf-2', cars.cactus, cars.ufsc)
      : {
          ...buildUndecidedMatch('sf-2', cars.cactus, cars.ufsc),
          winnerCarNumber: winnerOfTheSecond,
        };
  return { name: 'Semifinal', matches: [first, second] };
}

/** The final of Corisco and Cactus (the semifinals' winners), undecided or won by Corisco. */
function buildFinal(isDecided: boolean): BracketRound {
  const final = isDecided
    ? buildDecidedMatch('final', cars.corisco, cars.cactus, cars.corisco)
    : buildUndecidedMatch('final', cars.corisco, cars.cactus);
  return { name: 'Final', matches: [final] };
}

/** The third place of Pequi and UFSC (the semifinals' losers), undecided or won by Pequi. */
function buildThirdPlace(isDecided: boolean): BracketRound {
  const thirdPlace = isDecided
    ? buildDecidedMatch('terceiro', cars.pequi, cars.ufsc, cars.pequi)
    : buildUndecidedMatch('terceiro', cars.pequi, cars.ufsc);
  return { name: 'Disputa de 3º lugar', isThirdPlace: true, matches: [thirdPlace] };
}

describe('suggestBracketMatches', () => {
  const suggestionScenarios = [
    {
      // The start of the day: the first match listed is "agora", the second "a seguir".
      name: 'suggests the first undecided match and the next one before anything is decided',
      rounds: [buildQuarterFinals()],
      expected: { currentMatchId: 'qf-1', upNextMatchId: 'qf-2' },
    },
    {
      // A draw short of a power of two lists byes; nobody races them, so they are skipped
      // even though they come first.
      name: 'skips the byes listed before the races',
      rounds: [
        {
          name: 'Oitavas de final',
          matches: [
            buildBye('r1-m1', cars.bajaUfmg),
            buildUndecidedMatch('r1-m2', cars.corisco, cars.buffalo),
            buildBye('r1-m3', cars.cactus),
            buildUndecidedMatch('r1-m4', cars.pequi, cars.acaua),
          ],
        },
      ],
      expected: { currentMatchId: 'r1-m2', upNextMatchId: 'r1-m4' },
    },
    {
      // The source gives the first quarter-final its winner: the suggestion moves on by one.
      name: 'moves on by one match when a winner arrives',
      rounds: [buildQuarterFinals({ 'qf-1': cars.corisco })],
      expected: { currentMatchId: 'qf-2', upNextMatchId: 'qf-3' },
    },
    {
      // Contract C says the third place comes no later than the final, but the play order
      // is the source's: listed after the final, it is suggested after the final.
      name: 'follows the source when the third place is listed after the final',
      rounds: [
        buildQuarterFinalsAllDecided(),
        buildSemifinals(cars.corisco.carNumber, cars.cactus.carNumber),
        buildFinal(false),
        buildThirdPlace(false),
      ],
      expected: { currentMatchId: 'final', upNextMatchId: 'terceiro' },
    },
    {
      // On track the operator ran qf-3 before qf-2. qf-2 still has no winner, so it is
      // still the first undecided match: the suggestion never follows the operator's pick.
      name: 'keeps suggesting a match skipped on track until it has a winner',
      rounds: [buildQuarterFinals({ 'qf-1': cars.corisco, 'qf-3': cars.cactus })],
      expected: { currentMatchId: 'qf-2', upNextMatchId: 'qf-4' },
    },
    {
      // One match left to race: it is "agora", and there is nothing after it.
      name: 'suggests nothing "a seguir" when one match is left',
      rounds: [
        buildQuarterFinalsAllDecided(),
        buildSemifinals(cars.corisco.carNumber, cars.cactus.carNumber),
        buildThirdPlace(true),
        buildFinal(false),
      ],
      expected: { currentMatchId: 'final', upNextMatchId: undefined },
    },
    {
      // The final decided: the Super Prime is over and nothing is suggested at all.
      name: 'suggests nothing once the last match is decided',
      rounds: [
        buildQuarterFinalsAllDecided(),
        buildSemifinals(cars.corisco.carNumber, cars.cactus.carNumber),
        buildThirdPlace(true),
        buildFinal(true),
      ],
      expected: { currentMatchId: undefined, upNextMatchId: undefined },
    },
    {
      // The source stopped listing qf-2 (fixed by hand at the timing desk): the
      // suggestion reads only what the source lists now.
      name: 'reads only the matches the source lists now when one is removed',
      rounds: [
        {
          name: 'Quartas de final',
          matches: buildQuarterFinals({ 'qf-1': cars.corisco }).matches.filter(
            (match) => match.matchId !== 'qf-2',
          ),
        },
      ],
      expected: { currentMatchId: 'qf-3', upNextMatchId: 'qf-4' },
    },
  ];

  it.each(suggestionScenarios)('$name', ({ rounds, expected }) => {
    // Arrange: the rounds the source sends at that moment of the day (built above).

    // Act: ask which matches to suggest.
    const suggestion = suggestBracketMatches(rounds);

    // Assert: "agora" and "a seguir" are the expected matches, or nothing.
    expect(suggestion, 'the suggested "agora" and "a seguir" must follow the play order').toEqual(
      expected,
    );
  });

  it('suggests nothing for brackets with no round yet', () => {
    // Arrange: a source that sends the brackets before the draw.
    const rounds: BracketRound[] = [];

    // Act: ask which matches to suggest.
    const suggestion = suggestBracketMatches(rounds);

    // Assert: there is nothing to suggest for either slot.
    expect(suggestion, 'empty brackets must suggest nothing').toEqual({
      currentMatchId: undefined,
      upNextMatchId: undefined,
    });
  });
});
