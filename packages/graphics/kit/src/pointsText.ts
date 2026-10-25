/**
 * A score as the boards write it (the design's docs/design/tools/buildSampleData.mjs,
 * `writePoints`), for the standings and the intermission's top five (BAJAOVRLAY-46, moved
 * here from the standings): rounded to two decimals with the zeros after the comma dropped
 * ("921,8", "312,5", "150"), the decimal comma, and the typographic minus for a negative
 * part ("−15"), never the hyphen, which Bebas Neue draws short and high. No thousands
 * separator: the design has none, and no score of the competition reaches 1000.
 */

/** The minus sign of a negative score (SEG., PEN.): the typographic one, not the hyphen. */
const minusSign = '−';

/** The decimal comma of a fractional score ("903,48"). */
const decimalSeparator = ',';

/** Writes a score the way the boards show it: 903.48 → "903,48", -15 → "−15", 150 → "150". */
export function writePointsAsText(points: number): string {
  const roundedToTwoDecimals = Math.round(points * 100) / 100;
  // String() drops the zeros after the point (312.50 is "312.5") and gives "0" for -0,
  // which the rounding of a tiny negative leaves.
  const pointWritten = String(roundedToTwoDecimals);
  const commaWritten = pointWritten.replace('.', decimalSeparator);
  if (roundedToTwoDecimals < 0) {
    return commaWritten.replace('-', minusSign);
  }
  return commaWritten;
}
