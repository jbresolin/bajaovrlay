/**
 * A number typed in a box of "Escolher carros" (BAJAOVRLAY-82), read the one way every
 * part of the box reads it: a whole number from 1, digits only, the spaces around it
 * ignored ("47", " 3 "). "4a", "0", "-1" and "" read as no number.
 */

/** Whole numbers from 1, with no sign, point or space inside. */
const wholeNumberFromOnePattern = /^[1-9]\d*$/;

/** The whole number typed, or undefined when the text is not one. */
export function readWholeNumberTyped(typedText: string): number | undefined {
  const trimmedText = typedText.trim();
  return wholeNumberFromOnePattern.test(trimmedText) ? Number(trimmedText) : undefined;
}
