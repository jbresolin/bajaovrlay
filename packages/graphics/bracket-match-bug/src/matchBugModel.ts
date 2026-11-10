/**
 * The match bug's data: its Zod schema (the boundary check for `load` and `updateAction`),
 * the merge of partial updates, pt-BR descriptions of bad data, and the look the data asks
 * for. bracket-match-bug.ograf.json describes the same data as JSON Schema for renderers
 * and the item form; matchBugManifestDataAgreement.test.ts keeps the two in agreement.
 *
 * Every field is optional, on purpose: the item reads "Chaves › Partida agora"
 * (BAJAOVRLAY-65), and an empty "agora" (or a match the source stopped listing) delivers
 * nothing, which must draw nothing rather than refuse the take or keep a stale match. A
 * match is shown only when both cars arrive whole (number and short name); the round, the
 * series, the results and the winner are drawn when they come.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import {
  type ScreenCorner,
  ScreenCornerSchema,
} from '@bajaovrlay/graphics-kit/screenCornerPosition';
import { z } from 'zod';

import { writeMatchTimeText } from '@bajaovrlay/graphics-kit/matchTimeText';
import { ptBR } from './ptBR.js';

/** The corner when the item names none: top-left, beside the sponsor bug. */
export const matchBugDefaultCorner: ScreenCorner = 'top-left';

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
const matchBugDataSchema = z.strictObject({
  roundName: z.string().optional(),
  bestOf: z.number().int().min(1).optional(),
  carANumber: z.number().int().min(1).optional(),
  carAShortName: z.string().optional(),
  carAWins: z.number().int().min(0).optional(),
  carATimeMs: z.number().int().min(0).optional(),
  carBNumber: z.number().int().min(1).optional(),
  carBShortName: z.string().optional(),
  carBWins: z.number().int().min(0).optional(),
  carBTimeMs: z.number().int().min(0).optional(),
  winnerCarNumber: z.number().int().min(1).optional(),
  corner: ScreenCornerSchema.optional(),
});

/** Everything the match bug shows, as the renderer sends it. */
export type MatchBugData = z.infer<typeof matchBugDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type MatchBugDataCheck =
  { isValid: true; data: MatchBugData } | { isValid: false; problem: string };

/** How a car came out of the match: it won, it lost, or the match is not decided. */
export type CarOutcome = 'winner' | 'loser' | 'undecided';

/** One car as the bug draws it. */
export type MatchBugCarLook = {
  carNumber: number;
  shortName: string;
  /** Its wins in a series ("1"), its time in a timed run ("41,870"), or no cell at all. */
  resultText: string | undefined;
  outcome: CarOutcome;
};

/** The match the bug shows: the round, the series tag and the two cars, car A first. */
export type MatchBugMatchLook = {
  roundName: string | undefined;
  /** "MD3" for a best of 3; undefined for a single race. */
  seriesTag: string | undefined;
  cars: [MatchBugCarLook, MatchBugCarLook];
};

/** What the bug shows: the match (undefined when there is none to show) and its corner. */
export type MatchBugLook = {
  match: MatchBugMatchLook | undefined;
  corner: ScreenCorner;
};

/** One car's fields as the data carries them, before they are read. */
type CarFields = {
  carNumber: number | undefined;
  shortName: string | undefined;
  wins: number | undefined;
  timeMs: number | undefined;
};

/** Says whether a text has something in it once trimmed. */
function isTextGiven(text: string | undefined): text is string {
  return text !== undefined && text.trim() !== '';
}

/**
 * The car's result cell: in a series its wins (0 before any, so the score has its place
 * from the start); otherwise its time when it has one; otherwise none.
 */
function writeResultText(car: CarFields, isSeries: boolean): string | undefined {
  if (isSeries) {
    return String(car.wins ?? 0);
  }
  if (car.timeMs !== undefined) {
    return writeMatchTimeText(car.timeMs);
  }
  return undefined;
}

/** Whether this car won, lost, or the match has no winner yet. */
function readOutcome(carNumber: number, winnerCarNumber: number | undefined): CarOutcome {
  if (winnerCarNumber === undefined) {
    return 'undecided';
  }
  return winnerCarNumber === carNumber ? 'winner' : 'loser';
}

/** One car's look, or undefined when its number or short name did not arrive. */
function readCarLook(
  car: CarFields,
  isSeries: boolean,
  winnerCarNumber: number | undefined,
): MatchBugCarLook | undefined {
  if (car.carNumber === undefined || !isTextGiven(car.shortName)) {
    return undefined;
  }
  return {
    carNumber: car.carNumber,
    shortName: car.shortName.trim(),
    resultText: writeResultText(car, isSeries),
    outcome: readOutcome(car.carNumber, winnerCarNumber),
  };
}

/**
 * Reads what the bug shows: the match only when both cars arrived whole, "MD3" only for
 * a best of N above 1, and the corner (top-left when none is chosen).
 */
export function readMatchBugLook(data: MatchBugData): MatchBugLook {
  const isSeries = data.bestOf !== undefined && data.bestOf > 1;
  const carA = readCarLook(
    {
      carNumber: data.carANumber,
      shortName: data.carAShortName,
      wins: data.carAWins,
      timeMs: data.carATimeMs,
    },
    isSeries,
    data.winnerCarNumber,
  );
  const carB = readCarLook(
    {
      carNumber: data.carBNumber,
      shortName: data.carBShortName,
      wins: data.carBWins,
      timeMs: data.carBTimeMs,
    },
    isSeries,
    data.winnerCarNumber,
  );
  const corner = data.corner ?? matchBugDefaultCorner;
  if (carA === undefined || carB === undefined) {
    return { match: undefined, corner };
  }
  return {
    match: {
      roundName: isTextGiven(data.roundName) ? data.roundName.trim() : undefined,
      seriesTag: isSeries ? ptBR.seriesTag(data.bestOf ?? 1) : undefined,
      cars: [carA, carB],
    },
    corner,
  };
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteMatchBugData(input: unknown): MatchBugDataCheck {
  const parsed = matchBugDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return {
    isValid: false,
    problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
  };
}

/**
 * Merges the partial data `updateAction` receives into the current data. A field sent as
 * undefined (the renderer's way of saying it left the air) is cleared. The current data
 * is never modified: a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoMatchBugData(
  currentData: MatchBugData,
  partialInput: unknown,
): MatchBugDataCheck {
  const parsedUpdate = matchBugDataSchema.safeParse(partialInput);
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
  return parseCompleteMatchBugData(mergedData);
}
