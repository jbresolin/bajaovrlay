/**
 * One pt-BR sentence for the first thing wrong with a graphic's data, the answer `load`
 * and `updateAction` give a renderer (and the operator) for data the graphic refuses. Each
 * graphic passes its own catalog's four sentences, so the message names the graphic
 * ("dados do aviso") while the rule for choosing the sentence is written once.
 */
import type { z } from 'zod';

/** The four sentences a graphic's pt-BR catalog gives for bad data. */
export type DataProblemSentences = {
  notAnObject: string;
  missingField: (fieldName: string) => string;
  unknownField: (fieldName: string) => string;
  invalidField: (fieldName: string) => string;
};

/** Writes a Zod path the way an operator reads it: `entries[3].teamName`. */
function writePathAsFieldName(path: PropertyKey[]): string {
  let fieldName = '';
  for (const step of path) {
    if (typeof step === 'number') {
      fieldName += `[${step}]`;
    } else {
      fieldName += fieldName === '' ? String(step) : `.${String(step)}`;
    }
  }
  return fieldName;
}

/** Walks the input along a Zod path; undefined when any step is not there. */
function readValueAtPath(input: unknown, path: PropertyKey[]): unknown {
  let value = input;
  for (const step of path) {
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }
    value = (value as Record<PropertyKey, unknown>)[step];
  }
  return value;
}

/**
 * Turns the first Zod issue into one pt-BR sentence naming the field, with the entry's
 * index when the problem is inside a list. Only the first is reported: one clear message
 * is more useful to an operator than a list.
 */
export function describeFirstDataProblemInPortuguese(
  input: unknown,
  error: z.ZodError,
  sentences: DataProblemSentences,
): string {
  const isAnObject = typeof input === 'object' && input !== null && !Array.isArray(input);
  if (!isAnObject) {
    return sentences.notAnObject;
  }

  const firstIssue = error.issues[0];
  if (firstIssue === undefined) {
    return sentences.notAnObject;
  }

  if (firstIssue.code === 'unrecognized_keys') {
    const firstUnknownField = firstIssue.keys[0] ?? '';
    return sentences.unknownField(firstUnknownField);
  }

  const fieldName = writePathAsFieldName(firstIssue.path);
  const fieldValue = readValueAtPath(input, firstIssue.path);
  if (fieldValue === undefined) {
    return sentences.missingField(fieldName);
  }
  return sentences.invalidField(fieldName);
}
