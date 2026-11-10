import type { BracketMatch, BracketRound } from '../dataShapes/index.js';

/** One raced match in play order, with what the graphics show about its round. */
export type BracketMatchInPlayOrder = {
  match: BracketMatch;
  /** The round's name as the source writes it: "Quartas de final", "Disputa de 3º lugar". */
  roundName: string;
  /** True for the third-place match. */
  isThirdPlace: boolean;
};

/**
 * How far a match has got: `decided` (it has a winner, "encerrada"), `running` (a result
 * without a winner yet: a win of a best of N, a time, "em andamento") or `notStarted`
 * (nothing yet, "a definir").
 */
export type BracketMatchProgress = 'decided' | 'running' | 'notStarted';

/** Says whether a match is a bye: carA alone, through by W.O. from the draw. */
function isBye(match: BracketMatch): boolean {
  return match.carB === undefined;
}

/**
 * Lists the raced matches of the brackets in play order (BAJAOVRLAY-65): the source's
 * order, rounds first to last and matches as listed. Byes are left out: nobody races
 * them, so they are neither suggested nor offered to the operator.
 * Deliberate: the source's order is the only order. Reality may differ (the final run
 * after a third place listed later), and the operator picks the match by hand for that.
 */
export function listBracketMatchesInPlayOrder(
  rounds: readonly BracketRound[],
): BracketMatchInPlayOrder[] {
  const matchesInPlayOrder: BracketMatchInPlayOrder[] = [];
  for (const round of rounds) {
    for (const match of round.matches) {
      if (isBye(match)) {
        continue;
      }
      matchesInPlayOrder.push({
        match,
        roundName: round.name,
        isThirdPlace: round.isThirdPlace === true,
      });
    }
  }
  return matchesInPlayOrder;
}

/** Says whether a car of the match carries a result: a win of the series, or a time. */
function hasCarAResult(car: BracketMatch['carA'] | undefined): boolean {
  if (car === undefined) {
    return false;
  }
  const hasWins = car.wins !== undefined && car.wins > 0;
  return hasWins || car.timeMs !== undefined;
}

/**
 * How far one match has got, read from what it carries: a winner is decided; otherwise
 * a win or a time on either car is running; otherwise not started. A best of 3 written
 * at 0 × 0 is not started: no race has been run.
 */
export function readBracketMatchProgress(match: BracketMatch): BracketMatchProgress {
  if (match.winnerCarNumber !== undefined) {
    return 'decided';
  }
  if (hasCarAResult(match.carA) || hasCarAResult(match.carB)) {
    return 'running';
  }
  return 'notStarted';
}
