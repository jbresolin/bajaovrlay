import { z } from 'zod';

import { ptBRDataShapes } from './ptBRDataShapes.js';

// Refined by BAJAOVRLAY-25 against the Baja app's `tournament` table (catalogue entry 4):
// best of N, W.O., byes and the third place. Who advances is the source's job; these rules
// only refuse a bracket that contradicts itself.

/** One car in a match, repeating its team and school so a graphic never joins. */
export const BracketCarSchema = z.object({
  carNumber: z.number().int().positive(),
  teamName: z.string().min(1),
  /** The university, short form ("UFPR"). */
  schoolName: z.string().min(1),
  /** The car's time in this match, in ms, for a timed run; left out until it has run. */
  timeMs: z.number().int().min(0).optional(),
  /** The races this car has won in a best of N (the match's `bestOf`); left out before any. */
  wins: z.number().int().min(0).optional(),
});

/** One car of a match that has passed BracketCarSchema. */
export type BracketCar = z.infer<typeof BracketCarSchema>;

/**
 * One head-to-head match. Its result is one of three kinds, told by what it carries: times
 * (`timeMs` on the cars), wins (`bestOf`, with `wins` on the cars) or only the winner. A bye
 * is a match with no `carB`: a draw short of a power of two, `carA` through by W.O.
 */
export const BracketMatchSchema = z
  .object({
    matchId: z.string().min(1),
    /** A series: the first to (bestOf + 1) / 2 wins goes through. Odd, from 1. */
    bestOf: z.number().int().min(1).optional(),
    /** True when the winner advanced without racing (the opponent absent, or a bye). */
    walkover: z.boolean().optional(),
    carA: BracketCarSchema,
    /** Left out for a bye: the slot facing carA is empty. */
    carB: BracketCarSchema.optional(),
    /** Left out until the match is decided. */
    winnerCarNumber: z.number().int().positive().optional(),
  })
  .superRefine((match, context) => {
    if (match.carB === undefined) {
      addIssuesOfABye(match, context);
      return;
    }
    // Checked first: with the same car on both sides, the winner check below would pass
    // for that car, hiding the very typo it is there to catch.
    if (match.carA.carNumber === match.carB.carNumber) {
      context.addIssue({
        code: 'custom',
        path: ['carB', 'carNumber'],
        message: ptBRDataShapes.shapeRuleReasons.sameCarOnBothSides(match.carB.carNumber),
      });
      return;
    }
    const twoCars = { carA: match.carA, carB: match.carB };
    if (addIssueOfAWinnerWhoDidNotRace(match, twoCars, context)) {
      return;
    }
    if (match.walkover === true && match.winnerCarNumber === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['winnerCarNumber'],
        message: ptBRDataShapes.shapeRuleReasons.walkoverWithoutWinner,
      });
      return;
    }
    if (match.bestOf === undefined) {
      addIssuesOfWinsWithoutASeries(twoCars, context);
      return;
    }
    addIssuesOfASeries(match, match.bestOf, twoCars, context);
  });

/** One match that has passed BracketMatchSchema. */
export type BracketMatch = z.infer<typeof BracketMatchSchema>;

/** The match as the rules below read it: every field optional but the two in a bye's case. */
type MatchToCheck = {
  bestOf?: number | undefined;
  walkover?: boolean | undefined;
  carA: BracketCar;
  carB?: BracketCar | undefined;
  winnerCarNumber?: number | undefined;
};

/** The two cars of a match that is not a bye, each with the path a problem names. */
type TwoCars = { carA: BracketCar; carB: BracketCar };

type RefinementContext = z.core.$RefinementCtx<unknown>;

/** A bye: nobody raced, so carA is through by W.O. from the moment of the draw. */
function addIssuesOfABye(match: MatchToCheck, context: RefinementContext): void {
  const reasons = ptBRDataShapes.shapeRuleReasons;
  if (match.winnerCarNumber !== match.carA.carNumber) {
    context.addIssue({
      code: 'custom',
      path: ['winnerCarNumber'],
      message: reasons.byeWinnerIsNotCarA(match.carA.carNumber),
    });
    return;
  }
  if (match.walkover !== true) {
    context.addIssue({ code: 'custom', path: ['walkover'], message: reasons.byeIsNotAWalkover });
  }
}

/** The draft's rule: a winner, when known, is one of the two cars. True when it fired. */
function addIssueOfAWinnerWhoDidNotRace(
  match: MatchToCheck,
  twoCars: TwoCars,
  context: RefinementContext,
): boolean {
  const winner = match.winnerCarNumber;
  if (winner === undefined) {
    return false;
  }
  const isWinnerOneOfTheTwoCars =
    winner === twoCars.carA.carNumber || winner === twoCars.carB.carNumber;
  if (isWinnerOneOfTheTwoCars) {
    return false;
  }
  context.addIssue({
    code: 'custom',
    path: ['winnerCarNumber'],
    message: ptBRDataShapes.shapeRuleReasons.winnerNotInMatch(winner),
  });
  return true;
}

/** Wins count races of a series, so a match that is not a best of N carries none. */
function addIssuesOfWinsWithoutASeries(twoCars: TwoCars, context: RefinementContext): void {
  for (const side of ['carA', 'carB'] as const) {
    if (twoCars[side].wins !== undefined) {
      context.addIssue({
        code: 'custom',
        path: [side, 'wins'],
        message: ptBRDataShapes.shapeRuleReasons.winsWithoutBestOf,
      });
    }
  }
}

/**
 * A best of N: N odd; no time on either car (a match shows times or wins, never both); no
 * car past the wins that end the series; and once decided, except by W.O., the winner has
 * exactly those wins and the loser fewer.
 */
function addIssuesOfASeries(
  match: MatchToCheck,
  bestOf: number,
  twoCars: TwoCars,
  context: RefinementContext,
): void {
  const reasons = ptBRDataShapes.shapeRuleReasons;
  if (bestOf % 2 === 0) {
    context.addIssue({ code: 'custom', path: ['bestOf'], message: reasons.bestOfNotOdd(bestOf) });
    return;
  }
  const winsNeeded = (bestOf + 1) / 2;
  let hasProblem = false;
  for (const side of ['carA', 'carB'] as const) {
    const car = twoCars[side];
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
  const isDecidedOnTrack = match.winnerCarNumber !== undefined && match.walkover !== true;
  if (hasProblem || !isDecidedOnTrack) {
    return;
  }

  const winnerSide = twoCars.carA.carNumber === match.winnerCarNumber ? 'carA' : 'carB';
  const loserSide = winnerSide === 'carA' ? 'carB' : 'carA';
  const winnerWins = twoCars[winnerSide].wins ?? 0;
  const loserWins = twoCars[loserSide].wins ?? 0;
  if (winnerWins !== winsNeeded) {
    context.addIssue({
      code: 'custom',
      path: ['winnerCarNumber'],
      message: reasons.winnerWithoutTheWins(bestOf, winsNeeded, winnerWins),
    });
    return;
  }
  if (loserWins >= winsNeeded) {
    context.addIssue({
      code: 'custom',
      path: [loserSide, 'wins'],
      message: reasons.loserWithTheWins(bestOf, winsNeeded, loserWins),
    });
  }
}

/** One round of the brackets ("Quartas de final") and its matches. */
export const BracketRoundSchema = z.object({
  name: z.string().min(1),
  /**
   * True for the third-place match, run by the semifinals' losers: not a column of the
   * tree, but drawn at the foot of the final's. At most one, after the semifinals.
   */
  isThirdPlace: z.boolean().optional(),
  matches: z.array(BracketMatchSchema),
});

/** One round that has passed BracketRoundSchema. */
export type BracketRound = z.infer<typeof BracketRoundSchema>;

/** The brackets shape: the rounds of one session, first round first. */
export const BracketsShapeSchema = z
  .object({
    sessionId: z.string().min(1),
    /** When the source produced this, in ms since 1970 (the server's clock). */
    updatedAtMs: z.number().int().min(0),
    rounds: z.array(BracketRoundSchema),
  })
  .superRefine((brackets, context) => {
    const reasons = ptBRDataShapes.shapeRuleReasons;
    let thirdPlaceRoundsSeen = 0;
    let hasSemifinalsBefore = false;
    brackets.rounds.forEach((round, roundIndex) => {
      if (round.isThirdPlace !== true) {
        // The semifinals are the round of two matches; the third place is run by their losers.
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
      }
    });
  });

/** Brackets that have passed BracketsShapeSchema. */
export type BracketsShape = z.infer<typeof BracketsShapeSchema>;
