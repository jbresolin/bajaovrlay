import { ptBRTransforms } from './ptBRTransforms.js';

/**
 * The longest quote a reason carries. A source can send a whole object where a lap time
 * was expected, and a reason that repeats ten kilobytes of JSON hides the point.
 */
const longestQuoteLength = 60;

/**
 * Writes the value a transform could not read the way a reason quotes it: text in double
 * quotes ("4:3x.293"), a number or boolean as JSON writes it (34, true), and anything
 * longer than 60 characters cut with "…".
 */
export function quoteValueForReason(value: unknown): string {
  if (value === undefined) {
    return ptBRTransforms.noValueQuote;
  }

  // JSON.stringify puts text in quotes and escapes what is inside, so a quote mark or a
  // line break in the source's text cannot break the sentence around it.
  const valueAsJson = JSON.stringify(value);
  if (valueAsJson === undefined) {
    // A function or a symbol: never from parsed JSON, but a reason must still be written.
    return String(value);
  }

  if (valueAsJson.length <= longestQuoteLength) {
    return valueAsJson;
  }
  return `${valueAsJson.slice(0, longestQuoteLength)}…`;
}
