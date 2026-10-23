/**
 * The notice's data: its Zod schema (the boundary check for `load` and `updateAction`),
 * the merge of partial updates, and pt-BR descriptions of bad data. notice.ograf.json
 * describes the same data as JSON Schema for renderers and forms;
 * noticeManifestDataAgreement.test.ts keeps the two in agreement.
 */
import { z } from 'zod';

import { ptBR } from './ptBR.js';

/** The two looks of the card: a fastest lap, or a notice from race control. */
export const noticeVariants = ['fastestLap', 'penalty'] as const;

/** What race control is announcing; the word in the head of a penalty notice. */
export const noticeKinds = ['penalty', 'warning', 'incident', 'notice'] as const;

export type NoticeVariant = (typeof noticeVariants)[number];
export type NoticeKind = (typeof noticeKinds)[number];

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
// Every field but the variant and the car is optional: the card leaves out the part a
// missing field would have filled, so an event that knows little still makes a clean card.
const noticeDataSchema = z.strictObject({
  variant: z.enum(noticeVariants),
  carNumber: z.int().min(1),
  teamName: z.string().optional(),
  schoolName: z.string().optional(),
  lapNumber: z.int().min(1).optional(),
  lapTimeText: z.string().optional(),
  noticeKind: z.enum(noticeKinds).optional(),
  reason: z.string().optional(),
  penaltyText: z.string().optional(),
});

const partialNoticeDataSchema = noticeDataSchema.partial();

/** Everything the notice shows, as the renderer sends it. */
export type NoticeData = z.infer<typeof noticeDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type NoticeDataCheck =
  { isValid: true; data: NoticeData } | { isValid: false; problem: string };

/**
 * The kind of a penalty notice. A missing kind reads as a penalty: it is what race
 * control sends most, and the design's own example.
 */
export function readNoticeKind(data: NoticeData): NoticeKind {
  return data.noticeKind ?? 'penalty';
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteNoticeData(input: unknown): NoticeDataCheck {
  const parsed = noticeDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return { isValid: false, problem: describeFirstProblemInPortuguese(input, parsed.error) };
}

/**
 * Merges the partial data `updateAction` receives into the current data. The current
 * data is never modified: a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoNoticeData(
  currentData: NoticeData,
  partialInput: unknown,
): NoticeDataCheck {
  const parsedUpdate = partialNoticeDataSchema.safeParse(partialInput);
  if (!parsedUpdate.success) {
    return {
      isValid: false,
      problem: describeFirstProblemInPortuguese(partialInput, parsedUpdate.error),
    };
  }
  const mergedData = { ...currentData, ...parsedUpdate.data };
  return parseCompleteNoticeData(mergedData);
}

/**
 * Turns the first Zod issue into one pt-BR sentence naming the field. Only the first
 * is reported: one clear message is more useful to an operator than a list.
 */
function describeFirstProblemInPortuguese(input: unknown, error: z.ZodError): string {
  const isAnObject = typeof input === 'object' && input !== null && !Array.isArray(input);
  if (!isAnObject) {
    return ptBR.validationProblems.notAnObject;
  }

  const firstIssue = error.issues[0];
  if (firstIssue === undefined) {
    return ptBR.validationProblems.notAnObject;
  }

  if (firstIssue.code === 'unrecognized_keys') {
    const firstUnknownField = firstIssue.keys[0] ?? '';
    return ptBR.validationProblems.unknownField(firstUnknownField);
  }

  const fieldName = String(firstIssue.path[0] ?? '');
  const fieldValue = (input as Record<string, unknown>)[fieldName];
  if (fieldValue === undefined) {
    return ptBR.validationProblems.missingField(fieldName);
  }
  return ptBR.validationProblems.invalidField(fieldName);
}
