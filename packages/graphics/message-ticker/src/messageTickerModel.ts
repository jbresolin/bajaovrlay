/**
 * The message ticker's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, and pt-BR descriptions of bad data.
 * message-ticker.ograf.json describes the same data as JSON Schema for renderers and forms;
 * messageTickerManifestDataAgreement.test.ts keeps the two in agreement.
 *
 * The label and the messages are typed (the messages are the item form's list of texts,
 * BAJAOVRLAY-23), within the limits of messageLimits.ts. The clock is the race clock's
 * four clock fields and the flag (the kit's), required with typed defaults as on the strip,
 * the conservative choice. The block is off unless switched on (decided at gate 2 of
 * PR #26): a ticker taken between sessions would otherwise show a stopped 0:00 under
 * "Pré-largada".
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { raceClockReadingFieldSchemas } from '@bajaovrlay/graphics-kit/raceClockReading';
import { z } from 'zod';

import {
  longestLabelInCharacters,
  longestMessageInCharacters,
  mostMessages,
} from './messageLimits.js';
import { ptBR } from './ptBR.js';

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
// Zod counts a text's length in UTF-16 units and JSON Schema in code points; an accented
// capital is one of each, so the two agree on every Portuguese message (an emoji, which the
// face cannot draw anyway, would count twice here).
const messageTickerDataSchema = z.strictObject({
  label: z.string().min(1).max(longestLabelInCharacters),
  // A message holds at least one character that is not a space, as the manifest's pattern
  // "\S" says; the item form trims each line, so it names a line of spaces as empty.
  messages: z
    .array(z.string().min(1).max(longestMessageInCharacters).regex(/\S/))
    .min(1)
    .max(mostMessages),
  ...raceClockReadingFieldSchemas,
  showClockBlock: z.boolean().optional(),
});

const partialMessageTickerDataSchema = messageTickerDataSchema.partial();

/** Everything the message ticker shows, as the renderer sends it. */
export type MessageTickerData = z.infer<typeof messageTickerDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type MessageTickerDataCheck =
  { isValid: true; data: MessageTickerData } | { isValid: false; problem: string };

/**
 * Whether the clock block is shown; a missing switch means hidden, unlike the strip's: the
 * ticker is often up between sessions, when the clock has nothing to show.
 */
export function isClockBlockShown(data: MessageTickerData): boolean {
  return data.showClockBlock ?? false;
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteMessageTickerData(input: unknown): MessageTickerDataCheck {
  const parsed = messageTickerDataSchema.safeParse(input);
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
 * data is never modified: a refused update leaves nothing half-applied. New messages
 * replace the whole list, as "Atualizar no ar" sends it.
 */
export function mergePartialUpdateIntoMessageTickerData(
  currentData: MessageTickerData,
  partialInput: unknown,
): MessageTickerDataCheck {
  const parsedUpdate = partialMessageTickerDataSchema.safeParse(partialInput);
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
  return parseCompleteMessageTickerData(mergedData);
}
