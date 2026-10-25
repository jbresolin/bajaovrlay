/**
 * The countdown's data: its Zod schema (the boundary check for `load` and `updateAction`),
 * the merge of partial updates, pt-BR descriptions of bad data, and which parts the
 * waiting screen's head has. countdown.ograf.json describes the same data as JSON Schema
 * for renderers and forms; countdownManifestDataAgreement.test.ts keeps the two in
 * agreement.
 *
 * The count is not data: the graphic counts down to `startsAtMs` itself, on the
 * server-aligned clock (BAJAOVRLAY-46, decided), so a start moved by an edit of the
 * schedule simply moves the target. The typical item reads `sessionName` and `startsAtMs`
 * from a schedule slot of Cadastros.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { isTextGiven } from '@bajaovrlay/graphics-kit/textPresence';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

/** The two layouts: the race clock's card without the band, or the narrow waiting board. */
export const countdownLayouts = ['card', 'fullscreen'] as const;

/** One of the two layouts. */
export type CountdownLayout = (typeof countdownLayouts)[number];

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored. The
// event and date lines are optional: the waiting screen's head is finished without them,
// and the card shows neither.
const countdownDataSchema = z.strictObject({
  layout: z.enum(countdownLayouts),
  sessionName: z.string().min(1),
  startsAtMs: z.int().min(0),
  eventLine: z.string().optional(),
  dateLine: z.string().optional(),
});

const partialCountdownDataSchema = countdownDataSchema.partial();

/** Everything the countdown shows, as the renderer sends it. */
export type CountdownData = z.infer<typeof countdownDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type CountdownDataCheck =
  { isValid: true; data: CountdownData } | { isValid: false; problem: string };

/** The waiting screen head's two optional lines, each only when it has something to show. */
export type CountdownHeadLines = { eventLine: string | undefined; dateLine: string | undefined };

/** The head's event and date lines for this data; a blank line is left out, never drawn empty. */
export function listCountdownHeadLines(data: CountdownData): CountdownHeadLines {
  return {
    eventLine: isTextGiven(data.eventLine) ? data.eventLine : undefined,
    dateLine: isTextGiven(data.dateLine) ? data.dateLine : undefined,
  };
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteCountdownData(input: unknown): CountdownDataCheck {
  const parsed = countdownDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return {
    isValid: false,
    problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
  };
}

/**
 * Merges the partial data `updateAction` receives into the current data. The current data
 * is never modified: a refused update leaves nothing half-applied. A key sent as undefined
 * (a field cleared in the preview) takes the field off.
 */
export function mergePartialUpdateIntoCountdownData(
  currentData: CountdownData,
  partialInput: unknown,
): CountdownDataCheck {
  const parsedUpdate = partialCountdownDataSchema.safeParse(partialInput);
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
  return parseCompleteCountdownData(mergedData);
}
