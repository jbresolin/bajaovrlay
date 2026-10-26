/**
 * The rules the brackets' rounds are checked by as a whole (bracketsShape.ts runs them as
 * the shape's superRefine), each refusing with a pt-BR reason at the round or the field:
 * - a round is listed whole (gate 2 of PR #30, contract A): every round after the first,
 *   the third place aside, has exactly ceil(previous ÷ 2) matches, which also refuses
 *   rounds listed in reverse; a source lists a round only once every match in it is known;
 * - the third place: at most one, of exactly one match, after the semifinals (the round of
 *   two matches);
 * - a car appears at most once in a round, and a match id once in the whole brackets (the
 *   graphic's tree and its crossfade find a match by its id).
 * The order of the third place against the final is a contract, not a rule (contract C:
 * listed no later than the final); bracketSteps.test.ts says what the steps do otherwise.
 */
import type { z } from 'zod';

import type { BracketRound } from './bracketsShape.js';
import { ptBRDataShapes } from './ptBRDataShapes.js';

type RefinementContext = z.core.$RefinementCtx<unknown>;

/** Checks the rounds as a whole; every rule names its own problems. */
export function addIssuesOfTheRounds(rounds: BracketRound[], context: RefinementContext): void {
  addIssuesOfTheRoundSizes(rounds, context);
  addIssuesOfTheThirdPlace(rounds, context);
  addIssuesOfCarsListedTwiceInARound(rounds, context);
  addIssuesOfMatchIdsListedTwice(rounds, context);
}

/** Each round after the first, the third place aside, has ceil(previous ÷ 2) matches. */
function addIssuesOfTheRoundSizes(rounds: BracketRound[], context: RefinementContext): void {
  let matchCountOfThePreviousRound: number | undefined;
  rounds.forEach((round, roundIndex) => {
    if (round.isThirdPlace === true) {
      return;
    }
    const matchCount = round.matches.length;
    if (matchCountOfThePreviousRound !== undefined) {
      const expectedMatchCount = Math.ceil(matchCountOfThePreviousRound / 2);
      if (matchCount !== expectedMatchCount) {
        context.addIssue({
          code: 'custom',
          path: ['rounds', roundIndex, 'matches'],
          message: ptBRDataShapes.shapeRuleReasons.roundOfTheWrongSize(
            round.name,
            matchCount,
            matchCountOfThePreviousRound,
            expectedMatchCount,
          ),
        });
      }
    }
    matchCountOfThePreviousRound = matchCount;
  });
}

/** At most one third place, of one match, after a round of two matches (the semifinals). */
function addIssuesOfTheThirdPlace(rounds: BracketRound[], context: RefinementContext): void {
  const reasons = ptBRDataShapes.shapeRuleReasons;
  let thirdPlaceRoundsSeen = 0;
  let hasSemifinalsBefore = false;
  rounds.forEach((round, roundIndex) => {
    if (round.isThirdPlace !== true) {
      if (round.matches.length === 2) {
        hasSemifinalsBefore = true;
      }
      return;
    }
    thirdPlaceRoundsSeen += 1;
    const path = ['rounds', roundIndex, 'isThirdPlace'];
    if (thirdPlaceRoundsSeen > 1) {
      context.addIssue({ code: 'custom', path, message: reasons.thirdPlaceListedTwice });
      return;
    }
    if (!hasSemifinalsBefore) {
      context.addIssue({ code: 'custom', path, message: reasons.thirdPlaceBeforeSemifinals });
      return;
    }
    if (round.matches.length !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['rounds', roundIndex, 'matches'],
        message: reasons.thirdPlaceOfOtherThanOneMatch(round.matches.length),
      });
    }
  });
}

/** A car at most once in a round: named at its second appearance. */
function addIssuesOfCarsListedTwiceInARound(
  rounds: BracketRound[],
  context: RefinementContext,
): void {
  rounds.forEach((round, roundIndex) => {
    const carNumbersSeen = new Set<number>();
    round.matches.forEach((match, matchIndex) => {
      const carsOfTheMatch = match.carB === undefined ? [match.carA] : [match.carA, match.carB];
      carsOfTheMatch.forEach((car, carIndex) => {
        if (carNumbersSeen.has(car.carNumber)) {
          context.addIssue({
            code: 'custom',
            path: [
              'rounds',
              roundIndex,
              'matches',
              matchIndex,
              carIndex === 0 ? 'carA' : 'carB',
              'carNumber',
            ],
            message: ptBRDataShapes.shapeRuleReasons.carListedTwice(car.carNumber),
          });
        }
        carNumbersSeen.add(car.carNumber);
      });
    });
  });
}

/** A match id once in the whole brackets: named at its second appearance. */
function addIssuesOfMatchIdsListedTwice(rounds: BracketRound[], context: RefinementContext): void {
  const matchIdsSeen = new Set<string>();
  rounds.forEach((round, roundIndex) => {
    round.matches.forEach((match, matchIndex) => {
      if (matchIdsSeen.has(match.matchId)) {
        context.addIssue({
          code: 'custom',
          path: ['rounds', roundIndex, 'matches', matchIndex, 'matchId'],
          message: ptBRDataShapes.shapeRuleReasons.matchIdListedTwice(match.matchId),
        });
      }
      matchIdsSeen.add(match.matchId);
    });
  });
}
