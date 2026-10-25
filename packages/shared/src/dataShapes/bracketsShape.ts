import { z } from 'zod';

import { addIssuesOfAMatch } from './bracketMatchRules.js';
import { addIssuesOfTheRounds } from './bracketRoundsRules.js';

// Refined by BAJAOVRLAY-25 against the Baja app's `tournament` table (catalogue entry 4):
// best of N, W.O., byes and the third place. Who advances is the source's job; the rules
// (bracketMatchRules.ts for one match, bracketRoundsRules.ts for the rounds) only refuse a
// bracket that contradicts itself. A source lists a round only once every match in it is
// known, and the third place no later than the final (gate 2 of PR #30, contracts A and C).

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
    addIssuesOfAMatch(match, context);
  });

/** One match that has passed BracketMatchSchema. */
export type BracketMatch = z.infer<typeof BracketMatchSchema>;

/** One round of the brackets ("Quartas de final") and its matches. */
export const BracketRoundSchema = z.object({
  name: z.string().min(1),
  /**
   * True for the third-place match, run by the semifinals' losers: not a column of the
   * tree, but drawn at the foot of the final's. At most one, of one match, after the
   * semifinals, listed no later than the final.
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
    addIssuesOfTheRounds(brackets.rounds, context);
  });

/** Brackets that have passed BracketsShapeSchema. */
export type BracketsShape = z.infer<typeof BracketsShapeSchema>;
