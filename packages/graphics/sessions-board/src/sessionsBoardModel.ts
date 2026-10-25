/**
 * The sessions board's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates and pt-BR descriptions of bad data.
 * sessions-board.ograf.json describes the same data as JSON Schema for renderers and
 * forms; sessionsBoardManifestDataAgreement.test.ts keeps the two in agreement.
 *
 * The slots are what an entity list of the schedule gives (BAJAOVRLAY-46): an id, the
 * session, its kind, its start and, when known, its end and place. A slot's status is not
 * data: nothing refreshes the air when only time passes, so the board works it out itself
 * from the clock (sessionsBoardWindow.ts, on shared's findStatusOfScheduleSlot).
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { isTextGiven } from '@bajaovrlay/graphics-kit/textPresence';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

// One slot as the schedule's entity list writes it. Strict, as the manifest's items are.
const sessionsBoardSlotSchema = z.strictObject({
  slotId: z.string().min(1),
  sessionName: z.string().min(1),
  sessionKind: z.string().optional(),
  startsAtMs: z.int().min(0),
  endsAtMs: z.int().min(0).optional(),
  place: z.string().optional(),
});

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
const sessionsBoardDataSchema = z.strictObject({
  title: z.string().min(1),
  eventLine: z.string().optional(),
  dateLine: z.string().optional(),
  slots: z.array(sessionsBoardSlotSchema).min(1),
});

const partialSessionsBoardDataSchema = sessionsBoardDataSchema.partial();

/** One slot of the schedule, as the board receives it. */
export type SessionsBoardSlot = z.infer<typeof sessionsBoardSlotSchema>;

/** Everything the sessions board shows, as the renderer sends it. */
export type SessionsBoardData = z.infer<typeof sessionsBoardDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type SessionsBoardDataCheck =
  { isValid: true; data: SessionsBoardData } | { isValid: false; problem: string };

/** The head's event and date lines, each only when it has something to show. */
export function listSessionsBoardHeadLines(data: SessionsBoardData): {
  eventLine: string | undefined;
  dateLine: string | undefined;
} {
  return {
    eventLine: isTextGiven(data.eventLine) ? data.eventLine : undefined,
    dateLine: isTextGiven(data.dateLine) ? data.dateLine : undefined,
  };
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteSessionsBoardData(input: unknown): SessionsBoardDataCheck {
  const parsed = sessionsBoardDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return {
    isValid: false,
    problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
  };
}

/**
 * Merges the partial data `updateAction` receives (the live refresh sends the whole list
 * of slots after an edit of the schedule) into the current data. The current data is never
 * modified: a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoSessionsBoardData(
  currentData: SessionsBoardData,
  partialInput: unknown,
): SessionsBoardDataCheck {
  const parsedUpdate = partialSessionsBoardDataSchema.safeParse(partialInput);
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
  return parseCompleteSessionsBoardData({ ...currentData, ...parsedUpdate.data });
}
