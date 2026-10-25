/**
 * The rules one bracket match is checked by (bracketsShape.ts runs them as its match's
 * superRefine), each refusing with a pt-BR reason at the field: two different cars; a
 * winner who is one of them; a bye won by carA by W.O.; a W.O. with its winner; and the
 * series rules, which a bye goes through too (its car alone): wins only in a best of N, N
 * odd, no times beside wins, nobody past the wins that end the series, and those wins only
 * with a winner named; once decided on track, the winner with exactly those wins and the
 * loser with fewer.
 */
import type { z } from 'zod';

import type { BracketCar } from './bracketsShape.js';
import { ptBRDataShapes } from './ptBRDataShapes.js';

/** The match as these rules read it. */
export type MatchToCheck = {
  bestOf?: number | undefined;
  walkover?: boolean | undefined;
  carA: BracketCar;
  carB?: BracketCar | undefined;
  winnerCarNumber?: number | undefined;
};

/** One car of the match with the side it is on, which every problem's path names. */
type CarOnItsSide = { side: 'carA' | 'carB'; car: BracketCar };

type RefinementContext = z.core.$RefinementCtx<unknown>;

/** Checks one match, stopping at the first rule that fires (one problem is named). */
export function addIssuesOfAMatch(match: MatchToCheck, context: RefinementContext): void {
  const carsPresent: CarOnItsSide[] = [{ side: 'carA', car: match.carA }];
  if (match.carB === undefined) {
    if (addIssueOfABye(match, context)) {
      return;
    }
  } else {
    carsPresent.push({ side: 'carB', car: match.carB });
    if (addIssueOfTheTwoCars(match, match.carB, context)) {
      return;
    }
  }
  if (match.bestOf === undefined) {
    addIssuesOfWinsWithoutASeries(carsPresent, context);
    return;
  }
  addIssuesOfASeries(match, match.bestOf, carsPresent, context);
}

/** A bye: nobody raced, so carA is through by W.O. from the draw. True when it fired. */
function addIssueOfABye(match: MatchToCheck, context: RefinementContext): boolean {
  const reasons = ptBRDataShapes.shapeRuleReasons;
  if (match.winnerCarNumber !== match.carA.carNumber) {
    context.addIssue({
      code: 'custom',
      path: ['winnerCarNumber'],
      message: reasons.byeWinnerIsNotCarA(match.carA.carNumber),
    });
    return true;
  }
  if (match.walkover !== true) {
    context.addIssue({ code: 'custom', path: ['walkover'], message: reasons.byeIsNotAWalkover });
    return true;
  }
  return false;
}

/**
 * Two cars: different ones (checked first, since with the same car on both sides the
 * winner check would pass for that car, hiding the very typo it is there to catch), the
 * winner one of them, and a W.O. with its winner. True when one fired.
 */
function addIssueOfTheTwoCars(
  match: MatchToCheck,
  carB: BracketCar,
  context: RefinementContext,
): boolean {
  const reasons = ptBRDataShapes.shapeRuleReasons;
  if (match.carA.carNumber === carB.carNumber) {
    context.addIssue({
      code: 'custom',
      path: ['carB', 'carNumber'],
      message: reasons.sameCarOnBothSides(carB.carNumber),
    });
    return true;
  }
  const winner = match.winnerCarNumber;
  const isWinnerOneOfTheTwoCars =
    winner === undefined || winner === match.carA.carNumber || winner === carB.carNumber;
  if (!isWinnerOneOfTheTwoCars) {
    context.addIssue({
      code: 'custom',
      path: ['winnerCarNumber'],
      message: reasons.winnerNotInMatch(winner),
    });
    return true;
  }
  if (match.walkover === true && winner === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['winnerCarNumber'],
      message: reasons.walkoverWithoutWinner,
    });
    return true;
  }
  return false;
}

/** Wins count races of a series, so a match that is not a best of N carries none. */
function addIssuesOfWinsWithoutASeries(
  carsPresent: CarOnItsSide[],
  context: RefinementContext,
): void {
  for (const { side, car } of carsPresent) {
    if (car.wins !== undefined) {
      context.addIssue({
        code: 'custom',
        path: [side, 'wins'],
        message: ptBRDataShapes.shapeRuleReasons.winsWithoutBestOf,
      });
    }
  }
}

/**
 * A best of N: N odd; no time on a car (a match shows times or wins, never both); nobody
 * past the wins that end the series; a car with those wins only beside a named winner;
 * and once decided on track (not by W.O.), the winner with exactly those wins and the
 * loser with fewer.
 */
function addIssuesOfASeries(
  match: MatchToCheck,
  bestOf: number,
  carsPresent: CarOnItsSide[],
  context: RefinementContext,
): void {
  const reasons = ptBRDataShapes.shapeRuleReasons;
  if (bestOf % 2 === 0) {
    context.addIssue({ code: 'custom', path: ['bestOf'], message: reasons.bestOfNotOdd(bestOf) });
    return;
  }
  const winsNeeded = (bestOf + 1) / 2;
  let hasProblem = false;
  for (const { side, car } of carsPresent) {
    if (car.timeMs !== undefined) {
      context.addIssue({
        code: 'custom',
        path: [side, 'timeMs'],
        message: reasons.timesAndWinsMixed(bestOf),
      });
      hasProblem = true;
    }
    if (car.wins !== undefined && car.wins > winsNeeded) {
      context.addIssue({
        code: 'custom',
        path: [side, 'wins'],
        message: reasons.winsOverTheSeries(bestOf, winsNeeded, car.wins),
      });
      hasProblem = true;
    }
  }
  if (hasProblem) {
    return;
  }

  if (match.winnerCarNumber === undefined) {
    // The series is over the moment a car reaches its wins: a source writing the wins
    // before the winner would put a finished match on air as still running.
    const carWithTheWins = carsPresent.find(({ car }) => car.wins === winsNeeded);
    if (carWithTheWins !== undefined) {
      context.addIssue({
        code: 'custom',
        path: [carWithTheWins.side, 'wins'],
        message: reasons.seriesWonWithoutWinner(bestOf, winsNeeded, carWithTheWins.car.carNumber),
      });
    }
    return;
  }
  if (match.walkover === true) {
    return;
  }

  const winner = carsPresent.find(({ car }) => car.carNumber === match.winnerCarNumber);
  const loser = carsPresent.find(({ car }) => car.carNumber !== match.winnerCarNumber);
  const winnerWins = winner?.car.wins ?? 0;
  if (winnerWins !== winsNeeded) {
    context.addIssue({
      code: 'custom',
      path: ['winnerCarNumber'],
      message: reasons.winnerWithoutTheWins(bestOf, winsNeeded, winnerWins),
    });
    return;
  }
  const loserWins = loser?.car.wins ?? 0;
  if (loser !== undefined && loserWins >= winsNeeded) {
    context.addIssue({
      code: 'custom',
      path: [loser.side, 'wins'],
      message: reasons.loserWithTheWins(bestOf, winsNeeded, loserWins),
    });
  }
}
