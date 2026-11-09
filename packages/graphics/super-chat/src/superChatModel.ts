/**
 * The Super Chat card's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, and pt-BR descriptions of bad data.
 * super-chat.ograf.json describes the same data as JSON Schema for renderers and forms;
 * superChatManifestDataAgreement.test.ts keeps the two in agreement.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
// The amount and the author are what a Super Chat always has; the message is optional,
// since a viewer may pay without writing anything.
const superChatDataSchema = z.strictObject({
  amountText: z.string().min(1),
  authorName: z.string().min(1),
  messageText: z.string().optional(),
});

const partialSuperChatDataSchema = superChatDataSchema.partial();

/** Everything the Super Chat card shows, as the renderer sends it. */
export type SuperChatData = z.infer<typeof superChatDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type SuperChatDataCheck =
  { isValid: true; data: SuperChatData } | { isValid: false; problem: string };

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteSuperChatData(input: unknown): SuperChatDataCheck {
  const parsed = superChatDataSchema.safeParse(input);
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
export function mergePartialUpdateIntoSuperChatData(
  currentData: SuperChatData,
  partialInput: unknown,
): SuperChatDataCheck {
  const parsedUpdate = partialSuperChatDataSchema.safeParse(partialInput);
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
  return parseCompleteSuperChatData(mergedData);
}
