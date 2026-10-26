/**
 * The bracket's data: the Zod schema (the boundary check for `load` and `updateAction`),
 * the merge of partial updates and the settings with their defaults. bracket.ograf.json
 * describes the same data as JSON Schema; bracketManifestDataAgreement.test.ts keeps the
 * two in agreement.
 *
 * The rounds are the brackets shape's, bound whole (Chaves › Todas as fases): the graphic
 * draws them as given and repeats no rule of the shape (a bye's winner, the wins of a best
 * of N): the source's data passed the shared BracketsShapeSchema before it got here.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

// Loose on purpose, like the podium's entries: a canonical car passes as is, with fields
// the bracket does not draw riding along.
const bracketCarSchema = z.looseObject({
  carNumber: z.int().min(1),
  teamName: z.string(),
  schoolName: z.string(),
  timeMs: z.int().min(0).optional(),
  wins: z.int().min(0).optional(),
});

const bracketMatchSchema = z.looseObject({
  matchId: z.string().min(1),
  bestOf: z.int().min(1).optional(),
  walkover: z.boolean().optional(),
  carA: bracketCarSchema,
  carB: bracketCarSchema.optional(),
  winnerCarNumber: z.int().min(1).optional(),
});

const bracketRoundSchema = z.looseObject({
  name: z.string(),
  isThirdPlace: z.boolean().optional(),
  matches: z.array(bracketMatchSchema),
});

// Strict at the top: a field the graphic does not know (usually a typo) is refused.
const bracketDataSchema = z.strictObject({
  rounds: z.array(bracketRoundSchema),
  title: z.string().optional(),
});

const partialBracketDataSchema = bracketDataSchema.partial();

/** One car of a match, as the bracket reads it. */
export type BracketCarData = z.infer<typeof bracketCarSchema>;

/** One match: carB left out for a bye. */
export type BracketMatchData = z.infer<typeof bracketMatchSchema>;

/** One round and its matches. */
export type BracketRoundData = z.infer<typeof bracketRoundSchema>;

/** Everything the bracket shows, as the renderer sends it. */
export type BracketData = z.infer<typeof bracketDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type BracketDataCheck =
  { isValid: true; data: BracketData } | { isValid: false; problem: string };

/**
 * The head's title, the manifest's default "CHAVEAMENTO" when the item gives none. The one
 * place the default lives in code.
 */
export function readBracketTitle(data: BracketData): string {
  return data.title ?? ptBR.defaultTitle;
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteBracketData(input: unknown): BracketDataCheck {
  const parsed = bracketDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return {
    isValid: false,
    problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
  };
}

/**
 * Merges the partial data `updateAction` receives into the current data. The current
 * data is never modified: a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoBracketData(
  currentData: BracketData,
  partialInput: unknown,
): BracketDataCheck {
  const parsedUpdate = partialBracketDataSchema.safeParse(partialInput);
  if (!parsedUpdate.success) {
    return {
      isValid: false,
      problem: describeFirstDataProblemInPortuguese(
        partialInput,
        parsedUpdate.error,
        ptBR.validationProblems,
      ),
    };
  }
  const mergedData = { ...currentData, ...parsedUpdate.data };
  return parseCompleteBracketData(mergedData);
}
