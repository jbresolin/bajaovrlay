import { z } from 'zod';

import { ptBRTriggers } from './ptBRTriggers.js';

/** The largest body an HTTP trigger accepts, in bytes of UTF-8: 8 KB. */
export const largestTriggerHttpBodyBytes = 8 * 1024;

/**
 * The data a firing carries (BAJAOVRLAY-48): a flat map of keys to texts or numbers,
 * with pt-BR keys when the server writes it (`{ cena: "Box" }`, `{ carro: 47 }`), and
 * whatever keys the device chose for an HTTP trigger. Flat on purpose: a take step reads
 * one key per field, and there is no path to follow and no transform to run.
 */
export const TriggerDataSchema = z.record(
  z.string().min(1).max(64),
  z.union([z.string(), z.number()]),
);

/** Trigger data after validation. */
export type TriggerData = z.infer<typeof TriggerDataSchema>;

/** What reading an HTTP trigger's body gives: its data, or why it was refused (pt-BR). */
export type TriggerHttpBodyReading =
  { status: 'read'; data: TriggerData } | { status: 'refused'; reason: string };

/**
 * Reads the body of `POST /api/v1/triggers/:triggerId` as trigger data. An empty body is
 * no data. Anything else must be a JSON object whose values are texts or numbers, at most
 * 8 KB in UTF-8; the reason a body is refused is answered with 400. true/false and null
 * are refused rather than turned into text: a field filled with "true" is a bug nobody sees.
 */
export function readTriggerDataFromHttpBody(bodyText: string): TriggerHttpBodyReading {
  const bodyBytes = countBytesInUtf8(bodyText);
  if (bodyBytes > largestTriggerHttpBodyBytes) {
    return { status: 'refused', reason: ptBRTriggers.httpBodyReasons.tooLarge };
  }
  if (bodyText.trim() === '') {
    return { status: 'read', data: {} };
  }
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(bodyText);
  } catch {
    return { status: 'refused', reason: ptBRTriggers.httpBodyReasons.notJson };
  }
  if (typeof parsedBody !== 'object' || parsedBody === null || Array.isArray(parsedBody)) {
    return { status: 'refused', reason: ptBRTriggers.httpBodyReasons.notAnObject };
  }
  const keysAndValues: Array<[string, string | number]> = [];
  for (const [key, value] of Object.entries(parsedBody)) {
    // JSON.parse makes `__proto__` an ordinary key; refused all the same, so no copy of
    // the data made by assignment further on can change what kind of object it is.
    if (key === '__proto__') {
      return { status: 'refused', reason: ptBRTriggers.httpBodyReasons.forbiddenKey(key) };
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      return { status: 'refused', reason: ptBRTriggers.httpBodyReasons.notTextOrNumber(key) };
    }
    keysAndValues.push([key, value]);
  }
  const checkedData = TriggerDataSchema.safeParse(Object.fromEntries(keysAndValues));
  if (!checkedData.success) {
    return { status: 'refused', reason: ptBRTriggers.httpBodyReasons.badKey };
  }
  return { status: 'read', data: checkedData.data };
}

/**
 * How many bytes a text takes in UTF-8, as it travels in the body. Counted by code point
 * from the encoding's four ranges, because this package builds without TextEncoder (no DOM
 * or Node library in its build).
 */
function countBytesInUtf8(text: string): number {
  let byteCount = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      byteCount += 1;
    } else if (codePoint <= 0x7ff) {
      byteCount += 2;
    } else if (codePoint <= 0xffff) {
      byteCount += 3;
    } else {
      byteCount += 4;
    }
  }
  return byteCount;
}
