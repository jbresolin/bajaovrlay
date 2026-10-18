import type { JsonValue } from '@bajaovrlay/shared';

/**
 * How the flex form reads a value the operator types where any JSON value may go: a
 * "Valor fixo" (text, number or yes/no) and the right column of a value table ("RUN" →
 * true, "PIT" → "inPit"). Operators should not have to write quotes around every word,
 * so the rule is: what reads as JSON is that JSON (true, false, 42, "42" with its
 * quotes), and anything else is the text as typed, its end spaces trimmed.
 * What could go wrong: a text that looks like a number ("2027") becomes a number unless
 * it is written in quotes; writeTypedValueText puts the quotes back, so an exported or
 * imported config shows "2027" quoted and keeps it a text.
 */

/** Reads typed text as a JSON value: JSON when it parses, otherwise the trimmed text. */
export function readTypedValueText(typedText: string): JsonValue {
  const trimmedText = typedText.trim();
  try {
    return JSON.parse(trimmedText) as JsonValue;
  } catch {
    return trimmedText;
  }
}

/**
 * Writes a value as the operator would type it, so readTypedValueText gives it back
 * unchanged: a text that reads back as itself is written bare ("inPit"); anything else
 * (a number, true, a text such as "42" or " BOX") is written as JSON.
 */
export function writeTypedValueText(value: JsonValue): string {
  if (typeof value === 'string') {
    const valueReadBack = readTypedValueText(value);
    if (valueReadBack === value) {
      return value;
    }
  }
  return JSON.stringify(value);
}
