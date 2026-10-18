import { z } from 'zod';

import { ptBRDataShapes } from './ptBRDataShapes.js';

// DRAFT: BAJAOVRLAY-25 will refine this shape against the Baja app's `tournament` table.
// Nothing binds to it yet beyond the whole list of rounds.

/** One car in a match, repeating its team and school so a graphic never joins. */
export const BracketCarSchema = z.object({
  carNumber: z.number().int().positive(),
  teamName: z.string().min(1),
  /** The university, short form ("UFPR"). */
  schoolName: z.string().min(1),
  /** The car's time in this match, in ms; left out until it has run. */
  timeMs: z.number().int().min(0).optional(),
});

/** One car of a match that has passed BracketCarSchema. */
export type BracketCar = z.infer<typeof BracketCarSchema>;

/** One head-to-head match of two different cars. The winner, when known, is one of them. */
export const BracketMatchSchema = z
  .object({
    matchId: z.string().min(1),
    carA: BracketCarSchema,
    carB: BracketCarSchema,
    /** Left out until the match is decided. */
    winnerCarNumber: z.number().int().positive().optional(),
  })
  .superRefine((match, context) => {
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

    const winner = match.winnerCarNumber;
    if (winner === undefined) {
      return;
    }
    const isWinnerOneOfTheTwoCars =
      winner === match.carA.carNumber || winner === match.carB.carNumber;
    if (!isWinnerOneOfTheTwoCars) {
      context.addIssue({
        code: 'custom',
        path: ['winnerCarNumber'],
        message: ptBRDataShapes.shapeRuleReasons.winnerNotInMatch(winner),
      });
    }
  });

/** One match that has passed BracketMatchSchema. */
export type BracketMatch = z.infer<typeof BracketMatchSchema>;

/** One round of the brackets ("Quartas de final") and its matches. */
export const BracketRoundSchema = z.object({
  name: z.string().min(1),
  matches: z.array(BracketMatchSchema),
});

/** One round that has passed BracketRoundSchema. */
export type BracketRound = z.infer<typeof BracketRoundSchema>;

/** The brackets shape (draft): the rounds of one session, first round first. */
export const BracketsShapeSchema = z.object({
  sessionId: z.string().min(1),
  /** When the source produced this, in ms since 1970 (the server's clock). */
  updatedAtMs: z.number().int().min(0),
  rounds: z.array(BracketRoundSchema),
});

/** Brackets that have passed BracketsShapeSchema. */
export type BracketsShape = z.infer<typeof BracketsShapeSchema>;
