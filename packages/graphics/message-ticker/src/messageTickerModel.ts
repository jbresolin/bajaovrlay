/**
 * The message ticker's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, and pt-BR descriptions of bad data.
 * message-ticker.ograf.json describes the same data as JSON Schema for renderers and forms;
 * messageTickerManifestDataAgreement.test.ts keeps the two in agreement.
 *
 * The label and the messages are typed (the messages are the item form's list of texts,
 * BAJAOVRLAY-23), within the limits of messageLimits.ts. The clock group is the race
 * clock's five reading fields (the kit's), required as on the strip because the server's
 * carryClockForward assumes them; the switch only hides the block.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import {
  type RaceClockReading,
  raceClockReadingFieldSchemas,
} from '@bajaovrlay/graphics-kit/raceClockReading';
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
  messages: z.array(z.string().min(1).max(longestMessageInCharacters)).min(1).max(mostMessages),
  ...raceClockReadingFieldSchemas,
  showClockBlock: z.boolean().optional(),
});

const partialMessageTickerDataSchema = messageTickerDataSchema.partial();

/** Everything the message ticker shows, as the renderer sends it. */
export type MessageTickerData = z.infer<typeof messageTickerDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type MessageTickerDataCheck =
  { isValid: true; data: MessageTickerData } | { isValid: false; problem: string };

/** Whether the clock block is shown; a missing switch means shown, as on the strip. */
export function isClockBlockShown(data: MessageTickerData): boolean {
  return data.showClockBlock ?? true;
}

/** The clock's reading out of the ticker's data, for the kit's clock block. */
export function readClockReadingOfTicker(data: MessageTickerData): RaceClockReading {
  return {
    state: data.state,
    clockMode: data.clockMode,
    referenceTimeMs: data.referenceTimeMs,
    referenceWallClockMs: data.referenceWallClockMs,
    running: data.running,
  };
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
