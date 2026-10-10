/**
 * The race clock's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, and pt-BR descriptions of bad data.
 * race-clock.ograf.json describes the same data as JSON Schema for renderers and forms;
 * raceClockManifest.test.ts keeps the two in agreement.
 */
import { z } from 'zod';

import { ptBR } from './ptBR.js';

/** The six flag states, in the order a session goes through them. */
export const flagStates = ['pre', 'green', 'yellow', 'red', 'checkered', 'finished'] as const;

/** Whether the clock counts time since the start or time left until the end. */
export const clockModes = ['elapsed', 'remaining'] as const;

export type FlagState = (typeof flagStates)[number];
export type ClockMode = (typeof clockModes)[number];

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
const raceClockDataSchema = z.strictObject({
  sessionName: z.string(),
  state: z.enum(flagStates),
  clockMode: z.enum(clockModes),
  referenceTimeMs: z.int().min(0),
  referenceWallClockMs: z.int().min(0),
  running: z.boolean(),
  lapsCompletedByLeader: z.int().min(0).optional(),
});

const partialRaceClockDataSchema = raceClockDataSchema.partial();

/** Everything the race clock shows, as the renderer sends it. */
export type RaceClockData = z.infer<typeof raceClockDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type RaceClockDataCheck =
  { isValid: true; data: RaceClockData } | { isValid: false; problem: string };

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteRaceClockData(input: unknown): RaceClockDataCheck {
  const parsed = raceClockDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return { isValid: false, problem: describeFirstProblemInPortuguese(input, parsed.error) };
}

/**
 * Merges the partial data `updateAction` receives into the current data. The current
 * data is never modified: a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoRaceClockData(
  currentData: RaceClockData,
  partialInput: unknown,
): RaceClockDataCheck {
  const parsedUpdate = partialRaceClockDataSchema.safeParse(partialInput);
  if (!parsedUpdate.success) {
    return {
      isValid: false,
      problem: describeFirstProblemInPortuguese(partialInput, parsedUpdate.error),
    };
  }
  const mergedData = { ...currentData, ...parsedUpdate.data };
  return parseCompleteRaceClockData(mergedData);
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
